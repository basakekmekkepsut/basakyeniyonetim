import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import type { VeresiyeSablon, VeresiyeSablonFormVerisi } from '../../lib/types'

const KOLEKSIYON = 'veresiye_sablonlar'

export function useVeresiyeSablonlar() {
  const [sablonlar, setSablonlar] = useState<VeresiyeSablon[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), KOLEKSIYON), orderBy('musteriAdi'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSablonlar(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VeresiyeSablon))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  return { sablonlar, yukleniyor, hata }
}

export async function veresiyeSablonEkle(veri: VeresiyeSablonFormVerisi): Promise<void> {
  await addDoc(collection(requireDb(), KOLEKSIYON), veri)
}

export async function veresiyeSablonGuncelle(id: string, veri: VeresiyeSablonFormVerisi): Promise<void> {
  await updateDoc(doc(requireDb(), KOLEKSIYON, id), { ...veri })
}

export async function veresiyeSablonSil(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), KOLEKSIYON, id))
}
