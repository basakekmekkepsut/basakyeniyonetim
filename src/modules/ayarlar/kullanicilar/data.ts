import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore'
import { requireDb } from '../../../lib/firebase'
import type { KullaniciProfili } from '../../../lib/types'

export interface KullaniciSatiri extends KullaniciProfili {
  uid: string
}

export function useKullanicilar() {
  const [kullanicilar, setKullanicilar] = useState<KullaniciSatiri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), 'users'), orderBy('ad'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setKullanicilar(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as KullaniciSatiri))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  return { kullanicilar, yukleniyor, hata }
}

export const BOS_PROFIL: KullaniciProfili = {
  ad: '',
  eposta: '',
  rol: 'personel',
  modules: { siparis: false, veresiye: false, okul: false },
  permissions: {
    siparis: { orderAdd: false, orderViewAll: false, products: false },
    veresiye: { gorebilecegiMusteriler: 'all' },
    okul: { siparis: false, okullar: false, urunler: false, ekstre: false, mesaj: false }
  },
  aktif: true,
  bildirimler: { yeniSiparis: false, gunlukHatirlatma: false, yeniVeresiyeKaydi: false, okulHatirlatma: false }
}

export async function kullaniciProfiliOlustur(uid: string, profil: KullaniciProfili): Promise<void> {
  await setDoc(doc(requireDb(), 'users', uid), profil)
}

export async function kullaniciProfiliGuncelle(uid: string, profil: KullaniciProfili): Promise<void> {
  await updateDoc(doc(requireDb(), 'users', uid), { ...profil })
}
