import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import { urunKullanimdaMi } from '../../shared/kullanimKontrolu'
import type { Urun, UrunGirisi } from '../../lib/types'

const KOLEKSIYON = 'products'

export function useUrunler() {
  const [urunler, setUrunler] = useState<Urun[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), KOLEKSIYON), orderBy('ad'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUrunler(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Urun))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  return { urunler, yukleniyor, hata }
}

export async function urunEkle(girisi: UrunGirisi): Promise<void> {
  await addDoc(collection(requireDb(), KOLEKSIYON), {
    ...girisi,
    olusturmaTarihi: serverTimestamp(),
    guncellenmeTarihi: serverTimestamp()
  })
}

export async function urunGuncelle(id: string, girisi: UrunGirisi): Promise<void> {
  await updateDoc(doc(requireDb(), KOLEKSIYON, id), { ...girisi, guncellenmeTarihi: serverTimestamp() })
}

export async function urunAktifDurumDegistir(id: string, aktif: boolean): Promise<void> {
  await updateDoc(doc(requireDb(), KOLEKSIYON, id), { aktif, guncellenmeTarihi: serverTimestamp() })
}

export async function urunSil(id: string): Promise<void> {
  const sebep = await urunKullanimdaMi(id)
  if (sebep) throw new Error(`Ürün silinemedi: ${sebep} Önce "Pasif" yapabilirsiniz.`)
  await deleteDoc(doc(requireDb(), KOLEKSIYON, id))
}
