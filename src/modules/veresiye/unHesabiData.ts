import { useEffect, useState } from 'react'
import { collection, doc, increment, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import type { VeresiyeUnGirisi } from '../../lib/types'

const KOLEKSIYON = 'veresiye_unGirisleri'

export function useUnGirisleri(musteriId: string | null) {
  const [girisler, setGirisler] = useState<VeresiyeUnGirisi[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    if (!musteriId) {
      setGirisler([])
      setYukleniyor(false)
      return
    }
    setYukleniyor(true)
    const q = query(collection(requireDb(), KOLEKSIYON), where('musteriId', '==', musteriId), orderBy('tarih', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setGirisler(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VeresiyeUnGirisi))
      setYukleniyor(false)
    })
    return unsub
  }, [musteriId])

  return { girisler, yukleniyor }
}

/**
 * Müşterinin getirdiği un çuvalını kaydeder — birikenEsdegerAdet'i AZALTIR
 * (bkz. lib/types.ts UnHesabi). Ekmek zaten ücretsiz olduğu için bu, tek
 * "ödeme" biçimidir.
 */
export async function unOdemesiEkle(
  veri: { musteriId: string; musteriAdi: string; tarih: string; cuvalSayisi: number; adetPerCuval: number },
  kullanici: { uid: string }
): Promise<void> {
  const db = requireDb()
  const esdegerAdet = veri.cuvalSayisi * veri.adetPerCuval
  const batch = writeBatch(db)

  batch.set(doc(collection(db, KOLEKSIYON)), {
    musteriId: veri.musteriId,
    musteriAdi: veri.musteriAdi,
    tarih: veri.tarih,
    cuvalSayisi: veri.cuvalSayisi,
    esdegerAdet,
    olusturanUid: kullanici.uid,
    olusturmaTarihi: serverTimestamp()
  })
  batch.update(doc(db, 'musteriler', veri.musteriId), { 'unHesabi.birikenEsdegerAdet': increment(-esdegerAdet) })

  await batch.commit()
}
