import { useMemo, useState, type FormEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { isFirebaseConfigured, requireFunctions } from '../lib/firebase'
import { formatTutar } from '../shared/TutarGoster'
import { cuvalGoster } from '../shared/unHesabi'
import DurumRozeti from '../shared/DurumRozeti'
import { anaUrunAdi } from '../shared/urunAdi'
import type { VeresiyeDurumu } from '../lib/types'

interface PortalKayit {
  tarih: string
  urunAdi: string
  adet: number
  tutar: number
  durum: VeresiyeDurumu
}

interface PortalOdeme {
  tarih: string
  tutar: number
  not: string | null
}

interface PortalSonuc {
  ad: string
  adSoyad: string
  hitapSekli: 'bay' | 'hanim' | null
  veresiyeBakiye: number
  unHesabi: { aktif: boolean; birikenEsdegerAdet: number; adetPerCuval: number | null } | null
  kayitlar: PortalKayit[]
  odemeler: PortalOdeme[]
}

const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
]

function ayEtiketi(ayAnahtari: string) {
  const [yil, ay] = ayAnahtari.split('-').map(Number)
  return `${AY_ADLARI[ay - 1]} ${yil}`
}

interface AylikUrunSatiri {
  urunAdi: string
  adet: number
  tutar: number
  kayitlar: PortalKayit[]
}

interface AylikOzet {
  anahtar: string
  etiket: string
  toplam: number
  toplamAdet: number
  urunler: AylikUrunSatiri[]
}

function aylikOzetOlustur(kayitlar: PortalKayit[]): AylikOzet[] {
  const map = new Map<string, AylikOzet>()
  for (const k of kayitlar) {
    const anahtar = k.tarih.slice(0, 7)
    let ay = map.get(anahtar)
    if (!ay) {
      ay = { anahtar, etiket: ayEtiketi(anahtar), toplam: 0, toplamAdet: 0, urunler: [] }
      map.set(anahtar, ay)
    }
    ay.toplam += k.tutar
    ay.toplamAdet += k.adet
    // Okul modülünden gelen kayıtlarda urunAdi "{okul} — {ürün}" biçiminde
    // olabilir (bir veresiye hesabına birden çok okul bağlıysa) — ürün satırı
    // burada ANA ürün adına göre toplanır, altındaki kayıtlar ise okul/kaynak
    // izlenebilirliği için ham adıyla saklanır (bkz. shared/urunAdi.ts) — bu
    // sayede müşteri "379 Roll" yazan satıra dokununca hangi okuldan kaçar
    // adet geldiğini tek tek toplamadan görebiliyor.
    const anaAd = anaUrunAdi(k.urunAdi)
    const urun = ay.urunler.find((u) => u.urunAdi === anaAd)
    if (urun) {
      urun.adet += k.adet
      urun.tutar += k.tutar
      urun.kayitlar.push(k)
    } else {
      ay.urunler.push({ urunAdi: anaAd, adet: k.adet, tutar: k.tutar, kayitlar: [k] })
    }
  }
  return [...map.values()]
    .map((ay) => ({ ...ay, urunler: ay.urunler.sort((a, b) => b.adet - a.adet) }))
    .sort((a, b) => b.anahtar.localeCompare(a.anahtar))
}

interface UrunToplami {
  urunAdi: string
  adet: number
  tutar: number
}

function urunBazliToplamOlustur(kayitlar: PortalKayit[]): UrunToplami[] {
  const map = new Map<string, UrunToplami>()
  for (const k of kayitlar) {
    const anaAd = anaUrunAdi(k.urunAdi)
    const mevcut = map.get(anaAd) ?? { urunAdi: anaAd, adet: 0, tutar: 0 }
    mevcut.adet += k.adet
    mevcut.tutar += k.tutar
    map.set(anaAd, mevcut)
  }
  return [...map.values()].sort((a, b) => b.tutar - a.tutar)
}

function hitapGoster(ad: string, adSoyad: string, hitapSekli: PortalSonuc['hitapSekli']) {
  const isim = adSoyad || ad
  if (hitapSekli === 'bay') return `${isim} Bey`
  if (hitapSekli === 'hanim') return `${isim} Hanım`
  return isim
}

export default function PortalApp() {
  const parametreler = new URLSearchParams(window.location.search)
  const kod = parametreler.get('kod') ?? ''
  // Günlük Veresiye (kasa) müşterilerinin linki: portal.html?kod=...&tur=gunluk
  const tur = parametreler.get('tur') === 'gunluk' ? 'gunluk' : 'veresiye'
  const [sifre, setSifre] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [hataKodu, setHataKodu] = useState<string | null>(null)
  const [veri, setVeri] = useState<PortalSonuc | null>(null)
  const [acikAy, setAcikAy] = useState<string | null>(null)
  const [acikUrun, setAcikUrun] = useState<string | null>(null)

  const toplamOdenen = useMemo(() => (veri ? veri.odemeler.reduce((s, o) => s + o.tutar, 0) : 0), [veri])
  const urunToplamlari = useMemo(() => (veri ? urunBazliToplamOlustur(veri.kayitlar) : []), [veri])
  const aylikOzet = useMemo(() => (veri ? aylikOzetOlustur(veri.kayitlar) : []), [veri])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!kod) {
      setHata('Geçersiz bağlantı — kod bulunamadı.')
      setHataKodu(null)
      return
    }
    setHata(null)
    setHataKodu(null)
    setYukleniyor(true)
    try {
      const cagir = httpsCallable<{ musteriId: string; sifre: string; tur: string }, PortalSonuc>(requireFunctions(), 'portalGiris')
      const sonuc = await cagir({ musteriId: kod, sifre, tur })
      setVeri(sonuc.data)
    } catch (err) {
      // Tam hatayı konsola yaz (CORS, izin, bağlantı, fonksiyon bulunamadı vb. teşhis için) —
      // ekranda ise müşteriye anlamlı bir mesaj + küçük bir teknik kod satırı gösterilir.
      // eslint-disable-next-line no-console
      console.error('[portalGiris] Giriş hatası:', err)
      const code = (err as { code?: string })?.code
      const mesaj = err instanceof Error ? err.message.replace(/^\w+\/[\w-]+:\s*/, '') : 'Giriş yapılamadı.'
      setHata(
        code === 'functions/internal' || code === 'functions/unavailable' || code === 'functions/not-found'
          ? 'Sistem şu anda ulaşılamıyor durumda. Lütfen daha sonra tekrar deneyin veya fırınla iletişime geçin.'
          : mesaj
      )
      setHataKodu(code ? `Hata kodu: ${code}` : null)
    } finally {
      setYukleniyor(false)
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bakery-cream-50 px-4">
        <p className="text-sm text-bakery-ink-600">Sistem şu anda yapılandırılmıyor.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bakery-cream-50 px-4 py-8">
      <div className={`w-full ${veri ? 'max-w-lg' : 'max-w-sm'}`}>
        <div className="mb-6 text-center">
          <img src="/logo-mark.webp" alt="Başak Ekmek" className="logo-adaptive mx-auto mb-3 h-16 w-44 object-contain object-center" />
          <h1 className="text-xl font-semibold text-bakery-ink-900">Başak Ekmek</h1>
          <p className="mt-1 text-sm text-bakery-ink-600">Hesap Ekstresi</p>
        </div>

        {!veri ? (
          <form onSubmit={handleSubmit} className="rounded-2xl bg-bakery-surface p-6 shadow-lg shadow-bakery-coffee-900/10">
            <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800" htmlFor="sifre">
              6 Haneli Şifreniz
            </label>
            <input
              id="sifre"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={sifre}
              onChange={(e) => setSifre(e.target.value.replace(/\D/g, ''))}
              autoFocus
              className="mb-4 w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2.5 text-center text-lg tracking-widest text-bakery-ink-900 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
            {hata && (
              <div className="mb-4 rounded-lg bg-bakery-danger/10 px-3 py-2 text-sm text-bakery-danger">
                <p>{hata}</p>
                {hataKodu && <p className="mt-1 text-xs text-bakery-danger/70">{hataKodu}</p>}
              </div>
            )}
            <button
              type="submit"
              disabled={yukleniyor || sifre.length !== 6}
              className="w-full rounded-lg bg-bakery-amber-600 py-2.5 font-medium text-white transition hover:bg-bakery-amber-500 disabled:opacity-60"
            >
              {yukleniyor ? 'Kontrol ediliyor…' : 'Görüntüle'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl bg-bakery-surface p-5 shadow-lg shadow-bakery-coffee-900/10">
              <p className="text-sm text-bakery-ink-500">Merhaba,</p>
              <p className="mb-3 text-lg font-semibold text-bakery-ink-900">
                {hitapGoster(veri.ad, veri.adSoyad, veri.hitapSekli)}
              </p>

              {veri.unHesabi?.aktif ? (
                <div>
                  <p className="text-sm text-bakery-ink-500">Un Bakiyeniz</p>
                  <p className={`text-2xl font-bold ${veri.unHesabi.birikenEsdegerAdet > 0 ? 'text-bakery-danger' : 'text-bakery-success'}`}>
                    {cuvalGoster(veri.unHesabi.birikenEsdegerAdet, veri.unHesabi.adetPerCuval)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-bakery-ink-500">Güncel Bakiyeniz</p>
                  <p className={`text-2xl font-bold ${veri.veresiyeBakiye > 0 ? 'text-bakery-danger' : 'text-bakery-success'}`}>
                    {formatTutar(veri.veresiyeBakiye)}
                  </p>
                </div>
              )}
            </div>

            {veri.odemeler.length > 0 && (
              <div className="rounded-2xl bg-bakery-surface p-5 shadow-lg shadow-bakery-coffee-900/10">
                <h2 className="mb-3 text-sm font-semibold text-bakery-ink-800">Ödemeleriniz</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-bakery-cream-100 text-left text-xs text-bakery-ink-500">
                        <th className="pb-1.5 font-medium">Tarih</th>
                        <th className="pb-1.5 font-medium">Tutar</th>
                        <th className="pb-1.5 font-medium">Not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {veri.odemeler.map((o, i) => (
                        <tr key={i} className="border-b border-bakery-cream-100 last:border-0">
                          <td className="py-1.5 text-bakery-ink-600">{o.tarih}</td>
                          <td className="py-1.5 font-medium text-bakery-success">{formatTutar(o.tutar)}</td>
                          <td className="py-1.5 text-bakery-ink-500">{o.not ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-right text-sm font-semibold text-bakery-ink-900">
                  Toplam Ödediğiniz: {formatTutar(toplamOdenen)}
                </p>
              </div>
            )}

            {urunToplamlari.length > 0 && (
              <div className="rounded-2xl bg-bakery-surface p-5 shadow-lg shadow-bakery-coffee-900/10">
                <h2 className="mb-3 text-sm font-semibold text-bakery-ink-800">Ürün Bazlı Toplam (Tüm Zamanlar)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-bakery-cream-100 text-left text-xs text-bakery-ink-500">
                        <th className="pb-1.5 font-medium">Ürün</th>
                        <th className="pb-1.5 font-medium">Adet</th>
                        <th className="pb-1.5 font-medium">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {urunToplamlari.map((u) => (
                        <tr key={u.urunAdi} className="border-b border-bakery-cream-100 last:border-0">
                          <td className="py-1.5 text-bakery-ink-800">{u.urunAdi}</td>
                          <td className="py-1.5 text-bakery-ink-600">{u.adet} adet</td>
                          <td className="py-1.5 font-medium text-bakery-ink-900">{formatTutar(u.tutar)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {aylikOzet.length > 0 && (
              <div className="rounded-2xl bg-bakery-surface p-5 shadow-lg shadow-bakery-coffee-900/10">
                <h2 className="mb-3 text-sm font-semibold text-bakery-ink-800">
                  Aylık Özet <span className="font-normal text-bakery-ink-400">(detay için dokun)</span>
                </h2>
                <div className="space-y-1">
                  {aylikOzet.map((ay) => {
                    const acik = acikAy === ay.anahtar
                    return (
                      <div key={ay.anahtar} className="border-b border-bakery-cream-100 last:border-0">
                        <button
                          type="button"
                          onClick={() => setAcikAy(acik ? null : ay.anahtar)}
                          className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-bakery-ink-800">{ay.etiket}</p>
                            <p className="truncate text-xs text-bakery-ink-400">
                              {ay.urunler.map((u) => `${u.urunAdi}: ${u.adet}`).join(', ')}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <div className="text-right">
                              <p className="font-semibold text-bakery-ink-900">{formatTutar(ay.toplam)}</p>
                              <p className="text-xs text-bakery-ink-400">{ay.toplamAdet} adet</p>
                            </div>
                            <ChevronDown size={16} className={`text-bakery-ink-400 transition-transform ${acik ? 'rotate-180' : ''}`} />
                          </div>
                        </button>
                        {acik && (
                          <div className="mb-2 space-y-1 rounded-lg bg-bakery-cream-50 p-2">
                            {ay.urunler.map((u) => {
                              const urunAnahtari = `${ay.anahtar}__${u.urunAdi}`
                              const urunAcik = acikUrun === urunAnahtari
                              return (
                                <div key={u.urunAdi}>
                                  <button
                                    type="button"
                                    onClick={() => setAcikUrun(urunAcik ? null : urunAnahtari)}
                                    className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-xs hover:bg-bakery-cream-100"
                                  >
                                    <span className="text-bakery-ink-700">{u.urunAdi} × {u.adet}</span>
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium text-bakery-ink-900">{formatTutar(u.tutar)}</span>
                                      <ChevronDown
                                        size={13}
                                        className={`text-bakery-ink-400 transition-transform ${urunAcik ? 'rotate-180' : ''}`}
                                      />
                                    </span>
                                  </button>
                                  {urunAcik && (
                                    <ul className="ml-2 space-y-1 border-l border-bakery-cream-200 py-1 pl-2">
                                      {u.kayitlar.map((k, i) => (
                                        <li key={i} className="flex items-center justify-between text-xs">
                                          <span className="text-bakery-ink-500">
                                            {k.tarih} — {k.urunAdi} × {k.adet}
                                          </span>
                                          <span className="flex items-center gap-1.5">
                                            <span className="font-medium text-bakery-ink-800">{formatTutar(k.tutar)}</span>
                                            <DurumRozeti durum={k.durum} />
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-bakery-surface p-5 shadow-lg shadow-bakery-coffee-900/10">
              <h2 className="mb-3 text-sm font-semibold text-bakery-ink-800">Tüm İşlemler</h2>
              {veri.kayitlar.length === 0 ? (
                <p className="text-sm text-bakery-ink-400">Henüz hareket yok.</p>
              ) : (
                <div className="max-h-96 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="sticky top-0 border-b border-bakery-cream-100 bg-bakery-surface text-left text-xs text-bakery-ink-500">
                        <th className="pb-1.5 font-medium">Tarih</th>
                        <th className="pb-1.5 font-medium">Ürün</th>
                        <th className="pb-1.5 font-medium">Adet</th>
                        <th className="pb-1.5 font-medium">Tutar</th>
                        <th className="pb-1.5 font-medium">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {veri.kayitlar.map((k, i) => (
                        <tr key={i} className="border-b border-bakery-cream-100 last:border-0">
                          <td className="py-1.5 text-bakery-ink-600">{k.tarih}</td>
                          <td className="py-1.5 text-bakery-ink-800">{k.urunAdi}</td>
                          <td className="py-1.5 text-bakery-ink-600">{k.adet}</td>
                          <td className="py-1.5 font-medium text-bakery-ink-900">{formatTutar(k.tutar)}</td>
                          <td className="py-1.5">
                            <DurumRozeti durum={k.durum} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setVeri(null)
                setSifre('')
              }}
              className="w-full text-center text-sm text-bakery-ink-500 hover:text-bakery-ink-700"
            >
              Çıkış
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
