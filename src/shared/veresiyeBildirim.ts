import { httpsCallable } from 'firebase/functions'
import { doc, getDoc } from 'firebase/firestore'
import { requireDb, requireFunctions } from '../lib/firebase'
import { sendTelegramNotification } from './telegram'
import type { TelegramAyarlari } from '../lib/types'

/** Yeni bir veresiye kaydı (veya toplu kayıt) oluşturulduktan SONRA çağrılır —
 * kayıt zaten tamamlandığı için bildirim gönderimi başarısız olursa sessizce
 * yutulur, kullanıcıya hata gösterilmez. Hem push (yeniVeresiyeKaydi bildirim
 * tercihi açık kullanıcılara) hem Telegram (settings/telegram.chatIds.veresiye)
 * üzerinden gönderir. */
export async function veresiyeBildirimGonder(baslik: string, ozet: string, satirlar: string[]): Promise<void> {
  if (satirlar.length === 0) return

  const govdeTam = [ozet, '', '📦 Yeni Kayıt', ...satirlar].join('\n')

  try {
    const cagir = httpsCallable<{ baslik: string; govde: string }, { basarili: boolean }>(
      requireFunctions(),
      'veresiyeGirisBildirimGonder'
    )
    await cagir({ baslik, govde: [ozet, '', '📦 Yeni Kayıt', ...satirlar.slice(0, 20)].join('\n') })
  } catch {
    // yut — kayıt zaten başarıyla tamamlandı
  }

  try {
    const ayarlarSnap = await getDoc(doc(requireDb(), 'settings', 'telegram'))
    const chatId = (ayarlarSnap.data() as TelegramAyarlari | undefined)?.chatIds?.veresiye
    if (chatId) await sendTelegramNotification(chatId, `${baslik}\n\n${govdeTam}`)
  } catch {
    // yut — kayıt zaten başarıyla tamamlandı
  }
}
