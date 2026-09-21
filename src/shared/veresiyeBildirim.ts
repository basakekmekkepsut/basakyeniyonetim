import { doc, getDoc } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import { sendTelegramNotification } from './telegram'
import type { TelegramAyarlari } from '../lib/types'

/** Yeni bir veresiye kaydı (veya toplu kayıt) oluşturulduktan SONRA çağrılır —
 * kayıt zaten tamamlandığı için bildirim gönderimi başarısız olursa sessizce
 * yutulur, kullanıcıya hata gösterilmez. Telegram (settings/telegram.chatIds.veresiye)
 * üzerinden gönderir. */
export async function veresiyeBildirimGonder(baslik: string, ozet: string, satirlar: string[]): Promise<void> {
  if (satirlar.length === 0) return

  const govdeTam = [ozet, '', '📦 Yeni Kayıt', ...satirlar].join('\n')

  try {
    const ayarlarSnap = await getDoc(doc(requireDb(), 'settings', 'telegram'))
    const chatId = (ayarlarSnap.data() as TelegramAyarlari | undefined)?.chatIds?.veresiye
    if (chatId) await sendTelegramNotification(chatId, `${baslik}\n\n${govdeTam}`)
  } catch {
    // yut — kayıt zaten başarıyla tamamlandı
  }
}
