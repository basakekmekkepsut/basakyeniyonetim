import { useEffect, useState, type FormEvent } from 'react'
import { useTelegramAyarlari, telegramAyarlariKaydet } from './data'
import { useToast } from '../../../shared/Toast'

export default function TelegramAyarlariPage() {
  const { ayarlar, yukleniyor } = useTelegramAyarlari()
  const toast = useToast()
  const [siparis, setSiparis] = useState('')
  const [veresiye, setVeresiye] = useState('')
  const [okul, setOkul] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)

  useEffect(() => {
    setSiparis(ayarlar.chatIds.siparis)
    setVeresiye(ayarlar.chatIds.veresiye)
    setOkul(ayarlar.chatIds.okul)
  }, [ayarlar])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGonderiliyor(true)
    try {
      await telegramAyarlariKaydet({ chatIds: { siparis, veresiye, okul } })
      toast.basari('Telegram ayarları kaydedildi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  if (yukleniyor) return <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 rounded-xl bg-bakery-surface p-5 shadow-sm shadow-bakery-coffee-900/5">
      <h2 className="text-lg font-semibold text-bakery-ink-900">Telegram Bildirimleri</h2>
      <p className="text-sm text-bakery-ink-500">
        Her modülün sipariş/borç listesini gönderdiği Telegram grup/kanal ID'lerini girin. Bot token'ı
        güvenlik nedeniyle burada değil, sunucu tarafı ortam değişkeninde saklanır.
      </p>

      {(
        [
          ['siparis', 'Sipariş', siparis, setSiparis],
          ['veresiye', 'Veresiye', veresiye, setVeresiye],
          ['okul', 'Okul', okul, setOkul]
        ] as const
      ).map(([key, etiket, deger, setter]) => (
        <div key={key}>
          <label className="mb-1 block text-sm font-medium text-bakery-ink-800">{etiket} Chat ID</label>
          <input
            value={deger}
            onChange={(e) => setter(e.target.value)}
            placeholder="örn. -1001234567890"
            className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 font-mono text-sm outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
          />
        </div>
      ))}

      <button
        type="submit"
        disabled={gonderiliyor}
        className="rounded-lg bg-bakery-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500 disabled:opacity-60"
      >
        {gonderiliyor ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  )
}
