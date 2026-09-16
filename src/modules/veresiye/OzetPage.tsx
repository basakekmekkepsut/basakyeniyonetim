import { useMemo, useState } from 'react'
import { BarChart2, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Timestamp } from 'firebase/firestore'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useVeresiyeKayitlar, veresiyeKaydiEkle, veresiyeKaydiGuncelle, veresiyeKaydiSil } from './data'
import { useVeresiyeOdemeler, odemeEkle, odemeGuncelle, odemeSil } from './odemeData'
import VeresiyeKayitFormModal from './VeresiyeKayitFormModal'
import VeresiyeOdemeFormModal from './VeresiyeOdemeFormModal'
import DonemFiltre, { donemAraligiHesapla, type DonemAnahtari } from '../../shared/DonemFiltre'
import MusteriSecici from '../../shared/MusteriSecici'
import DurumRozeti from '../../shared/DurumRozeti'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import TutarGoster from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { isAdmin, useSession } from '../../lib/session'
import { useVeresiyeMusteriFiltresi } from '../../shared/veresiyeErisim'
import type { VeresiyeKaydi, VeresiyeOdeme } from '../../lib/types'

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

// veresiye_kayitlar/veresiye_odemeler her zaman olusturmaTarihi (serverTimestamp) ile
// yazılır, ama bu özellikten önce oluşturulmuş eski kayıtlarda bu alan yoktur — bu
// yüzden VeresiyeKaydi/VeresiyeOdeme tiplerine eklenmez, yalnızca sıralama için
// gevşek tipli olarak okunur (eksikse en eski kabul edilir).
type ZamanDamgali = { tarih: string; olusturmaTarihi?: Timestamp | null }

function enSonOnce<T extends ZamanDamgali>(liste: T[]): T[] {
  return [...liste].sort((a, b) => {
    if (a.tarih !== b.tarih) return b.tarih.localeCompare(a.tarih)
    const am = a.olusturmaTarihi?.toMillis?.() ?? 0
    const bm = b.olusturmaTarihi?.toMillis?.() ?? 0
    return bm - am
  })
}

interface KayitGrubu {
  anahtar: string
  musteriId: string
  musteriAdi: string
  tarih: string
  kayitlar: VeresiyeKaydi[]
}

// Aynı müşterinin aynı gün aldığı farklı ürünleri tek kartta birleştirir —
// kart, grubun en son girilen kaydının konumuna yerleşir (bkz. enSonOnce).
function gruplaByMusteriVeTarih(siraliKayitlar: VeresiyeKaydi[]): KayitGrubu[] {
  const gruplar: KayitGrubu[] = []
  const konumlar = new Map<string, number>()
  for (const k of siraliKayitlar) {
    const anahtar = `${k.musteriId}__${k.tarih}`
    let konum = konumlar.get(anahtar)
    if (konum === undefined) {
      konum = gruplar.length
      konumlar.set(anahtar, konum)
      gruplar.push({ anahtar, musteriId: k.musteriId, musteriAdi: k.musteriAdi, tarih: k.tarih, kayitlar: [] })
    }
    gruplar[konum].kayitlar.push(k)
  }
  return gruplar
}

export default function OzetPage() {
  const session = useSession()
  const toast = useToast()

  const [donem, setDonem] = useState<DonemAnahtari>('bu_ay')
  const [ozelBaslangic, setOzelBaslangic] = useState(bugunStr())
  const [ozelBitis, setOzelBitis] = useState(bugunStr())
  const [musteriId, setMusteriId] = useState<string | null>(null)
  const [gorunum, setGorunum] = useState<'teslimatlar' | 'odemeler'>('teslimatlar')
  const [kaynakFiltre, setKaynakFiltre] = useState<'tumu' | 'siparis' | 'veresiye'>('tumu')
  const [grafikAcik, setGrafikAcik] = useState(false)

  const [kayitFormAcik, setKayitFormAcik] = useState(false)
  const [duzenlenenKayit, setDuzenlenenKayit] = useState<VeresiyeKaydi | undefined>()
  const [silinecekKayit, setSilinecekKayit] = useState<VeresiyeKaydi | undefined>()

  const [odemeFormAcik, setOdemeFormAcik] = useState(false)
  const [duzenlenenOdeme, setDuzenlenenOdeme] = useState<VeresiyeOdeme | undefined>()
  const [silinecekOdeme, setSilinecekOdeme] = useState<VeresiyeOdeme | undefined>()

  const admin = session.status === 'signed-in' && isAdmin(session.profile)
  const musteriErisimi = useVeresiyeMusteriFiltresi()
  const { baslangic: hesaplananBaslangic, bitis } = donemAraligiHesapla(donem, ozelBaslangic, ozelBitis)

  // Personel için Özet geçmişe dönük en fazla son 7 günü kapsar — hangi dönem
  // seçilirse seçilsin (Bu Ay, Tüm Tarihler vb.) sorgu bu tarihten geriye gitmez.
  const enEskiTarihPersonel = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d.toISOString().slice(0, 10)
  })()
  const baslangic =
    admin || (hesaplananBaslangic && hesaplananBaslangic >= enEskiTarihPersonel) ? hesaplananBaslangic : enEskiTarihPersonel
  const personelKistlamasiUygulandi = !admin && baslangic !== hesaplananBaslangic

  const filtre = { baslangic, bitis, musteriId }

  // NOT: Teslimatlar (kayitlar) kişi bazlı müşteri kısıtlamasına TABİ DEĞİL — tek
  // sınır yukarıdaki 7 günlük zaman aralığı (bkz. enEskiTarihPersonel). Personel
  // tüm müşterilerin son 1 haftalık teslimat hareketini görebilir. Ödemeler ise
  // daha hassas kabul edildiği için ayrıca kişi bazlı yetkiye (musteriErisimi)
  // tabi — personel yalnızca kendisine atanmış müşterilerin ödemesini görür.
  const { kayitlar: tumKayitlar, yukleniyor: kayitYukleniyor, hata: kayitHata } = useVeresiyeKayitlar(filtre)
  const { odemeler: tumOdemeler, yukleniyor: odemeYukleniyor, hata: odemeHata } = useVeresiyeOdemeler(filtre)
  const kayitlar = useMemo(
    () =>
      tumKayitlar.filter((k) => {
        if (kaynakFiltre === 'siparis') return k.girisYontemi === 'siparis'
        if (kaynakFiltre === 'veresiye') return k.girisYontemi !== 'siparis'
        return true
      }),
    [tumKayitlar, kaynakFiltre]
  )
  const odemeler = useMemo(
    () => enSonOnce(tumOdemeler.filter((o) => musteriErisimi({ id: o.musteriId }))),
    [tumOdemeler, musteriErisimi]
  )
  const siraliKayitlar = useMemo(() => enSonOnce(kayitlar), [kayitlar])
  const kayitGruplari = useMemo(() => gruplaByMusteriVeTarih(siraliKayitlar), [siraliKayitlar])

  const grafikVerisi = useMemo(() => {
    const gunlukMap = new Map<string, { tarih: string; borc: number; tahsilat: number }>()
    for (const k of kayitlar) {
      if (k.durum !== 'veresiye') continue
      const g = gunlukMap.get(k.tarih) ?? { tarih: k.tarih, borc: 0, tahsilat: 0 }
      g.borc += k.tutar
      gunlukMap.set(k.tarih, g)
    }
    for (const o of odemeler) {
      const g = gunlukMap.get(o.tarih) ?? { tarih: o.tarih, borc: 0, tahsilat: 0 }
      g.tahsilat += o.tutar
      gunlukMap.set(o.tarih, g)
    }
    return [...gunlukMap.values()].sort((a, b) => a.tarih.localeCompare(b.tarih))
  }, [kayitlar, odemeler])

  if (session.status !== 'signed-in') return null
  const kullanici = { uid: session.user.uid }

  async function handleKayitKaydet(veri: Parameters<typeof veresiyeKaydiEkle>[0]) {
    if (duzenlenenKayit) {
      await veresiyeKaydiGuncelle(duzenlenenKayit, veri)
      toast.basari('Kayıt güncellendi.')
    } else {
      await veresiyeKaydiEkle(veri, kullanici)
      toast.basari('Kayıt eklendi.')
    }
  }

  async function handleKayitSil() {
    if (!silinecekKayit) return
    try {
      await veresiyeKaydiSil(silinecekKayit)
      toast.basari('Kayıt silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setSilinecekKayit(undefined)
    }
  }

  async function handleOdemeKaydet(veri: Parameters<typeof odemeEkle>[0]) {
    if (duzenlenenOdeme) {
      await odemeGuncelle(duzenlenenOdeme, veri)
      toast.basari('Ödeme güncellendi.')
    } else {
      await odemeEkle(veri, kullanici)
      toast.basari('Ödeme eklendi.')
    }
  }

  async function handleOdemeSil() {
    if (!silinecekOdeme) return
    try {
      await odemeSil(silinecekOdeme)
      toast.basari('Ödeme silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setSilinecekOdeme(undefined)
    }
  }

  const hata = kayitHata || odemeHata
  if (hata) return <p className="rounded-lg bg-bakery-danger/10 px-4 py-3 text-sm text-bakery-danger">{hata}</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DonemFiltre
            secili={donem}
            onSeciliDegis={setDonem}
            ozelBaslangic={ozelBaslangic}
            ozelBitis={ozelBitis}
            onOzelBaslangicDegis={setOzelBaslangic}
            onOzelBitisDegis={setOzelBitis}
            gecmisOdakli
          />
          <div className="flex gap-2">
            <button
              onClick={() => setGrafikAcik((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                grafikAcik ? 'bg-bakery-coffee-700 text-white' : 'bg-bakery-cream-100 text-bakery-ink-600 hover:bg-bakery-cream-200'
              }`}
            >
              <BarChart2 size={16} />
              Grafiksel Özet
            </button>
            <button
              onClick={() => {
                if (gorunum === 'teslimatlar') {
                  setDuzenlenenKayit(undefined)
                  setKayitFormAcik(true)
                } else {
                  setDuzenlenenOdeme(undefined)
                  setOdemeFormAcik(true)
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500"
            >
              <Plus size={16} />
              Yeni {gorunum === 'teslimatlar' ? 'Kayıt' : 'Ödeme'}
            </button>
          </div>
        </div>

        {personelKistlamasiUygulandi && (
          <p className="text-xs text-bakery-ink-500">
            Personel görünümü geçmişe dönük en fazla son 7 günü kapsar — daha eski kayıtlar için bir yöneticiye danışın.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full max-w-xs">
            <MusteriSecici
              modul="veresiye"
              seciliMusteriId={musteriId}
              hepsiSecenegi
              onHepsiSec={() => setMusteriId(null)}
              onSec={(m) => setMusteriId(m.id)}
              placeholder="Tüm Müşteriler"
            />
          </div>
          <div className="flex rounded-lg bg-bakery-cream-100 p-1">
            <button
              onClick={() => setGorunum('teslimatlar')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                gorunum === 'teslimatlar' ? 'bg-bakery-surface text-bakery-ink-900 shadow-sm' : 'text-bakery-ink-500'
              }`}
            >
              Teslimatlar
            </button>
            <button
              onClick={() => setGorunum('odemeler')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                gorunum === 'odemeler' ? 'bg-bakery-surface text-bakery-ink-900 shadow-sm' : 'text-bakery-ink-500'
              }`}
            >
              Ödemeler
            </button>
          </div>
        </div>

        {gorunum === 'teslimatlar' && (
          <div className="flex rounded-lg bg-bakery-cream-100 p-1 w-fit">
            <button
              onClick={() => setKaynakFiltre('tumu')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                kaynakFiltre === 'tumu' ? 'bg-bakery-surface text-bakery-ink-900 shadow-sm' : 'text-bakery-ink-500'
              }`}
            >
              Tümü
            </button>
            <button
              onClick={() => setKaynakFiltre('siparis')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                kaynakFiltre === 'siparis' ? 'bg-bakery-surface text-bakery-ink-900 shadow-sm' : 'text-bakery-ink-500'
              }`}
            >
              Siparişten Gelen
            </button>
            <button
              onClick={() => setKaynakFiltre('veresiye')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                kaynakFiltre === 'veresiye' ? 'bg-bakery-surface text-bakery-ink-900 shadow-sm' : 'text-bakery-ink-500'
              }`}
            >
              Doğrudan Veresiye
            </button>
          </div>
        )}
      </div>

      {grafikAcik && (
        <div className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
          <h3 className="mb-3 text-sm font-semibold text-bakery-ink-800">Borç / Tahsilat Trend</h3>
          {grafikVerisi.length === 0 ? (
            <p className="text-sm text-bakery-ink-400">Bu aralıkta veri yok.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={grafikVerisi}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ddbc" />
                <XAxis dataKey="tarih" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="borc" name="Borç" fill="#c9711f" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tahsilat" name="Tahsilat" fill="#3f7d4a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {gorunum === 'teslimatlar' ? (
        kayitYukleniyor ? (
          <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
        ) : kayitlar.length === 0 ? (
          <BosDurum baslik="Bu aralıkta kayıt yok" />
        ) : (
          <>
            {/* Mobil: kart görünümü — aynı müşterinin aynı gün aldığı ürünler tek kartta */}
            <div className="space-y-2 md:hidden">
              {kayitGruplari.map((grup) => (
                <div key={grup.anahtar} className="rounded-xl bg-bakery-surface p-3 shadow-sm shadow-bakery-coffee-900/5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-bakery-ink-900">{grup.musteriAdi}</p>
                    <span className="shrink-0 text-xs text-bakery-ink-400">{grup.tarih}</span>
                  </div>
                  <div className="divide-y divide-bakery-cream-100">
                    {grup.kayitlar.map((k) => (
                      <div key={k.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-bakery-ink-600">
                          {k.adet}× {k.urunAdi}
                          {k.girisYontemi === 'siparis' && (
                            <span className="shrink-0 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                              Sipariş
                            </span>
                          )}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <DurumRozeti durum={k.durum} />
                          <span className="font-semibold text-bakery-ink-900">
                            <TutarGoster tutar={k.tutar} />
                          </span>
                          <button
                            onClick={() => {
                              setDuzenlenenKayit(k)
                              setKayitFormAcik(true)
                            }}
                            className="rounded p-1 text-bakery-ink-400 hover:bg-bakery-cream-100"
                            aria-label="Düzenle"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setSilinecekKayit(k)}
                            className="rounded p-1 text-bakery-danger hover:bg-bakery-danger/10"
                            aria-label="Sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Masaüstü: tablo görünümü */}
            <div className="hidden overflow-x-auto rounded-xl bg-bakery-surface shadow-sm shadow-bakery-coffee-900/5 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bakery-cream-100 text-left text-bakery-ink-500">
                    <th className="px-4 py-3 font-medium">Tarih</th>
                    <th className="px-4 py-3 font-medium">Müşteri</th>
                    <th className="px-4 py-3 font-medium">Tür</th>
                    <th className="px-4 py-3 font-medium">Adet</th>
                    <th className="px-4 py-3 font-medium">Tutar</th>
                    <th className="px-4 py-3 font-medium">Durum</th>
                    <th className="px-4 py-3 font-medium">Kaynak</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {siraliKayitlar.map((k) => (
                    <tr key={k.id} className="border-b border-bakery-cream-100 last:border-0">
                      <td className="px-4 py-3 text-bakery-ink-600">{k.tarih}</td>
                      <td className="px-4 py-3 font-medium text-bakery-ink-900">{k.musteriAdi}</td>
                      <td className="px-4 py-3 text-bakery-ink-600">{k.urunAdi}</td>
                      <td className="px-4 py-3 text-bakery-ink-600">{k.adet}</td>
                      <td className="px-4 py-3">
                        <TutarGoster tutar={k.tutar} />
                      </td>
                      <td className="px-4 py-3">
                        <DurumRozeti durum={k.durum} />
                      </td>
                      <td className="px-4 py-3">
                        {k.girisYontemi === 'siparis' ? (
                          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">Sipariş</span>
                        ) : (
                          <span className="text-xs text-bakery-ink-400">Veresiye</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setDuzenlenenKayit(k)
                              setKayitFormAcik(true)
                            }}
                            className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                            aria-label="Düzenle"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setSilinecekKayit(k)}
                            className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                            aria-label="Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : odemeYukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : odemeler.length === 0 ? (
        <BosDurum baslik="Bu aralıkta ödeme yok" />
      ) : (
        <>
          {/* Mobil: kart görünümü */}
          <div className="space-y-2 md:hidden">
            {odemeler.map((o) => (
              <div key={o.id} className="rounded-xl bg-bakery-surface p-3.5 shadow-sm shadow-bakery-coffee-900/5">
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-bakery-ink-900">{o.musteriAdi}</p>
                    <p className="text-xs text-bakery-ink-500">{o.tarih}</p>
                  </div>
                  <span className="font-semibold text-bakery-success">
                    <TutarGoster tutar={o.tutar} />
                  </span>
                </div>
                {o.not && <p className="mb-2 text-sm text-bakery-ink-500">{o.not}</p>}
                <div className="flex justify-end gap-1 border-t border-bakery-cream-100 pt-2">
                  <button
                    onClick={() => {
                      setDuzenlenenOdeme(o)
                      setOdemeFormAcik(true)
                    }}
                    className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                    aria-label="Düzenle"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setSilinecekOdeme(o)}
                    className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                    aria-label="Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Masaüstü: tablo görünümü */}
          <div className="hidden overflow-x-auto rounded-xl bg-bakery-surface shadow-sm shadow-bakery-coffee-900/5 md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bakery-cream-100 text-left text-bakery-ink-500">
                  <th className="px-4 py-3 font-medium">Tarih</th>
                  <th className="px-4 py-3 font-medium">Müşteri</th>
                  <th className="px-4 py-3 font-medium">Tutar</th>
                  <th className="px-4 py-3 font-medium">Not</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {odemeler.map((o) => (
                  <tr key={o.id} className="border-b border-bakery-cream-100 last:border-0">
                    <td className="px-4 py-3 text-bakery-ink-600">{o.tarih}</td>
                    <td className="px-4 py-3 font-medium text-bakery-ink-900">{o.musteriAdi}</td>
                    <td className="px-4 py-3 text-bakery-success">
                      <TutarGoster tutar={o.tutar} />
                    </td>
                    <td className="px-4 py-3 text-bakery-ink-500">{o.not}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setDuzenlenenOdeme(o)
                            setOdemeFormAcik(true)
                          }}
                          className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                          aria-label="Düzenle"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setSilinecekOdeme(o)}
                          className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                          aria-label="Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {kayitFormAcik && (
        <VeresiyeKayitFormModal mevcut={duzenlenenKayit} onKaydet={handleKayitKaydet} onKapat={() => setKayitFormAcik(false)} />
      )}
      {silinecekKayit && (
        <ConfirmModal
          baslik="Kaydı sil"
          mesaj={`"${silinecekKayit.musteriAdi}" için ${silinecekKayit.urunAdi} kaydını silmek istediğinize emin misiniz?`}
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleKayitSil}
          onVazgec={() => setSilinecekKayit(undefined)}
        />
      )}

      {odemeFormAcik && (
        <VeresiyeOdemeFormModal mevcut={duzenlenenOdeme} onKaydet={handleOdemeKaydet} onKapat={() => setOdemeFormAcik(false)} />
      )}
      {silinecekOdeme && (
        <ConfirmModal
          baslik="Ödemeyi sil"
          mesaj={`"${silinecekOdeme.musteriAdi}" ödemesini silmek istediğinize emin misiniz?`}
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleOdemeSil}
          onVazgec={() => setSilinecekOdeme(undefined)}
        />
      )}
    </div>
  )
}
