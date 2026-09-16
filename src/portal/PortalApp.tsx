import { useEffect, useState, type FormEvent } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { isFirebaseConfigured, requireFunctions } from '../lib/firebase'
import { formatTutar } from '../shared/TutarGoster'
import { cuvalGoster } from '../shared/unHesabi'
import { portalBildirimleriEtkinlestir, pushDurumuGetir, type PushDurum } from '../shared/pushBildirimleri'

interface PortalHareket {
  tarih: string
  tur: 'teslimat' | 'odeme'
  aciklama: string
  tutar: number
  durum: string
}

interface PortalSonuc {
  ad: string
  adSoyad: string
  hitapSekli: 'bay' | 'hanim' | null
  veresiyeBakiye: number
  unHesabi: { aktif: boolean; birikenEsdegerAdet: number; adetPerCuval: number | null } | null
  hareketler: PortalHareket[]
}

function hitapGoster(ad: string, adSoyad: string, hitapSekli: PortalSonuc['hitapSekli']) {
  const isim = adSoyad || ad
  if (hitapSekli === 'bay') return `${isim} Bey`
  if (hitapSekli === 'hanim') return `${isim} Hanım`
  return isim
}

export default function PortalApp() {
  const kod = new URLSearchParams(window.location.search).get('kod') ?? ''
  const [sifre, setSifre] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [hataKodu, setHataKodu] = useState<string | null>(null)
  const [veri, setVeri] = useState<PortalSonuc | null>(null)
  const [pushDurum, setPushDurum] = useState<PushDurum>('izin_verilmedi')
  const [pushIsleniyor, setPushIsleniyor] = useState(false)

  useEffect(() => {
    pushDurumuGetir().then(setPushDurum)
  }, [])

  async function handleBildirimAc() {
    setPushIsleniyor(true)
    try {
      await portalBildirimleriEtkinlestir(kod, sifre)
      setPushDurum('aktif')
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Bildirimler açılamadı.')
    } finally {
      setPushIsleniyor(false)
    }
  }

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
      const cagir = httpsCallable<{ musteriId: string; sifre: string }, PortalSonuc>(requireFunctions(), 'portalGiris')
      const sonuc = await cagir({ musteriId: kod, sifre })
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
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/logo.webp" alt="Başak Ekmek" className="mx-auto mb-3 h-16 w-44 rounded-lg object-cover object-center" />
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

            <div className="rounded-2xl bg-bakery-surface p-5 shadow-lg shadow-bakery-coffee-900/10">
              <h2 className="mb-3 text-sm font-semibold text-bakery-ink-800">Son Hareketler</h2>
              {veri.hareketler.length === 0 ? (
                <p className="text-sm text-bakery-ink-400">Henüz hareket yok.</p>
              ) : (
                <ul className="space-y-2">
                  {veri.hareketler.map((h, i) => (
                    <li key={i} className="flex items-center justify-between border-b border-bakery-cream-100 pb-2 text-sm last:border-0">
                      <div>
                        <p className="text-bakery-ink-800">{h.aciklama}</p>
                        <p className="text-xs text-bakery-ink-400">{h.tarih}</p>
                      </div>
                      <span className={h.tur === 'odeme' ? 'font-medium text-bakery-success' : 'font-medium text-bakery-ink-900'}>
                        {h.tur === 'odeme' ? '+ ' : ''}
                        {formatTutar(h.tutar)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {pushDurum !== 'desteklenmiyor' && pushDurum !== 'aktif' && (
              <button
                onClick={handleBildirimAc}
                disabled={pushIsleniyor || pushDurum === 'reddedildi'}
                title={pushDurum === 'reddedildi' ? 'Tarayıcı ayarlarından bildirim izni vermeniz gerekiyor.' : undefined}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-bakery-surface py-2.5 text-sm font-medium text-bakery-ink-700 shadow-lg shadow-bakery-coffee-900/10 hover:bg-bakery-cream-50 disabled:opacity-50"
              >
                <Bell size={15} />
                {pushIsleniyor ? 'Açılıyor…' : 'Bildirimleri Aç'}
              </button>
            )}
            {pushDurum === 'aktif' && (
              <div className="flex items-center justify-center gap-1.5 rounded-2xl bg-bakery-surface py-2.5 text-sm font-medium text-bakery-success shadow-lg shadow-bakery-coffee-900/10">
                <BellRing size={15} />
                Bildirimler açık
              </div>
            )}

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
