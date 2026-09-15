import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import MusteriSecici from '../../shared/MusteriSecici'
import type { OkulFirma, OkulFirmaFormVerisi } from '../../lib/types'

interface Props {
  mevcut?: OkulFirma
  onKaydet: (veri: OkulFirmaFormVerisi) => Promise<void>
  onKapat: () => void
}

export default function FirmaFormModal({ mevcut, onKaydet, onKapat }: Props) {
  const [ad, setAd] = useState(mevcut?.ad ?? '')
  const [musteriId, setMusteriId] = useState<string | null>(mevcut?.musteriId ?? null)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ad.trim()) return setHata('Firma adı zorunludur.')
    setHata(null)
    setGonderiliyor(true)
    try {
      await onKaydet({ ad: ad.trim(), musteriId })
      onKapat()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-coffee-900">{mevcut ? 'Firmayı Düzenle' : 'Yeni Firma'}</h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-coffee-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Firma Adı *</label>
            <input
              type="text"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              required
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Bağımsız veresiye hesabı (opsiyonel)</label>
            <MusteriSecici
              modul="okul"
              seciliMusteriId={musteriId}
              hepsiSecenegi
              onHepsiSec={() => setMusteriId(null)}
              placeholder="Yok"
              onSec={(m) => setMusteriId(m.id)}
            />
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
