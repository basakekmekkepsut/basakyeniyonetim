import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import type { OkulKapanis, OkulOrder, OkulSchool, Urun } from '../../lib/types'

const ORDERS = 'okul_orders'
const TESLIMATLAR = 'okul_teslimatlar'
const KAPANISLAR = 'okul_kapanislar'

export function useOkulOrders(tarih: string) {
  const [orders, setOrders] = useState<OkulOrder[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    setYukleniyor(true)
    const q = query(collection(requireDb(), ORDERS), where('tarih', '==', tarih))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OkulOrder))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [tarih])

  return { orders, yukleniyor, hata }
}

// Bir tarih ilk kez açıldığında, henüz sipariş girilmemiş aktif hatlar için
// okulun standart günlük adedini GERÇEKTEN Firestore'a yazar (yalnızca ekranda
// gösterip yazmamak "kaydedildi sanılan ama kaydedilmemiş veri" riskine yol
// açardı — Üretim/Ekstre/Mesaj hep okul_orders'ı okuduğu için tutarlılık şart).
// İdempotent: zaten sipariş girilmiş hatlara dokunmaz.
export async function varsayilanSiparisleriHazirla(
  tarih: string,
  okullar: OkulSchool[],
  mevcutOrders: OkulOrder[]
): Promise<void> {
  const db = requireDb()
  const mevcutLineIds = new Set(mevcutOrders.map((o) => o.lineId))
  const batch = writeBatch(db)
  let sayac = 0

  for (const okul of okullar) {
    for (const l of okul.lines) {
      if (!l.aktif || mevcutLineIds.has(l.id)) continue
      batch.set(doc(collection(db, ORDERS)), {
        tarih,
        schoolId: okul.id,
        lineId: l.id,
        productId: l.productId,
        adet: l.adet,
        kapandiMi: false
      })
      sayac += 1
    }
  }

  if (sayac > 0) await batch.commit()
}

// Auto-id + sorgu tabanlı upsert (FIRESTORE_SCHEMA.md §8) — deterministik
// {tarih}_{lineId} ID deseni bilinçli terk edildi, ileride aynı hattın günde
// birden fazla teslimatı senaryosu bu yapıda desteklenebilir.
export async function okulSiparisMiktariGuncelle(
  tarih: string,
  schoolId: string,
  lineId: string,
  productId: string,
  adet: number
): Promise<void> {
  const db = requireDb()
  const mevcutSnap = await getDocs(
    query(collection(db, ORDERS), where('tarih', '==', tarih), where('lineId', '==', lineId), limit(1))
  )
  const mevcutRef = mevcutSnap.docs[0]?.ref
  const guvenliAdet = Math.max(0, adet)

  // NOT: adet 0 olduğunda kaydı SİLMİYORUZ — sildiğimizde bu tarih için o hatta
  // hiç sipariş kaydı kalmıyor, bu da SiparisPage'in "kayıt yoksa okulun
  // varsayılan/şablon adedini göster" mantığını tetikleyip 0'ı anında varsayılan
  // adede geri döndürüyordu. 0'ı da gerçek bir kayıt olarak saklamak, "bugün bu
  // ürünü istemiyorlar" ile "hiç girilmedi" durumunu birbirinden ayırt ediyor.
  if (mevcutRef) {
    await updateDoc(mevcutRef, { adet: guvenliAdet, productId })
  } else {
    await addDoc(collection(db, ORDERS), { tarih, schoolId, lineId, productId, adet: guvenliAdet, kapandiMi: false })
  }
}

// Ekstre > "Beklemede" bölümünden yanlış/gereksiz bir satırı doğrudan silmek için
// (Günü Kapat'tan ÖNCE — kesinleşmiş bir teslimatı değil, henüz kapanmamış bir
// okul_orders satırını siler).
export async function okulSiparisSil(orderId: string): Promise<void> {
  await deleteDoc(doc(requireDb(), ORDERS, orderId))
}

// Ekstre > "Beklemede" bölümü için: tüm tarihlerdeki henüz kapanmamış siparişler.
export function useAcikOkulOrders() {
  const [orders, setOrders] = useState<OkulOrder[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    const q = query(collection(requireDb(), ORDERS), where('kapandiMi', '==', false))
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OkulOrder))
      setYukleniyor(false)
    })
    return unsub
  }, [])

  return { orders, yukleniyor }
}

export function useOkulKapanis(tarih: string) {
  const [kapanis, setKapanis] = useState<OkulKapanis | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    setYukleniyor(true)
    const unsub = onSnapshot(doc(requireDb(), KAPANISLAR, tarih), (snap) => {
      setKapanis(snap.exists() ? (snap.data() as OkulKapanis) : null)
      setYukleniyor(false)
    })
    return unsub
  }, [tarih])

  return { kapanis, yukleniyor }
}

export function useOkulKapanislar() {
  const [kapanislar, setKapanislar] = useState<OkulKapanis[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(requireDb(), KAPANISLAR), (snap) => {
      setKapanislar(snap.docs.map((d) => d.data() as OkulKapanis))
      setYukleniyor(false)
    })
    return unsub
  }, [])

  return { kapanislar, yukleniyor }
}

export function useOkulTeslimatlar(schoolId?: string) {
  const [teslimatlar, setTeslimatlar] = useState<import('../../lib/types').OkulTeslimat[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    setYukleniyor(true)
    const kisitlar = schoolId ? [where('schoolId', '==', schoolId)] : []
    const q = query(collection(requireDb(), TESLIMATLAR), ...kisitlar)
    const unsub = onSnapshot(q, (snap) => {
      setTeslimatlar(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as import('../../lib/types').OkulTeslimat))
      setYukleniyor(false)
    })
    return unsub
  }, [schoolId])

  return { teslimatlar, yukleniyor }
}

export async function gunuKapat(
  tarih: string,
  okullar: OkulSchool[],
  urunler: Urun[],
  kullanici: { uid: string }
): Promise<number> {
  const db = requireDb()
  const kapanisRef = doc(db, KAPANISLAR, tarih)
  const kapanisSnap = await getDoc(kapanisRef)
  if (kapanisSnap.exists() && (kapanisSnap.data() as OkulKapanis).kapandi) {
    throw new Error('Bu tarih zaten kapatılmış.')
  }

  const ordersSnap = await getDocs(
    query(collection(db, ORDERS), where('tarih', '==', tarih), where('kapandiMi', '==', false))
  )

  const batch = writeBatch(db)
  let satirSayisi = 0

  ordersSnap.docs.forEach((d) => {
    const order = d.data() as OkulOrder
    // adet 0 ise (okul o gün istemediyse) fatura satırı oluşturmadan sadece
    // kapat — boş/₺0 teslimat kaydı ile ekstreyi kirletmeye gerek yok.
    if (order.adet <= 0) {
      batch.update(d.ref, { kapandiMi: true })
      return
    }
    const okul = okullar.find((o) => o.id === order.schoolId)
    const hat = okul?.lines.find((l) => l.id === order.lineId)
    const urun = urunler.find((u) => u.id === order.productId)
    if (!okul || !hat || !urun) return // silinmiş okul/hat/ürün — atla

    const tutar = order.adet * urun.fiyat
    batch.set(doc(collection(db, TESLIMATLAR)), {
      tarih,
      schoolId: order.schoolId,
      lineId: order.lineId,
      productId: order.productId,
      urunAdi: urun.ad,
      adet: order.adet,
      birimFiyat: urun.fiyat,
      tutar,
      faturaHedefiId: hat.faturaHedefiId,
      kapanisZamani: serverTimestamp(),
      kapatanUid: kullanici.uid
    })
    batch.update(d.ref, { kapandiMi: true })
    satirSayisi += 1
  })

  batch.set(kapanisRef, {
    tarih,
    kapandi: true,
    kapanisZamani: serverTimestamp(),
    kapatanUid: kullanici.uid,
    satirSayisi
  })

  await batch.commit()
  return satirSayisi
}
