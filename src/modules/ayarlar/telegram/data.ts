import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { requireDb } from '../../../lib/firebase'
import type { TelegramAyarlari } from '../../../lib/types'

const BOS: TelegramAyarlari = { chatIds: { siparis: '', veresiye: '', okul: '' } }

export function useTelegramAyarlari() {
  const [ayarlar, setAyarlar] = useState<TelegramAyarlari>(BOS)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(requireDb(), 'settings', 'telegram'),
      (snap) => {
        setAyarlar(snap.exists() ? (snap.data() as TelegramAyarlari) : BOS)
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  return { ayarlar, yukleniyor, hata }
}

export async function telegramAyarlariKaydet(ayarlar: TelegramAyarlari): Promise<void> {
  await setDoc(doc(requireDb(), 'settings', 'telegram'), ayarlar, { merge: true })
}
