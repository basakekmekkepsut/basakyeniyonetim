import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import type { OkulFirma, OkulFirmaFormVerisi, OkulSchool, OkulSchoolFormVerisi } from '../../lib/types'

const OKULLAR = 'okul_schools'
const FIRMALAR = 'okul_firmalar'

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

export function useOkulFirmalari() {
  const [firmalar, setFirmalar] = useState<OkulFirma[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), FIRMALAR), orderBy('ad'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFirmalar(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OkulFirma))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  return { firmalar, yukleniyor, hata }
}

export async function firmaEkle(veri: OkulFirmaFormVerisi): Promise<void> {
  await addDoc(collection(requireDb(), FIRMALAR), veri)
}

export async function firmaGuncelle(id: string, veri: OkulFirmaFormVerisi): Promise<void> {
  await updateDoc(doc(requireDb(), FIRMALAR, id), { ...veri })
}

export async function firmaSil(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), FIRMALAR, id))
}
