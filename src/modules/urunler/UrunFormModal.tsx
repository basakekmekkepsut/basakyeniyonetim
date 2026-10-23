import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { Modul, Urun, UrunGirisi } from '../../lib/types'

const MODUL_ETIKETLERI: { key: Modul; etiket: string }[] = [
  { key: 'siparis', etiket: 'Sipariş' },
  { key: 'veresiye', etiket: 'Veresiye' },
  { key: 'okul', etiket: 'Okul' },
  { key: 'gunluk', etiket: 'Günlük Veresiye' }
]

interface Props {
  mevcut?: Urun
  varsayilanModuller?: Modul[] // yeni üründe önceden işaretli modüller (ör. Günlük Veresiye > Ürünler)
  onKaydet: (girisi: UrunGirisi) => Promise<void>
  onKapat: () => void
}

export default function UrunFormModal({ mevcut, varsayilanModuller, onKaydet, onKapat }: Props) {
  const [ad, setAd] = useState(mevcut?.ad ?? '')
  const [fiyat, setFiyat] = useState(mevcut?.fiyat ?? 0)
  const [aktif, setAktif] = useState(mevcut?.aktif ?? true)
  const [modules, setModules] = useState<Modul[]>(mevcut?.modules ?? varsayilanModuller ?? [])
  const [unKatsayisi, setUnKatsayisi] = useState(mevcut?.unKatsayisi ?? 1)
  // Boş bırakılırsa Günlük Veresiye'de normal fiyat kullanılır.
  const [gunlukFiyat, setGunlukFiyat] = useState(mevcut?.gunlukFiyat != null ? String(mevcut.gunlukFiyat) : '')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  function moduluDegistir(modul: Modul) {
    setModules((m) => (m.includes(modul) ? m.filter((x) => x !== modul) : [...m, modul]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ad.trim()) {
      setHata('Ürün adı zorunludur.')
      return
    }
    if (fiyat < 0 || (gunlukFiyat !== '' && Number(gunlukFiyat) < 0)) {
      setHata('Fiyat negatif olamaz.')
      return
    }
    setHata(null)
    setGonderiliyor(true)
    try {
      await onKaydet({
        ad: ad.trim(),
        fiyat: Number(fiyat),
        aktif,
        modules,
        unKatsayisi: Number(unKatsayisi) || 1,
        gunlukFiyat: modules.includes('gunluk') && gunlukFiyat !== '' ? Number(gunlukFiyat) : null
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
        className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-bakery-surface p-5 shadow-xl md:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-ink-900">{mevcut ? 'Ürünü Düzenle' : 'Yeni Ürün'}</h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-ink-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Ürün Adı *</label>
            <input
              type="text"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              required
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Fiyat (₺) *</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={fiyat}
              onChange={(e) => setFiyat(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800">Hangi modüllerde satışa açık?</label>
            <div className="flex flex-wrap gap-2">
              {MODUL_ETIKETLERI.map(({ key, etiket }) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => moduluDegistir(key)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    modules.includes(key)
                      ? 'bg-bakery-amber-600 text-white'
                      : 'bg-bakery-cream-100 text-bakery-ink-600 hover:bg-bakery-cream-200'
                  }`}
                >
                  {etiket}
                </button>
              ))}
            </div>
          </div>

          {modules.includes('gunluk') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Günlük Veresiye Fiyatı (₺)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={gunlukFiyat}
                onChange={(e) => setGunlukFiyat(e.target.value)}
                placeholder={`Boş = normal fiyat (${fiyat})`}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
              />
              <p className="mt-1 text-xs text-bakery-ink-500">Kasadan veresiye alan müşterilere uygulanacak fiyat.</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Un Eşdeğer Katsayısı</label>
            <input
              type="number"
              min={0.1}
              step="0.1"
              value={unKatsayisi}
              onChange={(e) => setUnKatsayisi(Number(e.target.value))}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
            />
            <p className="mt-1 text-xs text-bakery-ink-500">
              Un Hesabı olan müşteriler için: bu üründen 1 adet, referans üründen kaç adete eşdeğer? (Varsayılan: 1)
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-bakery-ink-800">
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
            Aktif (seçim listelerinde görünsün)
          </label>

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
