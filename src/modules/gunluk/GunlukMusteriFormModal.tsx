import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { useUrunler } from '../urunler/data'
import type { GunlukMusteri, GunlukMusteriGirisi } from '../../lib/types'

interface Props {
  mevcut?: GunlukMusteri
  onKaydet: (girisi: GunlukMusteriGirisi) => Promise<void>
  onKapat: () => void
}

export default function GunlukMusteriFormModal({ mevcut, onKaydet, onKapat }: Props) {
  const [ad, setAd] = useState(mevcut?.ad ?? '')
  const [telefon, setTelefon] = useState(mevcut?.telefon ?? '')
  const [not, setNot] = useState(mevcut?.not ?? '')
  const [acilisBakiyesi, setAcilisBakiyesi] = useState(mevcut?.acilisBakiyesi ?? 0)
  const [aktif, setAktif] = useState(mevcut?.aktif ?? true)
  const [sikUrunler, setSikUrunler] = useState<string[]>(mevcut?.sikUrunler ?? [])
  const { urunler } = useUrunler()
  const gunlukUrunleri = urunler.filter((u) => u.aktif && u.modules.includes('gunluk'))

  function sikUrunDegistir(id: string) {
    setSikUrunler((liste) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]))
  }
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ad.trim()) return setHata('Müşteri adı zorunludur.')
    setHata(null)
    setGonderiliyor(true)
    try {
      await onKaydet({
        ad: ad.trim(),
        telefon: telefon.trim(),
        not: not.trim(),
        acilisBakiyesi: Number(acilisBakiyesi) || 0,
        aktif,
        sikUrunler
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
      <form onSubmit={handleSubmit} className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-bakery-surface p-5 shadow-xl md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-ink-900">{mevcut ? 'Müşteriyi Düzenle' : 'Yeni Günlük Müşteri'}</h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-ink-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Ad *</label>
            <input
              type="text"
              autoFocus={!mevcut}
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Telefon</label>
              <input
                type="tel"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Geçmiş Bakiye (₺)</label>
              <input
                type="number"
                step="0.01"
                value={acilisBakiyesi}
                onChange={(e) => setAcilisBakiyesi(Number(e.target.value))}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Not</label>
            <input
              type="text"
              value={not}
              onChange={(e) => setNot(e.target.value)}
              placeholder="Örn. komşu esnaf, her akşam uğrar"
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
            />
          </div>

          {gunlukUrunleri.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800">Sık aldığı ürünler</label>
              <div className="flex flex-wrap gap-1.5">
                {gunlukUrunleri.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => sikUrunDegistir(u.id)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                      sikUrunler.includes(u.id)
                        ? 'bg-bakery-amber-600 text-white'
                        : 'bg-bakery-cream-100 text-bakery-ink-600 hover:bg-bakery-cream-200'
                    }`}
                  >
                    {u.ad}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-bakery-ink-500">Günlük Giriş kartında bunlar görünür. Hiçbiri seçilmezse tüm ürünler görünür.</p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-bakery-ink-800">
            <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
            Aktif
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
