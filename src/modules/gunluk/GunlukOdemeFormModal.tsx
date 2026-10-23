import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import GunlukMusteriSecici from './GunlukMusteriSecici'
import type { GunlukOdeme, GunlukOdemeFormVerisi } from '../../lib/types'

interface Props {
  mevcut?: GunlukOdeme
  varsayilanMusteri?: { id: string; ad: string }
  onKaydet: (veri: GunlukOdemeFormVerisi) => Promise<void>
  onKapat: () => void
}

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function GunlukOdemeFormModal({ mevcut, varsayilanMusteri, onKaydet, onKapat }: Props) {
  const [musteriId, setMusteriId] = useState(mevcut?.musteriId ?? varsayilanMusteri?.id ?? '')
  const [musteriAdi, setMusteriAdi] = useState(mevcut?.musteriAdi ?? varsayilanMusteri?.ad ?? '')
  const [tutar, setTutar] = useState(mevcut?.tutar ?? 0)
  const [tarih, setTarih] = useState(mevcut?.tarih ?? bugunStr())
  const [not, setNot] = useState(mevcut?.not ?? '')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!musteriId) return setHata('Müşteri seçmelisiniz.')
    if (tutar <= 0) return setHata('Tutar 0’dan büyük olmalı.')
    setHata(null)
    setGonderiliyor(true)
    try {
      await onKaydet({ musteriId, musteriAdi, tutar, tarih, not: not.trim() })
      onKapat()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-bakery-surface p-5 shadow-xl md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-ink-900">{mevcut ? 'Ödemeyi Düzenle' : 'Yeni Ödeme'}</h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-ink-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Tutar (₺) *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={tutar}
                onChange={(e) => setTutar(Number(e.target.value))}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
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

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Not</label>
            <input
              type="text"
              value={not}
              onChange={(e) => setNot(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
            />
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
