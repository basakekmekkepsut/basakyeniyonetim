import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import type { OkulPayment, OkulPaymentFormVerisi } from '../../lib/types'

const KOLEKSIYON = 'okul_payments'

export function useOkulPayments() {
  const [payments, setPayments] = useState<OkulPayment[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), KOLEKSIYON), orderBy('tarih', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OkulPayment))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  return { payments, yukleniyor, hata }
}

export async function okulOdemeEkle(veri: OkulPaymentFormVerisi, kullanici: { uid: string }): Promise<void> {
  await addDoc(collection(requireDb(), KOLEKSIYON), {
    ...veri,
    olusturanUid: kullanici.uid,
    olusturmaTarihi: serverTimestamp()
  })
}

export async function okulOdemeGuncelle(id: string, veri: OkulPaymentFormVerisi): Promise<void> {
  await updateDoc(doc(requireDb(), KOLEKSIYON, id), { ...veri })
}

export async function okulOdemeSil(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), KOLEKSIYON, id))
}
