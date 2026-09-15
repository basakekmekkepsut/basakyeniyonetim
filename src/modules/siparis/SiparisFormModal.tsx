import { useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import MusteriSecici from '../../shared/MusteriSecici'
import ConfirmModal from '../../shared/ConfirmModal'
import { formatTutar } from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { useUrunler } from '../urunler/data'
import { useMusteriler, serbestMusteriBulYaOlustur, musteriKaliciYap } from '../musteriler/data'
import { musteriSiparisSayisi } from './data'
import { unHesabiAktifMi } from '../../shared/unHesabi'
import type { OdemeSekli, Siparis, SiparisFormVerisi, SiparisKalemi } from '../../lib/types'

// "Bu isimle sık sipariş alınıyor" önerisinin tetiklendiği sipariş sayısı eşiği.
const ONERI_ESIGI = 3

interface Props {
  mevcut?: Siparis
  baslik?: string
  varsayilanTarih?: string
  onKaydet: (veri: SiparisFormVerisi) => Promise<void>
  onKapat: () => void
}

function bosKalem(): SiparisKalemi {
  return { productId: '', urunAdi: '', adet: 1, birimFiyat: 0 }
}

export default function SiparisFormModal({ mevcut, baslik, varsayilanTarih, onKaydet, onKapat }: Props) {
  const { urunler } = useUrunler()
  const { musteriler } = useMusteriler()
  const toast = useToast()
  const [girisModu, setGirisModu] = useState<'kayitli' | 'serbest'>('kayitli')
  const [musteriId, setMusteriId] = useState(mevcut?.musteriId ?? '')
  const [musteriAdi, setMusteriAdi] = useState(mevcut?.musteriAdi ?? '')
  const [serbestAd, setSerbestAd] = useState('')
  const [adres, setAdres] = useState(mevcut?.adres ?? '')
  const [telefon, setTelefon] = useState(mevcut?.telefon ?? '')
  const [not, setNot] = useState(mevcut?.not ?? '')
  const [teslimatTarihi, setTeslimatTarihi] = useState(mevcut?.teslimatTarihi ?? varsayilanTarih ?? '')
  const [items, setItems] = useState<SiparisKalemi[]>(mevcut?.items ?? [bosKalem()])
  const [odemeSekli, setOdemeSekli] = useState<OdemeSekli>(mevcut?.odemeSekli ?? 'veresiye')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [oneriMusteri, setOneriMusteri] = useState<{ id: string; ad: string; sayi: number } | null>(null)
  const [oneriIsleniyor, setOneriIsleniyor] = useState(false)

  const siparisUrunleri = urunler.filter((u) => u.aktif && u.modules.includes('siparis'))
  const seciliMusteri = musteriler.find((m) => m.id === musteriId)
  const unMusterisi = unHesabiAktifMi(seciliMusteri)
  const toplam = items.reduce((s, i) => s + i.adet * i.birimFiyat, 0)

  function kalemGuncelle(index: number, degisiklik: Partial<SiparisKalemi>) {
    setItems((prev) => prev.map((k, i) => (i === index ? { ...k, ...degisiklik } : k)))
  }

  function urunSec(index: number, productId: string) {
    const urun = urunler.find((u) => u.id === productId)
    const birimFiyat = seciliMusteri?.ozelFiyatlar[productId] ?? urun?.fiyat ?? 0
    kalemGuncelle(index, { productId, urunAdi: urun?.ad ?? '', birimFiyat })
  }

  function satirEkle() {
    setItems((prev) => [...prev, bosKalem()])
  }

  function satirSil(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (girisModu === 'kayitli' && !musteriId) {
      setHata('Müşteri seçmelisiniz.')
      return
    }
    if (girisModu === 'serbest' && !serbestAd.trim()) {
      setHata('İsim girmelisiniz.')
      return
    }
    if (!teslimatTarihi) {
      setHata('Teslimat tarihi zorunludur.')
      return
    }
    const gecerliItems = items.filter((i) => i.productId && i.adet > 0)
    if (gecerliItems.length === 0) {
      setHata('En az bir ürün satırı eklemelisiniz.')
      return
    }
    setHata(null)
    setGonderiliyor(true)
    try {
      let gonderilecekMusteriId = musteriId
      let gonderilecekMusteriAdi = musteriAdi

      if (girisModu === 'serbest') {
        const ad = serbestAd.trim()
        const sonuc = await serbestMusteriBulYaOlustur(ad)
        gonderilecekMusteriId = sonuc.id
        gonderilecekMusteriAdi = ad
      }

      await onKaydet({
        musteriId: gonderilecekMusteriId,
        musteriAdi: gonderilecekMusteriAdi,
        adres: adres.trim(),
        telefon: telefon.trim(),
        not: not.trim(),
        teslimatTarihi,
        items: gecerliItems,
        odemeSekli
      })

      if (girisModu === 'serbest') {
        try {
          const sayi = await musteriSiparisSayisi(gonderilecekMusteriId)
          if (sayi >= ONERI_ESIGI) {
            setOneriMusteri({ id: gonderilecekMusteriId, ad: gonderilecekMusteriAdi, sayi })
            return // öneri modalı gösterilecek; kullanıcı karar verince kapatılır
          }
        } catch {
          // Sipariş sayısı sorgusu izin yetersizliğinden başarısız olabilir (örn. sadece
          // "kendi siparişini görebilir" personel) — bu durumda öneri sessizce atlanır.
        }
      }
      onKapat()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  async function handleKaliciYap() {
    if (!oneriMusteri) return
    setOneriIsleniyor(true)
    try {
      await musteriKaliciYap(oneriMusteri.id)
      toast.basari(`"${oneriMusteri.ad}" kalıcı müşteri olarak kaydedildi.`)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Kalıcı müşteri yapılamadı.')
    } finally {
      setOneriIsleniyor(false)
      setOneriMusteri(null)
      onKapat()
    }
  }

  if (oneriMusteri) {
    return (
      <ConfirmModal
        baslik="Kalıcı Müşteri Yap"
        mesaj={`"${oneriMusteri.ad}" ismiyle bu sefer ${oneriMusteri.sayi}. kez sipariş alındı. Bu kişiyi kalıcı müşteri olarak kaydetmek ister misiniz? Geçmiş siparişleri otomatik olarak bu profile bağlı kalır.`}
        onayEtiketi={oneriIsleniyor ? 'Kaydediliyor…' : 'Kalıcı Müşteri Yap'}
        onOnayla={handleKaliciYap}
        onVazgec={() => {
          setOneriMusteri(null)
          onKapat()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl md:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-coffee-900">
            {baslik ?? (mevcut ? 'Siparişi Düzenle' : 'Yeni Sipariş')}
          </h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-coffee-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-bakery-coffee-800">Müşteri *</label>
              {!mevcut && (
                <div className="flex gap-1">
                  {(
                    [
                      ['kayitli', 'Kayıtlı Müşteri'],
                      ['serbest', 'Serbest / Geçici İsim']
                    ] as const
                  ).map(([key, etiket]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setGirisModu(key)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        girisModu === key ? 'bg-bakery-amber-600 text-white' : 'bg-bakery-cream-100 text-bakery-coffee-600 hover:bg-bakery-cream-200'
                      }`}
                    >
                      {etiket}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {girisModu === 'kayitli' ? (
              <MusteriSecici
                modul="siparis"
                seciliMusteriId={musteriId || null}
                onSec={(m) => {
                  setMusteriId(m.id)
                  setMusteriAdi(m.ad)
                  setAdres((mevcutAdres) => mevcutAdres || m.adres)
                  setTelefon((mevcutTel) => mevcutTel || m.telefon)
                }}
              />
            ) : (
              <div>
                <input
                  type="text"
                  value={serbestAd}
                  onChange={(e) => setSerbestAd(e.target.value)}
                  placeholder="Örn. Yoldan geçen müşteri, Ahmet Usta'nın çırağı…"
                  className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
                />
                <p className="mt-1 text-xs text-bakery-coffee-500">
                  Kayıtlı olmayan/tek seferlik bir isim — "Geçici Müşteri" olarak kaydedilir. Aynı isimle sık sipariş
                  alınırsa sistem kalıcı müşteri yapmayı önerecektir.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Teslimat Tarihi *</label>
              <input
                type="date"
                value={teslimatTarihi}
                onChange={(e) => setTeslimatTarihi(e.target.value)}
                required
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Telefon</label>
              <input
                type="tel"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Teslimat Adresi</label>
            <input
              type="text"
              value={adres}
              onChange={(e) => setAdres(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-bakery-coffee-800">Ürünler *</label>
            <div className="space-y-2">
              {items.map((kalem, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={kalem.productId}
                    onChange={(e) => urunSec(i, e.target.value)}
                    className="flex-1 rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-2 text-sm outline-none focus:border-bakery-amber-500"
                  >
                    <option value="">Ürün seçin…</option>
                    {siparisUrunleri.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.ad}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={kalem.adet}
                    onChange={(e) => kalemGuncelle(i, { adet: Number(e.target.value) })}
                    className="w-16 rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-2 text-center text-sm outline-none focus:border-bakery-amber-500"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={kalem.birimFiyat}
                    onChange={(e) => kalemGuncelle(i, { birimFiyat: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-2 text-right text-sm outline-none focus:border-bakery-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => satirSil(i)}
                    className="rounded-lg p-2 text-bakery-danger hover:bg-bakery-danger/10"
                    aria-label="Satırı sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={satirEkle}
              className="mt-2 flex items-center gap-1 text-sm font-medium text-bakery-amber-600 hover:text-bakery-amber-500"
            >
              <Plus size={14} />
              Satır Ekle
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Not</label>
            <input
              type="text"
              value={not}
              onChange={(e) => setNot(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>

          {unMusterisi ? (
            <p className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm text-blue-700">
              Bu müşteri Un Hesabı ile takip ediliyor — bu sipariş ücretsiz sayılıp otomatik olarak un hesabına eklenecek.
            </p>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-bakery-coffee-800">Ödeme Şekli</label>
              <div className="flex gap-2">
                {(
                  [
                    ['veresiye', 'Veresiye'],
                    ['nakit', 'Nakit']
                  ] as const
                ).map(([key, etiket]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setOdemeSekli(key)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      odemeSekli === key ? 'bg-bakery-amber-600 text-white' : 'bg-bakery-cream-100 text-bakery-coffee-600 hover:bg-bakery-cream-200'
                    }`}
                  >
                    {etiket}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-bakery-coffee-500">
                Bu sipariş otomatik olarak müşterinin Veresiye/Cari hesabına yansır.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-bakery-cream-50 px-3 py-2.5">
            <span className="text-sm font-medium text-bakery-coffee-700">Toplam</span>
            <span className="text-lg font-semibold text-bakery-coffee-900">{formatTutar(toplam)}</span>
          </div>

          {hata && <p className="rounded-lg bg-bakery-danger/10 px-3 py-2 text-sm text-bakery-danger">{hata}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onKapat} className="rounded-lg px-4 py-2 text-sm font-medium text-bakery-coffee-600 hover:bg-bakery-cream-100">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={gonderiliyor}
            className="rounded-lg bg-bakery-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500 disabled:opacity-60"
          >
            {gonderiliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
