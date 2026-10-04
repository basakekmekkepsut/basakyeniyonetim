import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import { siparisEkle } from './data'
import type { Musteri, SiparisSablonu, SiparisSablonuFormVerisi, Urun } from '../../lib/types'

const KOLEKSIYON = 'siparis_recurring_templates'

export function useSablonlar() {
  const [sablonlar, setSablonlar] = useState<SiparisSablonu[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), KOLEKSIYON), orderBy('musteriAdi'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSablonlar(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SiparisSablonu))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  return { sablonlar, yukleniyor, hata }
}

export async function sablonEkle(veri: SiparisSablonuFormVerisi): Promise<void> {
  await addDoc(collection(requireDb(), KOLEKSIYON), {
    ...veri,
    sonOlusturulan: null,
    planlananSonTarih: null,
    olusturmaTarihi: serverTimestamp()
  })
}

export async function sablonGuncelle(id: string, veri: SiparisSablonuFormVerisi): Promise<void> {
  await updateDoc(doc(requireDb(), KOLEKSIYON, id), { ...veri })
}

/** Şablonu ve onun ileriye dönük ürettiği, henüz teslim günü gelmemiş
 * ('planlandi') siparişleri siler — bunlar veresiyeye henüz yansımadığı için
 * güvenle silinebilir. Eskiden yalnızca şablon siliniyordu; geride kalan planlı
 * siparişler her hafta aktifleşip veresiyeye yazmaya devam ediyordu (Baraj BRJ
 * simidi). Dönen değer: silinen planlı sipariş sayısı. */
export async function sablonSil(id: string): Promise<number> {
  const db = requireDb()
  const snap = await getDocs(
    query(collection(db, 'siparis_orders'), where('kaynakSablonId', '==', id), where('durum', '==', 'planlandi'))
  )
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db)
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  await deleteDoc(doc(db, KOLEKSIYON, id))
  return snap.size
}

export function sablonBugunDueMu(sablon: SiparisSablonu, bugun: string): boolean {
  if (!sablon.aktif) return false
  if (sablon.sonOlusturulan === bugun) return false
  if (sablon.bitisTarihi && sablon.bitisTarihi < bugun) return false
  const gun = new Date(bugun + 'T00:00:00').getDay()
  return sablon.gunler.includes(gun)
}

// DİKKAT: d.toISOString() UTC kullanır ama d.getDay() yerel saat kullanır — UTC+
// saat dilimlerinde (örn. Türkiye) yerel gece yarısına sabitlenmiş bir Date için
// toISOString() bir gün ÖNCEYİ döndürür (klasik tarih kayması hatası). Bu yüzden
// tarih string'i her zaman yerel takvim bileşenlerinden kurulur.
function gunStr(d: Date) {
  const yil = d.getFullYear()
  const ay = String(d.getMonth() + 1).padStart(2, '0')
  const gun = String(d.getDate()).padStart(2, '0')
  return `${yil}-${ay}-${gun}`
}

function birGunSonra(tarih: string): Date {
  const d = new Date(tarih + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d
}

/**
 * Şablonu ileriye dönük (varsayılan: bugünden 1 yıl sonrasına, ya da şablonun
 * bitisTarihi'ne kadar) 'planlandi' durumunda siparişler halinde önceden üretir.
 * Bu siparişler Sipariş listesinde görünür ama veresiye bakiyesine YANSIMAZ —
 * teslimat günü geldiğinde SiparislerPage.tsx'teki otomatik aktivasyon efekti
 * onları 'yeni'ye çevirip veresiyeye işler (bkz. siparis/data.ts siparisPlanlananiAktifEt).
 * Aynı şablonda tekrar çağrılırsa yalnızca daha önce üretilmemiş tarihler eklenir
 * (planlananSonTarih ile takip edilir) — çift üretim yapılmaz.
 */
export async function sablondanTopluPlanOlustur(
  sablon: SiparisSablonu,
  urunler: Urun[],
  kullanici: { uid: string; ad: string }
): Promise<number> {
  const db = requireDb()
  const bugun = new Date()
  const birYilSonra = gunStr(new Date(bugun.getFullYear() + 1, bugun.getMonth(), bugun.getDate()))
  const hedefBitis = sablon.bitisTarihi || birYilSonra

  const baslangicTarihi = sablon.planlananSonTarih ? birGunSonra(sablon.planlananSonTarih) : new Date(gunStr(bugun) + 'T00:00:00')

  const items = sablon.items
    .map((k) => {
      const urun = urunler.find((u) => u.id === k.productId)
      return urun ? { productId: k.productId, urunAdi: urun.ad, adet: k.adet, birimFiyat: urun.fiyat } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
  if (items.length === 0) throw new Error('Şablondaki ürünler bulunamadı veya pasif.')
  const toplamTutar = items.reduce((s, it) => s + it.adet * it.birimFiyat, 0)

  const musteriSnap = await getDoc(doc(db, 'musteriler', sablon.musteriId))
  const musteriGecici = musteriSnap.exists() ? (musteriSnap.data() as Musteri).gecici === true : false

  const uretilecekTarihler: string[] = []
  for (const d = new Date(baslangicTarihi); gunStr(d) <= hedefBitis; d.setDate(d.getDate() + 1)) {
    if (sablon.gunler.includes(d.getDay())) uretilecekTarihler.push(gunStr(d))
  }

  if (uretilecekTarihler.length === 0) return 0

  const PARCA = 400
  for (let i = 0; i < uretilecekTarihler.length; i += PARCA) {
    const batch = writeBatch(db)
    for (const tarih of uretilecekTarihler.slice(i, i + PARCA)) {
      batch.set(doc(collection(db, 'siparis_orders')), {
        musteriId: sablon.musteriId,
        musteriAdi: sablon.musteriAdi,
        musteriGecici,
        kaynakSablonId: sablon.id,
        adres: sablon.adres,
        telefon: '',
        not: sablon.not,
        teslimatTarihi: tarih,
        items,
        toplamTutar,
        durum: 'planlandi',
        odemeSekli: 'veresiye',
        odemeDurumu: 'odenmedi',
        veresiyeKayitIdler: [],
        silindi: false,
        olusturanUid: kullanici.uid,
        olusturanAd: kullanici.ad,
        olusturmaTarihi: serverTimestamp(),
        guncellenmeTarihi: serverTimestamp()
      })
    }
    await batch.commit()
  }

  await updateDoc(doc(db, KOLEKSIYON, sablon.id), { planlananSonTarih: hedefBitis })
  return uretilecekTarihler.length
}

export async function sablondanSiparisOlustur(
  sablon: SiparisSablonu,
  tarih: string,
  urunler: Urun[],
  kullanici: { uid: string; ad: string }
): Promise<void> {
  const items = sablon.items
    .map((k) => {
      const urun = urunler.find((u) => u.id === k.productId)
      return urun ? { productId: k.productId, urunAdi: urun.ad, adet: k.adet, birimFiyat: urun.fiyat } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (items.length === 0) throw new Error('Şablondaki ürünler bulunamadı veya pasif.')

  await siparisEkle(
    {
      musteriId: sablon.musteriId,
      musteriAdi: sablon.musteriAdi,
      adres: sablon.adres,
      telefon: '',
      not: sablon.not,
      teslimatTarihi: tarih,
      items,
      odemeSekli: 'veresiye'
    },
    kullanici
  )

  await updateDoc(doc(requireDb(), KOLEKSIYON, sablon.id), { sonOlusturulan: tarih })
}
