import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Timestamp } from 'firebase/firestore'
import {
  useGunlukKayitlar,
  useGunlukOdemeler,
  gunlukKayitlarEkle,
  gunlukKaydiGuncelle,
  gunlukKaydiSil,
  gunlukOdemeEkle,
  gunlukOdemeGuncelle,
  gunlukOdemeSil,
  type GunlukKayitFormVerisi
} from './data'
import GunlukKayitFormModal from './GunlukKayitFormModal'
import GunlukOdemeFormModal from './GunlukOdemeFormModal'
import GunlukMusteriSecici from './GunlukMusteriSecici'
import DonemFiltre, { donemAraligiHesapla, type DonemAnahtari } from '../../shared/DonemFiltre'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import TutarGoster from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { useSession } from '../../lib/session'
import type { GunlukDurumu, GunlukKaydi, GunlukOdeme, GunlukOdemeFormVerisi } from '../../lib/types'

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

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
  musteriAdi: string
  tarih: string
  kayitlar: GunlukKaydi[]
}

// Aynı müşterinin aynı gün aldığı ürünler tek kartta (bkz. veresiye/OzetPage).
function gruplaByMusteriVeTarih(siraliKayitlar: GunlukKaydi[]): KayitGrubu[] {
  const gruplar: KayitGrubu[] = []
  const konumlar = new Map<string, number>()
  for (const k of siraliKayitlar) {
    const anahtar = `${k.musteriId}__${k.tarih}`
    let konum = konumlar.get(anahtar)
    if (konum === undefined) {
      konum = gruplar.length
      konumlar.set(anahtar, konum)
      gruplar.push({ anahtar, musteriAdi: k.musteriAdi, tarih: k.tarih, kayitlar: [] })
    }
    gruplar[konum].kayitlar.push(k)
  }
  return gruplar
}

function GunlukDurumRozeti({ durum }: { durum: GunlukDurumu }) {
  return durum === 'veresiye' ? (
    <span className="rounded-full bg-bakery-danger/10 px-2 py-0.5 text-xs font-medium text-bakery-danger">Veresiye</span>
  ) : (
    <span className="rounded-full bg-bakery-success/10 px-2 py-0.5 text-xs font-medium text-bakery-success">Ödendi</span>
  )
}

export default function GunlukVeresiyePage() {
  const session = useSession()
  const toast = useToast()

  const [donem, setDonem] = useState<DonemAnahtari>('bugun')
  const [ozelBaslangic, setOzelBaslangic] = useState(bugunStr())
  const [ozelBitis, setOzelBitis] = useState(bugunStr())
  const [musteriId, setMusteriId] = useState<string | null>(null)
  const [gorunum, setGorunum] = useState<'kayitlar' | 'odemeler'>('kayitlar')

  const [kayitFormAcik, setKayitFormAcik] = useState(false)
  const [duzenlenenKayit, setDuzenlenenKayit] = useState<GunlukKaydi | undefined>()
  const [silinecekKayit, setSilinecekKayit] = useState<GunlukKaydi | undefined>()

  const [odemeFormAcik, setOdemeFormAcik] = useState(false)
  const [duzenlenenOdeme, setDuzenlenenOdeme] = useState<GunlukOdeme | undefined>()
  const [silinecekOdeme, setSilinecekOdeme] = useState<GunlukOdeme | undefined>()

  const { baslangic, bitis } = donemAraligiHesapla(donem, ozelBaslangic, ozelBitis)
  const filtre = { baslangic, bitis, musteriId }

  const { kayitlar, yukleniyor: kayitYukleniyor, hata: kayitHata } = useGunlukKayitlar(filtre)
  const { odemeler: hamOdemeler, yukleniyor: odemeYukleniyor, hata: odemeHata } = useGunlukOdemeler(filtre)
  const siraliKayitlar = useMemo(() => enSonOnce(kayitlar), [kayitlar])
  const kayitGruplari = useMemo(() => gruplaByMusteriVeTarih(siraliKayitlar), [siraliKayitlar])
  const odemeler = useMemo(() => enSonOnce(hamOdemeler), [hamOdemeler])

  const toplamVeresiye = kayitlar.reduce((t, k) => t + (k.durum === 'veresiye' ? k.tutar : 0), 0)
  const toplamTahsilat = odemeler.reduce((t, o) => t + o.tutar, 0)

  if (session.status !== 'signed-in') return null
  const kullanici = { uid: session.user.uid }

  async function handleKayitKaydet(veri: GunlukKayitFormVerisi) {
    if (duzenlenenKayit) {
      await gunlukKaydiGuncelle(duzenlenenKayit, { ...veri, ...veri.kalemler[0] })
      toast.basari('Kayıt güncellendi.')
    } else {
      await gunlukKayitlarEkle(veri, kullanici)
      toast.basari('Kayıt eklendi.')
    }
  }

  async function handleKayitSil() {
    if (!silinecekKayit) return
    try {
      await gunlukKaydiSil(silinecekKayit)
      toast.basari('Kayıt silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setSilinecekKayit(undefined)
    }
  }

  async function handleOdemeKaydet(veri: GunlukOdemeFormVerisi) {
    if (duzenlenenOdeme) {
      await gunlukOdemeGuncelle(duzenlenenOdeme, veri)
      toast.basari('Ödeme güncellendi.')
    } else {
      await gunlukOdemeEkle(veri, kullanici)
      toast.basari('Ödeme eklendi.')
    }
  }

  async function handleOdemeSil() {
    if (!silinecekOdeme) return
    try {
      await gunlukOdemeSil(silinecekOdeme)
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
          <button
            onClick={() => {
              if (gorunum === 'kayitlar') {
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
            Yeni {gorunum === 'kayitlar' ? 'Kayıt' : 'Ödeme'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full max-w-xs">
            <GunlukMusteriSecici
              seciliMusteriId={musteriId}
              hepsiSecenegi
              onHepsiSec={() => setMusteriId(null)}
              onSec={(m) => setMusteriId(m.id)}
              placeholder="Tüm Müşteriler"
            />
          </div>
          <div className="flex rounded-lg bg-bakery-cream-100 p-1">
            <button
              onClick={() => setGorunum('kayitlar')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                gorunum === 'kayitlar' ? 'bg-bakery-surface text-bakery-ink-900 shadow-sm' : 'text-bakery-ink-500'
              }`}
            >
              Veresiyeler
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

        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <div className="rounded-xl bg-bakery-surface px-3 py-2 shadow-sm shadow-bakery-coffee-900/5">
            <p className="text-xs text-bakery-ink-500">Verilen veresiye</p>
            <p className="font-semibold text-bakery-danger">
              <TutarGoster tutar={toplamVeresiye} />
            </p>
          </div>
          <div className="rounded-xl bg-bakery-surface px-3 py-2 shadow-sm shadow-bakery-coffee-900/5">
            <p className="text-xs text-bakery-ink-500">Tahsilat</p>
            <p className="font-semibold text-bakery-success">
              <TutarGoster tutar={toplamTahsilat} />
            </p>
          </div>
        </div>
      </div>

      {gorunum === 'kayitlar' ? (
        kayitYukleniyor ? (
          <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
        ) : kayitlar.length === 0 ? (
          <BosDurum baslik="Bu aralıkta kayıt yok" />
        ) : (
          <div className="space-y-2">
            {kayitGruplari.map((grup) => (
              <div key={grup.anahtar} className="rounded-xl bg-bakery-surface p-3 shadow-sm shadow-bakery-coffee-900/5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-bakery-ink-900">{grup.musteriAdi}</p>
                  <span className="shrink-0 text-xs text-bakery-ink-400">{grup.tarih}</span>
                </div>
                <div className="divide-y divide-bakery-cream-100">
                  {grup.kayitlar.map((k) => (
                    <div key={k.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                      <span className="min-w-0 truncate text-bakery-ink-600">
                        {k.adet}× {k.urunAdi}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <GunlukDurumRozeti durum={k.durum} />
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
        )
      ) : odemeYukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : odemeler.length === 0 ? (
        <BosDurum baslik="Bu aralıkta ödeme yok" />
      ) : (
        <div className="space-y-2">
          {odemeler.map((o) => (
            <div key={o.id} className="flex items-center gap-2 rounded-xl bg-bakery-surface p-3 shadow-sm shadow-bakery-coffee-900/5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-bakery-ink-900">{o.musteriAdi}</p>
                <p className="truncate text-xs text-bakery-ink-500">
                  {o.tarih}
                  {o.not && ` · ${o.not}`}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-bakery-success">
                <TutarGoster tutar={o.tutar} />
              </span>
              <button
                onClick={() => {
                  setDuzenlenenOdeme(o)
                  setOdemeFormAcik(true)
                }}
                className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                aria-label="Düzenle"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => setSilinecekOdeme(o)}
                className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                aria-label="Sil"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {kayitFormAcik && (
        <GunlukKayitFormModal mevcut={duzenlenenKayit} onKaydet={handleKayitKaydet} onKapat={() => setKayitFormAcik(false)} />
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
        <GunlukOdemeFormModal mevcut={duzenlenenOdeme} onKaydet={handleOdemeKaydet} onKapat={() => setOdemeFormAcik(false)} />
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
