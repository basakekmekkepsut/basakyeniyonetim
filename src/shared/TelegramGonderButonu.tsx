import { useState } from 'react'
import { Send } from 'lucide-react'
import { useTelegramAyarlari } from '../modules/ayarlar/telegram/data'
import { sendTelegramNotification } from './telegram'
import { useToast } from './Toast'
import type { Modul } from '../lib/types'

export default function TelegramGonderButonu({ modul, mesaj }: { modul: Modul; mesaj: string }) {
  const { ayarlar, yukleniyor } = useTelegramAyarlari()
  const toast = useToast()
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const chatId = ayarlar.chatIds[modul]

  async function handleClick() {
    if (!chatId) {
      toast.hata('Bu modül için Telegram chat ID tanımlı değil (Ayarlar > Telegram).')
      return
    }
    setGonderiliyor(true)
    try {
      await sendTelegramNotification(chatId, mesaj)
      toast.basari('Telegram\'a gönderildi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Telegram gönderimi başarısız.')
    } finally {
      setGonderiliyor(false)
    }
  }

  if (yukleniyor) return null

  return (
    <button
      onClick={handleClick}
      disabled={gonderiliyor}
      className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
    >
      <Send size={16} />
      {gonderiliyor ? 'Gönderiliyor…' : "Telegram'a Gönder"}
    </button>
  )
}
