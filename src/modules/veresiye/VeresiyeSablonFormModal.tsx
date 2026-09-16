import { useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import MusteriSecici from '../../shared/MusteriSecici'
import { useUrunler } from '../urunler/data'
import { useVeresiyeMusteriFiltresi } from '../../shared/veresiyeErisim'
import type { VeresiyeSablon, VeresiyeSablonFormVerisi, VeresiyeSablonKalemi } from '../../lib/types'

interface Props {
  mevcut?: VeresiyeSablon
  varsayilanSira?: number
  onKaydet: (veri: VeresiyeSablonFormVerisi) => Promise<void>
  onKapat: () => void
}

export default function VeresiyeSablonFormModal({ mevcut, varsayilanSira, onKaydet, onKapat }: Props) {
  const { urunler } = useUrunler()
  const musteriFiltresi = useVeresiyeMusteriFiltresi()
  const [musteriId, setMusteriId] = useState(mevcut?.musteriId ?? '')
  const [musteriAdi, setMusteriAdi] = useState(mevcut?.musteriAdi ?? '')
  const [kalemler, setKalemler] = useState<VeresiyeSablonKalemi[]>(
    mevcut?.kalemler ?? [{ productId: '', urunAdi: '', adet: 1 }]
  )
  const [sira, setSira] = useState(mevcut?.sira ?? varsayilanSira ?? 0)
  const [aktif, setAktif] = useState(mevcut?.aktif ?? true)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const veresiyeUrunleri = urunler.filter((u) => u.aktif && u.modules.includes('veresiye'))

  function urunSec(i: number, productId: string) {
    const urun = urunler.find((u) => u.id === productId)
    setKalemler((prev) => prev.map((k, idx) => (idx === i ? { ...k, productId, urunAdi: urun?.ad ?? '' } : k)))
  }

  function satirEkle() {
    setKalemler((prev) => [...prev, { productId: '', urunAdi: '', adet: 1 }])
  }

  function satirSil(i: number) {
    setKalemler((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!musteriId) return setHata('Müşteri seçmelisiniz.')
    const gecerli = kalemler.filter((k) => k.productId && k.adet > 0)
    if (gecerli.length === 0) return setHata('En az bir ürün eklemelisiniz.')
    setHata(null)
    setGonderiliyor(true)
    try {
      await onKaydet({ musteriId, musteriAdi, kalemler: gecerli, aktif, sira: Number(sira) || 0 })
      onKapat()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-coffee-900">{mevcut ? 'Şablonu Düzenle' : 'Yeni Giriş Şablonu'}</h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-coffee-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Müşteri *</label>
            <MusteriSecici
              modul="veresiye"
              seciliMusteriId={musteriId || null}
              filtre={musteriFiltresi}
              onSec={(m) => {
                setMusteriId(m.id)
                setMusteriAdi(m.ad)
              }}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-bakery-coffee-800">Varsayılan Ürünler *</label>
            <div className="space-y-2">
              {kalemler.map((k, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={k.productId}
                    onChange={(e) => urunSec(i, e.target.value)}
                    className="flex-1 rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-2 text-sm outline-none focus:border-bakery-amber-500"
                  >
                    <option value="">Ürün seçin…</option>
                    {veresiyeUrunleri.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.ad}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={k.adet}
                    onChange={(e) =>
                      setKalemler((prev) => prev.map((kk, idx) => (idx === i ? { ...kk, adet: Number(e.target.value) } : kk)))
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

          <div className="grid grid-cols-2 items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Sıra</label>
              <input
                type="number"
                value={sira}
                onChange={(e) => setSira(Number(e.target.value))}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 text-sm outline-none focus:border-bakery-amber-500"
              />
              <p className="mt-1 text-xs text-bakery-coffee-500">Günlük Giriş'te küçük sıra numarası önce gösterilir.</p>
            </div>
            <label className="mb-2.5 flex items-center gap-2 text-sm font-medium text-bakery-coffee-800">
              <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
              Aktif
            </label>
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
