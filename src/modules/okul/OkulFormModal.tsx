import { useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import MusteriSecici from '../../shared/MusteriSecici'
import { useUrunler } from '../urunler/data'
import { yeniHatId } from './data'
import type { OkulFirma, OkulHat, OkulSchool, OkulSchoolFormVerisi } from '../../lib/types'

interface Props {
  mevcut?: OkulSchool
  firmalar: OkulFirma[]
  onKaydet: (veri: OkulSchoolFormVerisi) => Promise<void>
  onKapat: () => void
}

export default function OkulFormModal({ mevcut, firmalar, onKaydet, onKapat }: Props) {
  const { urunler } = useUrunler()
  const [ad, setAd] = useState(mevcut?.ad ?? '')
  const [firmaId, setFirmaId] = useState(mevcut?.firmaId ?? '')
  const [musteriId, setMusteriId] = useState(mevcut?.musteriId ?? null as string | null)
  const [lines, setLines] = useState<OkulHat[]>(mevcut?.lines ?? [])
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const okulUrunleri = urunler.filter((u) => u.aktif && u.modules.includes('okul'))

  function hatEkle() {
    setLines((prev) => [
      ...prev,
      { id: yeniHatId(), productId: '', urunAdi: '', adet: 1, aktif: true, faturaHedefiId: null }
    ])
  }

  function hatGuncelle(id: string, degisiklik: Partial<OkulHat>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...degisiklik } : l)))
  }

  function hatSil(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function urunSec(id: string, productId: string) {
    const urun = urunler.find((u) => u.id === productId)
    hatGuncelle(id, { productId, urunAdi: urun?.ad ?? '' })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ad.trim()) return setHata('Okul adı zorunludur.')
    const gecerliHatlar = lines.filter((l) => l.productId)
    setHata(null)
    setGonderiliyor(true)
    try {
      await onKaydet({
        ad: ad.trim(),
        firmaId: firmaId || null,
        musteriId,
        lines: gecerliHatlar
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
      <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-bakery-surface p-5 shadow-xl md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-ink-900">{mevcut ? 'Okulu Düzenle' : 'Yeni Okul'}</h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-ink-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Okul Adı *</label>
            <input
              type="text"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              required
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Firma (lojistik grup)</label>
            <select
              value={firmaId}
              onChange={(e) => setFirmaId(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 text-sm outline-none focus:border-bakery-amber-500"
            >
              <option value="">Yok — bağımsız okul</option>
              {firmalar.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.ad}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">
              Bağımsız veresiye hesabı (opsiyonel)
            </label>
            <MusteriSecici
              modul="okul"
              seciliMusteriId={musteriId}
              hepsiSecenegi
              onHepsiSec={() => setMusteriId(null)}
              placeholder="Yok"
              onSec={(m) => setMusteriId(m.id)}
            />
            <p className="mt-1 text-xs text-bakery-ink-500">
              Sadece bu okulun kendi ayrı veresiye hesabı varsa seçin (günlük ekmek siparişinden bağımsız).
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-bakery-ink-800">Hatlar (ürün + günlük adet)</label>
              <button type="button" onClick={hatEkle} className="flex items-center gap-1 text-sm font-medium text-bakery-amber-600 hover:text-bakery-amber-500">
                <Plus size={14} />
                Hat Ekle
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="rounded-lg bg-bakery-cream-50 px-3 py-3 text-sm text-bakery-ink-400">Henüz hat eklenmedi.</p>
            ) : (
              <div className="space-y-2">
                {lines.map((l) => (
                  <div key={l.id} className="rounded-lg bg-bakery-cream-50 p-2.5">
                    <div className="mb-2 flex items-center gap-2">
                      <select
                        value={l.productId}
                        onChange={(e) => urunSec(l.id, e.target.value)}
                        className="flex-1 rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5 text-sm outline-none focus:border-bakery-amber-500"
                      >
                        <option value="">Ürün seçin…</option>
                        {okulUrunleri.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.ad}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={l.adet}
                        onChange={(e) => hatGuncelle(l.id, { adet: Number(e.target.value) })}
                        className="w-16 rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5 text-center text-sm outline-none focus:border-bakery-amber-500"
                      />
                      <button type="button" onClick={() => hatSil(l.id)} className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={l.faturaHedefiId ?? ''}
                        onChange={(e) => hatGuncelle(l.id, { faturaHedefiId: e.target.value || null })}
                        className="flex-1 rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5 text-xs outline-none focus:border-bakery-amber-500"
                      >
                        <option value="">Fatura: Doğrudan bu okula</option>
                        {firmalar.map((f) => (
                          <option key={f.id} value={f.id}>
                            Fatura: {f.ad}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 text-xs text-bakery-ink-600">
                        <input type="checkbox" checked={l.aktif} onChange={(e) => hatGuncelle(l.id, { aktif: e.target.checked })} />
                        Aktif
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
