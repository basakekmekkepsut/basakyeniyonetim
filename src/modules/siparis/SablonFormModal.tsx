import { useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import MusteriSecici from '../../shared/MusteriSecici'
import { useUrunler } from '../urunler/data'
import type { SiparisSablonu, SiparisSablonuFormVerisi } from '../../lib/types'

const GUN_ETIKETLERI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

interface Props {
  mevcut?: SiparisSablonu
  onKaydet: (veri: SiparisSablonuFormVerisi) => Promise<void>
  onKapat: () => void
}

export default function SablonFormModal({ mevcut, onKaydet, onKapat }: Props) {
  const { urunler } = useUrunler()
  const [musteriId, setMusteriId] = useState(mevcut?.musteriId ?? '')
  const [musteriAdi, setMusteriAdi] = useState(mevcut?.musteriAdi ?? '')
  const [adres, setAdres] = useState(mevcut?.adres ?? '')
  const [not, setNot] = useState(mevcut?.not ?? '')
  const [items, setItems] = useState<{ productId: string; adet: number }[]>(
    mevcut?.items ?? [{ productId: '', adet: 1 }]
  )
  const [gunler, setGunler] = useState<number[]>(mevcut?.gunler ?? [])
  const [bitisTarihi, setBitisTarihi] = useState(mevcut?.bitisTarihi ?? '')
  const [aktif, setAktif] = useState(mevcut?.aktif ?? true)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const siparisUrunleri = urunler.filter((u) => u.aktif && u.modules.includes('siparis'))

  function gunToggle(g: number) {
    setGunler((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort()))
  }

  function satirEkle() {
    setItems((prev) => [...prev, { productId: '', adet: 1 }])
  }

  function satirSil(i: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!musteriId) {
      setHata('Müşteri seçmelisiniz.')
      return
    }
    if (gunler.length === 0) {
      setHata('En az bir gün seçmelisiniz.')
      return
    }
    const gecerliItems = items.filter((i) => i.productId && i.adet > 0)
    if (gecerliItems.length === 0) {
      setHata('En az bir ürün eklemelisiniz.')
      return
    }
    setHata(null)
    setGonderiliyor(true)
    try {
      await onKaydet({
        musteriId,
        musteriAdi,
        adres: adres.trim(),
        not: not.trim(),
        items: gecerliItems,
        gunler,
        bitisTarihi: bitisTarihi || null,
        aktif
      })
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
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl md:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-coffee-900">{mevcut ? 'Şablonu Düzenle' : 'Yeni Şablon'}</h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-coffee-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Müşteri *</label>
            <MusteriSecici
              modul="siparis"
              seciliMusteriId={musteriId || null}
              onSec={(m) => {
                setMusteriId(m.id)
                setMusteriAdi(m.ad)
                setAdres((mevcutAdres) => mevcutAdres || m.adres)
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Adres</label>
            <input
              type="text"
              value={adres}
              onChange={(e) => setAdres(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-bakery-coffee-800">Hangi günler tekrarlansın? *</label>
            <div className="flex flex-wrap gap-1.5">
              {GUN_ETIKETLERI.map((etiket, g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => gunToggle(g)}
                  className={`h-9 w-12 rounded-lg text-sm font-medium transition ${
                    gunler.includes(g) ? 'bg-bakery-amber-600 text-white' : 'bg-bakery-cream-100 text-bakery-coffee-600 hover:bg-bakery-cream-200'
                  }`}
                >
                  {etiket}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-bakery-coffee-800">Ürünler *</label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={it.productId}
                    onChange={(e) =>
                      setItems((prev) => prev.map((k, idx) => (idx === i ? { ...k, productId: e.target.value } : k)))
                    }
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
                    value={it.adet}
                    onChange={(e) =>
                      setItems((prev) => prev.map((k, idx) => (idx === i ? { ...k, adet: Number(e.target.value) } : k)))
                    }
                    className="w-16 rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-2 text-center text-sm outline-none focus:border-bakery-amber-500"
                  />
                  <button type="button" onClick={() => satirSil(i)} className="rounded-lg p-2 text-bakery-danger hover:bg-bakery-danger/10">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={satirEkle} className="mt-2 flex items-center gap-1 text-sm font-medium text-bakery-amber-600 hover:text-bakery-amber-500">
              <Plus size={14} />
              Satır Ekle
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Bitiş Tarihi</label>
              <input
                type="date"
                value={bitisTarihi}
                onChange={(e) => setBitisTarihi(e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
              />
              {bitisTarihi && (
                <button type="button" onClick={() => setBitisTarihi('')} className="mt-1 text-xs text-bakery-coffee-400 hover:text-bakery-coffee-600">
                  Temizle
                </button>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Not</label>
              <input
                type="text"
                value={not}
                onChange={(e) => setNot(e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-bakery-coffee-800">
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
            Aktif
          </label>

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
