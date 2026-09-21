import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
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

const TUM_GUNLER = [0, 1, 2, 3, 4, 5, 6]

// Bir tarih ilk kez açıldığında, henüz sipariş girilmemiş aktif hatlar için
// okulun standart günlük adedini GERÇEKTEN Firestore'a yazar (yalnızca ekranda
// gösterip yazmamak "kaydedildi sanılan ama kaydedilmemiş veri" riskine yol
// açardı — Üretim/Ekstre/Mesaj hep okul_orders'ı okuduğu için tutarlılık şart).
// Okulun o günü "açık günler"i arasında değilse (bkz. OkulSchool.acikGunler),
// standart adet yerine 0 yazılır — kapalı günlerde sipariş görünmez/üretilmez.
// İdempotent: zaten sipariş girilmiş hatlara dokunmaz.
export async function varsayilanSiparisleriHazirla(
  tarih: string,
  okullar: OkulSchool[],
  mevcutOrders: OkulOrder[]
): Promise<void> {
  const db = requireDb()
  const mevcutLineIds = new Set(mevcutOrders.map((o) => o.lineId))
  const gunIndex = new Date(tarih).getDay()
  const batch = writeBatch(db)
  let sayac = 0

  for (const okul of okullar) {
    const okulAcikMi = (okul.acikGunler ?? TUM_GUNLER).includes(gunIndex)
    for (const l of okul.lines) {
      if (!l.aktif || mevcutLineIds.has(l.id)) continue
      // Okulun kendi açık günü VE hattın kendi gün kısıtlaması (varsa) birlikte
      // sağlanmalı — ör. her gün giden ekmeğe ek olarak yalnızca Pzt/Per simit.
      const hatAcikMi = okulAcikMi && (l.gunler ?? TUM_GUNLER).includes(gunIndex)
      batch.set(doc(collection(db, ORDERS)), {
        tarih,
        schoolId: okul.id,
        lineId: l.id,
        productId: l.productId,
        adet: hatAcikMi ? l.adet : 0,
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

function bugunStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function gunuKapat(
  tarih: string,
  okullar: OkulSchool[],
  urunler: Urun[],
  kullanici: { uid: string }
): Promise<{ satirSayisi: number; veresiyeYansimayan: number }> {
  // O gün henüz gelmemişse siparişler hâlâ değişebilir — kesinleşmemiş bir günü
  // kapatmak yanlışlıkla tutarları dondurur (bkz. Ekstre sayfasındaki "Beklemede"
  // listesinde her zaman ileri tarihler de görünebiliyor olması).
  if (tarih > bugunStr()) {
    throw new Error('Henüz gelmemiş bir tarih kapatılamaz — siparişler o gün gelene kadar değişebilir.')
  }

  const db = requireDb()
  const kapanisRef = doc(db, KAPANISLAR, tarih)
  const kapanisSnap = await getDoc(kapanisRef)
  if (kapanisSnap.exists() && (kapanisSnap.data() as OkulKapanis).kapandi) {
    throw new Error('Bu tarih zaten kapatılmış.')
  }

  const ordersSnap = await getDocs(
    query(collection(db, ORDERS), where('tarih', '==', tarih), where('kapandiMi', '==', false))
  )

  interface TeslimatTaslak {
    orderRef: (typeof ordersSnap.docs)[number]['ref']
    schoolId: string
    lineId: string
    productId: string
    urunAdi: string
    adet: number
    birimFiyat: number
    tutar: number
    veresiyeMusteriId: string | null
    okulAdi: string
  }

  const taslaklar: TeslimatTaslak[] = []
  let veresiyeYansimayan = 0

  for (const d of ordersSnap.docs) {
    const order = d.data() as OkulOrder
    if (order.adet <= 0) continue // aşağıda ayrıca kapandiMi:true yapılır
    const okul = okullar.find((o) => o.id === order.schoolId)
    const hat = okul?.lines.find((l) => l.id === order.lineId)
    const urun = urunler.find((u) => u.id === order.productId)
    if (!okul || !hat || !urun) continue // silinmiş okul/hat/ürün — atla

    const veresiyeMusteriId = okul.musteriId ?? null
    if (!veresiyeMusteriId) veresiyeYansimayan += 1

    taslaklar.push({
      orderRef: d.ref,
      schoolId: order.schoolId,
      lineId: order.lineId,
      productId: order.productId,
      urunAdi: urun.ad,
      adet: order.adet,
      birimFiyat: urun.fiyat,
      tutar: order.adet * urun.fiyat,
      veresiyeMusteriId,
      okulAdi: okul.ad
    })
  }

  // Hedef müşterilerin GÜNCEL adını ve varsa ürüne özel fiyatını çek — Okul
  // hattı yalnızca ürünün standart fiyatını bilir, ama müşteri kartında o ürün
  // için özel bir fiyat (ör. Aşevi'ne ücretsiz ekmek için ₺0) tanımlıysa bu
  // Okul teslimatlarına da yansımalı (bkz. Ayarlar > Müşteriler özel fiyat).
  const hedefIdler = [...new Set(taslaklar.map((t) => t.veresiyeMusteriId).filter((id): id is string => !!id))]
  const musteriBilgileri = new Map<string, { ad: string; ozelFiyatlar: Record<string, number> }>()
  for (let i = 0; i < hedefIdler.length; i += 30) {
    const parca = hedefIdler.slice(i, i + 30)
    const snap = await getDocs(query(collection(db, 'musteriler'), where(documentId(), 'in', parca)))
    snap.docs.forEach((s) => {
      const veri = s.data()
      musteriBilgileri.set(s.id, { ad: (veri.ad as string) ?? '—', ozelFiyatlar: (veri.ozelFiyatlar as Record<string, number>) ?? {} })
    })
  }
  for (const t of taslaklar) {
    const ozelFiyat = t.veresiyeMusteriId ? musteriBilgileri.get(t.veresiyeMusteriId)?.ozelFiyatlar[t.productId] : undefined
    if (ozelFiyat !== undefined) {
      t.birimFiyat = ozelFiyat
      t.tutar = t.adet * ozelFiyat
    }
  }

  const batch = writeBatch(db)
  let satirSayisi = 0
  const bakiyeDeltalari = new Map<string, number>()

  for (const d of ordersSnap.docs) {
    const order = d.data() as OkulOrder
    if (order.adet <= 0) batch.update(d.ref, { kapandiMi: true })
  }

  for (const t of taslaklar) {
    const veresiyeRef = t.veresiyeMusteriId ? doc(collection(db, 'veresiye_kayitlar')) : null

    batch.set(doc(collection(db, TESLIMATLAR)), {
      tarih,
      schoolId: t.schoolId,
      lineId: t.lineId,
      productId: t.productId,
      urunAdi: t.urunAdi,
      adet: t.adet,
      birimFiyat: t.birimFiyat,
      tutar: t.tutar,
      kapanisZamani: serverTimestamp(),
      kapatanUid: kullanici.uid,
      veresiyeKayitId: veresiyeRef?.id ?? null
    })
    batch.update(t.orderRef, { kapandiMi: true })
    satirSayisi += 1

    if (veresiyeRef && t.veresiyeMusteriId) {
      batch.set(veresiyeRef, {
        musteriId: t.veresiyeMusteriId,
        musteriAdi: musteriBilgileri.get(t.veresiyeMusteriId)?.ad ?? '—',
        productId: t.productId,
        // Aynı Veresiye müşterisi birden fazla okulu temsil edebileceği için
        // (ör. bir kurumun birkaç okuluna aynı hesaptan fatura edilmesi) kalem
        // her zaman hangi okuldan geldiğini gösterecek şekilde etiketlenir.
        urunAdi: `${t.okulAdi} — ${t.urunAdi}`,
        adet: t.adet,
        birimFiyat: t.birimFiyat,
        tutar: t.tutar,
        tarih,
        durum: 'veresiye',
        girisYontemi: 'okul',
        kaynakSiparisId: null,
        esdegerAdet: 0,
        olusturanUid: kullanici.uid,
        olusturmaTarihi: serverTimestamp(),
        guncellenmeTarihi: serverTimestamp()
      })
      bakiyeDeltalari.set(t.veresiyeMusteriId, (bakiyeDeltalari.get(t.veresiyeMusteriId) ?? 0) + t.tutar)
    }
  }

  for (const [musteriId, delta] of bakiyeDeltalari) {
    batch.update(doc(db, 'musteriler', musteriId), { veresiyeBakiye: increment(delta) })
  }

  batch.set(kapanisRef, {
    tarih,
    kapandi: true,
    kapanisZamani: serverTimestamp(),
    kapatanUid: kullanici.uid,
    satirSayisi
  })

  await batch.commit()
  return { satirSayisi, veresiyeYansimayan }
}

/**
 * Yanlışlıkla kapatılmış bir günü GERİ ALIR: o tarihe ait teslimatları (ve varsa
 * bunlara bağlı veresiye_kayitlar + bakiye etkisini) siler, siparişleri tekrar
 * "kapanmamış" durumuna döndürür ve kapanış kaydını kaldırır — sipariş adetleri
 * (okul_orders.adet) İSE değişmeden korunur, admin düzeltip tekrar kapatabilir.
 */
export async function gununKapanisiniGeriAl(tarih: string): Promise<number> {
  const db = requireDb()
  const [ordersSnap, teslimatSnap] = await Promise.all([
    query(collection(db, ORDERS), where('tarih', '==', tarih)),
    query(collection(db, TESLIMATLAR), where('tarih', '==', tarih))
  ].map(getDocs))

  const batch = writeBatch(db)
  const bakiyeDeltalari = new Map<string, number>()

  const veresiyeKayitIdler: string[] = []
  teslimatSnap.docs.forEach((d) => {
    const veresiyeKayitId = (d.data().veresiyeKayitId as string | null) ?? null
    batch.delete(d.ref)
    if (veresiyeKayitId) {
      batch.delete(doc(db, 'veresiye_kayitlar', veresiyeKayitId))
      veresiyeKayitIdler.push(veresiyeKayitId)
    }
  })

  // Teslimat kaydı musteriId taşımıyor — bakiye düzeltmesi için silinen
  // veresiye_kayitlar belgelerini ayrıca okuyup tutarlarını topluyoruz.
  for (let i = 0; i < veresiyeKayitIdler.length; i += 30) {
    const parca = veresiyeKayitIdler.slice(i, i + 30)
    const snap = await getDocs(query(collection(db, 'veresiye_kayitlar'), where(documentId(), 'in', parca)))
    snap.docs.forEach((s) => {
      const v = s.data() as { musteriId: string; tutar: number }
      bakiyeDeltalari.set(v.musteriId, (bakiyeDeltalari.get(v.musteriId) ?? 0) - v.tutar)
    })
  }

  for (const [musteriId, delta] of bakiyeDeltalari) {
    batch.update(doc(db, 'musteriler', musteriId), { veresiyeBakiye: increment(delta) })
  }

  ordersSnap.docs.forEach((d) => batch.update(d.ref, { kapandiMi: false }))
  batch.delete(doc(db, KAPANISLAR, tarih))

  await batch.commit()
  return teslimatSnap.size
}
