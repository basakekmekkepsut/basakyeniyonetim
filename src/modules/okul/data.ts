import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import type { OkulSchool, OkulSchoolFormVerisi } from '../../lib/types'

const OKULLAR = 'okul_schools'

export function useOkullar() {
  const [okullar, setOkullar] = useState<OkulSchool[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), OKULLAR), orderBy('ad'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOkullar(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OkulSchool))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  return { okullar, yukleniyor, hata }
}

export async function okulEkle(veri: OkulSchoolFormVerisi): Promise<void> {
  await addDoc(collection(requireDb(), OKULLAR), veri)
}

export async function okulGuncelle(id: string, veri: OkulSchoolFormVerisi): Promise<void> {
  await updateDoc(doc(requireDb(), OKULLAR, id), { ...veri })
}

export async function okulSil(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), OKULLAR, id))
}

export function yeniHatId(): string {
  return crypto.randomUUID()
}
