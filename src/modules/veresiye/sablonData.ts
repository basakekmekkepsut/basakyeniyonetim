import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc } from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import type { VeresiyeSablon, VeresiyeSablonKalemi } from '../../lib/types'

const KOLEKSIYON = 'veresiye_sablonlar'

// Günlük Veresiye de aynı şablon yapısını kendi koleksiyonunda kullanır — tüm
// fonksiyonlar son parametre olarak koleksiyon adını alır (varsayılan: Veresiye).
export type SablonKoleksiyonu = 'veresiye_sablonlar' | 'gunluk_sablonlar'

export function useVeresiyeSablonlar(koleksiyon: SablonKoleksiyonu = KOLEKSIYON) {
  const [sablonlar, setSablonlar] = useState<VeresiyeSablon[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), koleksiyon))
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
  }, [koleksiyon])

  return { sablonlar, yukleniyor, hata }
}

// Giriş Şablonu, eski sistemdeki gibi düz bir "satır" listesi olarak gösterilir:
// her satır bir (müşteri, ekmek türü) çiftidir. Firestore'da hâlâ müşteri başına
// tek dokümanda (kalemler dizisi) tutulur, ama ekranda tüm müşterilerin tüm
// satırları tek bir listede, global "sira" değerine göre sıralı gösterilir.
export interface SablonSatiri extends VeresiyeSablonKalemi {
  sablonId: string
  kalemIndex: number
  musteriId: string
  musteriAdi: string
}

// Bu özellikten önce oluşturulmuş eski kayıtlarda kalem başına aktif/sira alanı
// bulunmayabilir — geriye dönük uyumluluk için burada normalize edilir
// (aktif belirtilmemişse açık kabul edilir, sira belirtilmemişse 0 kabul edilir).
export function sablonSatirlariniCikar(sablonlar: VeresiyeSablon[]): SablonSatiri[] {
  const satirlar: SablonSatiri[] = []
  for (const s of sablonlar) {
    s.kalemler.forEach((k, i) => {
      satirlar.push({
        ...k,
        aktif: k.aktif !== false,
        sira: k.sira ?? 0,
        sablonId: s.id,
        kalemIndex: i,
        musteriId: s.musteriId,
        musteriAdi: s.musteriAdi
      })
    })
  }
  return satirlar.sort((a, b) => a.sira - b.sira)
}

export function useSonrakiSira(sablonlar: VeresiyeSablon[]): number {
  return useMemo(
    () => sablonlar.reduce((max, s) => s.kalemler.reduce((m, k) => Math.max(m, k.sira ?? 0), max), 0) + 1,
    [sablonlar]
  )
}

export async function sablonSatiriEkle(
  sablonlar: VeresiyeSablon[],
  musteriId: string,
  musteriAdi: string,
  productId: string,
  urunAdi: string,
  sira: number,
  koleksiyon: SablonKoleksiyonu = KOLEKSIYON
): Promise<void> {
  const mevcutSablon = sablonlar.find((s) => s.musteriId === musteriId)
  if (!mevcutSablon) {
    const kalemler: VeresiyeSablon['kalemler'] = [{ productId, urunAdi, aktif: true, sira }]
    await addDoc(collection(requireDb(), koleksiyon), { musteriId, musteriAdi, kalemler })
    return
  }
  if (mevcutSablon.kalemler.some((k) => k.productId === productId)) {
    throw new Error('Bu müşteri için bu ekmek türü zaten şablonda var.')
  }
  const yeniKalemler = [...mevcutSablon.kalemler, { productId, urunAdi, aktif: true, sira }]
  await updateDoc(doc(requireDb(), koleksiyon, mevcutSablon.id), { kalemler: yeniKalemler })
}

export async function sablonSatiriAktifDegistir(
  sablonlar: VeresiyeSablon[],
  sablonId: string,
  kalemIndex: number,
  aktif: boolean,
  koleksiyon: SablonKoleksiyonu = KOLEKSIYON
): Promise<void> {
  const sablon = sablonlar.find((s) => s.id === sablonId)
  if (!sablon) return
  const yeniKalemler = sablon.kalemler.map((k, i) => (i === kalemIndex ? { ...k, aktif } : k))
  await updateDoc(doc(requireDb(), koleksiyon, sablonId), { kalemler: yeniKalemler })
}

export async function sablonSatiriSil(
  sablonlar: VeresiyeSablon[],
  sablonId: string,
  kalemIndex: number,
  koleksiyon: SablonKoleksiyonu = KOLEKSIYON
): Promise<void> {
  const sablon = sablonlar.find((s) => s.id === sablonId)
  if (!sablon) return
  const yeniKalemler = sablon.kalemler.filter((_, i) => i !== kalemIndex)
  if (yeniKalemler.length === 0) {
    await deleteDoc(doc(requireDb(), koleksiyon, sablonId))
  } else {
    await updateDoc(doc(requireDb(), koleksiyon, sablonId), { kalemler: yeniKalemler })
  }
}

// İki satırın (aynı veya farklı müşteriye ait olabilir) sira değerlerini değiştirir.
// Firestore, dizi (array) alanlarında tek bir elemanı nokta-yollu (kalemler.0.sira) kısmi
// güncelleme ile değiştirmeyi desteklemez — bu yüzden her iki dokümanın kalemler dizisi
// tamamen yeniden yazılır.
export async function sablonSatiriSiraDegistir(
  sablonlar: VeresiyeSablon[],
  bu: SablonSatiri,
  digeri: SablonSatiri,
  koleksiyon: SablonKoleksiyonu = KOLEKSIYON
): Promise<void> {
  const buSablon = sablonlar.find((s) => s.id === bu.sablonId)
  const digeriSablon = sablonlar.find((s) => s.id === digeri.sablonId)
  if (!buSablon || !digeriSablon) return

  if (bu.sablonId === digeri.sablonId) {
    const yeniKalemler = buSablon.kalemler.map((k, i) => {
      if (i === bu.kalemIndex) return { ...k, sira: digeri.sira }
      if (i === digeri.kalemIndex) return { ...k, sira: bu.sira }
      return k
    })
    await updateDoc(doc(requireDb(), koleksiyon, buSablon.id), { kalemler: yeniKalemler })
    return
  }

  const buKalemler = buSablon.kalemler.map((k, i) => (i === bu.kalemIndex ? { ...k, sira: digeri.sira } : k))
  const digeriKalemler = digeriSablon.kalemler.map((k, i) => (i === digeri.kalemIndex ? { ...k, sira: bu.sira } : k))
  await Promise.all([
    updateDoc(doc(requireDb(), koleksiyon, buSablon.id), { kalemler: buKalemler }),
    updateDoc(doc(requireDb(), koleksiyon, digeriSablon.id), { kalemler: digeriKalemler })
  ])
}
