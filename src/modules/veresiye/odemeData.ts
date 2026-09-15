import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import type { VeresiyeOdeme, VeresiyeOdemeFormVerisi } from '../../lib/types'
import type { VeresiyeFiltre } from './data'

const KOLEKSIYON = 'veresiye_odemeler'

export function useVeresiyeOdemeler(filtre: VeresiyeFiltre) {
  const [odemeler, setOdemeler] = useState<VeresiyeOdeme[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    setYukleniyor(true)
    const kisitlar = []
    if (filtre.musteriId) kisitlar.push(where('musteriId', '==', filtre.musteriId))
    if (filtre.baslangic) kisitlar.push(where('tarih', '>=', filtre.baslangic))
    if (filtre.bitis) kisitlar.push(where('tarih', '<=', filtre.bitis))

    const q = query(collection(requireDb(), KOLEKSIYON), ...kisitlar, orderBy('tarih', 'desc'))
    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        setOdemeler(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VeresiyeOdeme))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtre.baslangic, filtre.bitis, filtre.musteriId])

  return { odemeler, yukleniyor, hata }
}

export async function odemeEkle(veri: VeresiyeOdemeFormVerisi, kullanici: { uid: string }): Promise<void> {
  const db = requireDb()
  const batch = writeBatch(db)
  const ref = doc(collection(db, KOLEKSIYON))
  batch.set(ref, {
    ...veri,
    olusturanUid: kullanici.uid,
    olusturmaTarihi: serverTimestamp()
  })
  batch.update(doc(db, 'musteriler', veri.musteriId), { veresiyeBakiye: increment(-veri.tutar) })
  await batch.commit()
}

export async function odemeGuncelle(mevcut: VeresiyeOdeme, veri: VeresiyeOdemeFormVerisi): Promise<void> {
  const db = requireDb()
  const ref = doc(db, KOLEKSIYON, mevcut.id)
  const delta = -(veri.tutar - mevcut.tutar) // tutar artarsa bakiye daha çok düşer

  await runTransaction(db, async (tx) => {
    tx.set(ref, { ...veri }, { merge: true })
    if (delta !== 0) {
      tx.update(doc(db, 'musteriler', veri.musteriId), { veresiyeBakiye: increment(delta) })
    }
  })
}

export async function odemeSil(mevcut: VeresiyeOdeme): Promise<void> {
  const db = requireDb()
  const batch = writeBatch(db)
  batch.delete(doc(db, KOLEKSIYON, mevcut.id))
  batch.update(doc(db, 'musteriler', mevcut.musteriId), { veresiyeBakiye: increment(mevcut.tutar) })
  await batch.commit()
}
