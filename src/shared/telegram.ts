import { httpsCallable } from 'firebase/functions'
import { requireFunctions } from '../lib/firebase'

export async function sendTelegramNotification(chatId: string, message: string): Promise<void> {
  const gonder = httpsCallable<{ chatId: string; message: string }, { basarili: boolean }>(
    requireFunctions(),
    'telegramNotify'
  )
  await gonder({ chatId, message })
}
