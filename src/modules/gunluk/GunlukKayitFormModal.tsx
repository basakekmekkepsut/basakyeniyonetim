import { useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import GunlukMusteriSecici from './GunlukMusteriSecici'
import { useUrunler } from '../urunler/data'
import { formatTutar } from '../../shared/TutarGoster'
import { gunlukFiyati } from '../../shared/gunlukFiyat'
import type { GunlukDurumu, GunlukKaydi } from '../../lib/types'
import type { GunlukKalem, GunlukKayitFormVerisi } from './data'

interface Props {
  mevcut?: GunlukKaydi
  varsayilanMusteri?: { id: string; ad: string }
  onKaydet: (veri: GunlukKayitFormVerisi) => Promise<void>
  onKapat: () => void
}

interface Satir {
  productId: string
  urunAdi: string
  adet: string
  birimFiyat: number
}

const BOS_SATIR: Satir = { productId: '', urunAdi: '', adet: '', birimFiyat: 0 }

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Yeni kayıtta müşterinin kasadan aynı anda aldığı birden fazla ürün tek seferde
 * girilebilir (her ürün ayrı gunluk_kayitlar belgesi olur). Düzenlemede tek satır.
 */
export default function GunlukKayitFormModal({ mevcut, varsayilanMusteri, onKaydet, onKapat }: Props) {
  const { urunler } = useUrunler()
  const [musteriId, setMusteriId] = useState(mevcut?.musteriId ?? varsayilanMusteri?.id ?? '')
  const [musteriAdi, setMusteriAdi] = useState(mevcut?.musteriAdi ?? varsayilanMusteri?.ad ?? '')
  const [tarih, setTarih] = useState(mevcut?.tarih ?? bugunStr())
  const [durum, setDurum] = useState<GunlukDurumu>(mevcut?.durum ?? 'veresiye')
  const [satirlar, setSatirlar] = useState<Satir[]>(
    mevcut
      ? [{ productId: mevcut.productId, urunAdi: mevcut.urunAdi, adet: String(mevcut.adet), birimFiyat: mevcut.birimFiyat }]
      : [BOS_SATIR]
  )
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const gunlukUrunleri = urunler.filter((u) => (u.aktif && u.modules.includes('gunluk')) || u.id === mevcut?.productId)
  const toplam = satirlar.reduce((t, s) => t + (Number(s.adet) || 0) * s.birimFiyat, 0)

  function satirGuncelle(i: number, degisiklik: Partial<Satir>) {
    setSatirlar((liste) => liste.map((s, j) => (j === i ? { ...s, ...degisiklik } : s)))
  }

  function urunSec(i: number, id: string) {
    const urun = urunler.find((u) => u.id === id)
    satirGuncelle(i, { productId: id, urunAdi: urun?.ad ?? '', birimFiyat: urun ? gunlukFiyati(urun) : 0 })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!musteriId) return setHata('Müşteri seçmelisiniz.')
    const doluSatirlar = satirlar.filter((s) => s.productId || s.adet)
    if (doluSatirlar.length === 0) return setHata('En az bir ürün girmelisiniz.')
    if (doluSatirlar.some((s) => !s.productId)) return setHata('Her satırda ürün seçmelisiniz.')
    if (doluSatirlar.some((s) => !(Number(s.adet) > 0))) return setHata('Adet 0’dan büyük olmalı.')
    setHata(null)
    setGonderiliyor(true)
    try {
      const kalemler: GunlukKalem[] = doluSatirlar.map((s) => ({
        productId: s.productId,
        urunAdi: s.urunAdi,
        adet: Number(s.adet),
        birimFiyat: Number(s.birimFiyat) || 0
      }))
      await onKaydet({ musteriId, musteriAdi, tarih, durum, kalemler })
      onKapat()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bakery-surface p-5 shadow-xl md:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-ink-900">{mevcut ? 'Kaydı Düzenle' : 'Yeni Günlük Veresiye'}</h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-ink-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Müşteri *</label>
              <GunlukMusteriSecici
                seciliMusteriId={musteriId || null}
                onSec={(m) => {
                  setMusteriId(m.id)
                  setMusteriAdi(m.ad)
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Tarih *</label>
              <input
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 text-sm outline-none focus:border-bakery-amber-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_4rem_5.5rem_2rem] gap-2 text-xs font-medium text-bakery-ink-500">
              <span>Ürün *</span>
              <span>Adet *</span>
              <span>Fiyat (₺)</span>
              <span />
            </div>
            {satirlar.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_4rem_5.5rem_2rem] items-center gap-2">
                <select
                  value={s.productId}
                  onChange={(e) => urunSec(i, e.target.value)}
                  className="w-full min-w-0 rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-2 text-sm outline-none focus:border-bakery-amber-500"
                >
                  <option value="">Seçin…</option>
                  {gunlukUrunleri.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.ad}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={s.adet}
                  onChange={(e) => satirGuncelle(i, { adet: e.target.value })}
                  className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-2 text-sm outline-none focus:border-bakery-amber-500"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={s.birimFiyat}
                  onChange={(e) => satirGuncelle(i, { birimFiyat: Number(e.target.value) })}
                  className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-2 text-sm outline-none focus:border-bakery-amber-500"
                />
                {satirlar.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setSatirlar((liste) => liste.filter((_, j) => j !== i))}
                    className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                    aria-label="Satırı kaldır"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            {!mevcut && (
              <button
                type="button"
                onClick={() => setSatirlar((liste) => [...liste, BOS_SATIR])}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-bakery-amber-600 hover:bg-bakery-amber-500/10"
              >
                <Plus size={15} />
                Ürün Ekle
              </button>
            )}
            {gunlukUrunleri.length === 0 && (
              <p className="text-xs text-bakery-ink-500">
                Henüz "Günlük" işaretli ürün yok — Günlük Veresiye &gt; Ürünler’den ekleyin.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800">Durum</label>
            <div className="flex gap-2">
              {(
                [
                  ['veresiye', 'Veresiye'],
                  ['odendi', 'Ödendi']
                ] as const
              ).map(([key, etiket]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setDurum(key)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    durum === key ? 'bg-bakery-amber-600 text-white' : 'bg-bakery-cream-100 text-bakery-ink-600 hover:bg-bakery-cream-200'
                  }`}
                >
                  {etiket}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-bakery-cream-50 px-3 py-2 text-sm">
            <span className="text-bakery-ink-600">Toplam</span>
            <span className="font-semibold text-bakery-ink-900">{formatTutar(toplam)}</span>
          </div>

          {hata && <p className="rounded-lg bg-bakery-danger/10 px-3 py-2 text-sm text-bakery-danger">{hata}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onKapat} className="rounded-lg px-4 py-2 text-sm font-medium text-bakery-ink-600 hover:bg-bakery-cream-100">
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
