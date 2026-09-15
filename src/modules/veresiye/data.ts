import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
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
import { kayitDurumuHesapla, esdegerAdetToplamHesapla } from '../../shared/unHesabi'
import type { Musteri, Urun, VeresiyeDurumu, VeresiyeGirisYontemi, VeresiyeKaydi } from '../../lib/types'

const KOLEKSIYON = 'veresiye_kayitlar'

export interface VeresiyeFiltre {
  baslangic: string | null
  bitis: string | null
  musteriId: string | null
}

export function useVeresiyeKayitlar(filtre: VeresiyeFiltre) {
  const [kayitlar, setKayitlar] = useState<VeresiyeKaydi[]>([])
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
        setKayitlar(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VeresiyeKaydi))
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

  return { kayitlar, yukleniyor, hata }
}

export interface VeresiyeKaydiFormVerisi {
  musteriId: string
  musteriAdi: string
  productId: string
  urunAdi: string
  adet: number
  birimFiyat: number
  tarih: string
  durum: VeresiyeDurumu
}

function bakiyeEtkisi(durum: VeresiyeDurumu, tutar: number) {
  return durum === 'veresiye' ? tutar : 0
}

async function musteriVeUrunGetir(musteriId: string, productId: string) {
  const db = requireDb()
  const [musteriSnap, urunSnap] = await Promise.all([
    getDoc(doc(db, 'musteriler', musteriId)),
    getDoc(doc(db, 'products', productId))
  ])
  return {
    musteri: musteriSnap.exists() ? (musteriSnap.data() as Musteri) : undefined,
    urun: urunSnap.exists() ? (urunSnap.data() as Urun) : undefined
  }
}

export async function veresiyeKaydiEkle(
  veri: VeresiyeKaydiFormVerisi,
  kullanici: { uid: string },
  girisYontemi: VeresiyeGirisYontemi = 'manuel'
): Promise<void> {
  const db = requireDb()
  const { musteri, urun } = await musteriVeUrunGetir(veri.musteriId, veri.productId)
  const { durum, esdegerAdet } = kayitDurumuHesapla(musteri, urun, veri.adet, veri.durum)
  const tutar = veri.adet * veri.birimFiyat
  const kayitRef = doc(collection(db, KOLEKSIYON))
  const batch = writeBatch(db)

  batch.set(kayitRef, {
    musteriId: veri.musteriId,
    musteriAdi: veri.musteriAdi,
    productId: veri.productId,
    urunAdi: veri.urunAdi,
    adet: veri.adet,
    birimFiyat: veri.birimFiyat,
    tutar,
    tarih: veri.tarih,
    durum,
    girisYontemi,
    kaynakSiparisId: null,
    esdegerAdet,
    olusturanUid: kullanici.uid,
    olusturmaTarihi: serverTimestamp(),
    guncellenmeTarihi: serverTimestamp()
  })

  const etki = bakiyeEtkisi(durum, tutar)
  const musteriGuncelleme: Record<string, unknown> = {}
  if (etki !== 0) musteriGuncelleme.veresiyeBakiye = increment(etki)
  if (esdegerAdet !== 0) musteriGuncelleme['unHesabi.birikenEsdegerAdet'] = increment(esdegerAdet)
  if (Object.keys(musteriGuncelleme).length > 0) {
    batch.update(doc(db, 'musteriler', veri.musteriId), musteriGuncelleme)
  }

  await batch.commit()
}

export async function veresiyeKaydiGuncelle(mevcut: VeresiyeKaydi, veri: VeresiyeKaydiFormVerisi): Promise<void> {
  const db = requireDb()
  const kayitRef = doc(db, KOLEKSIYON, mevcut.id)
  const musteriRef = doc(db, 'musteriler', veri.musteriId)
  const { musteri, urun } = await musteriVeUrunGetir(veri.musteriId, veri.productId)
  const { durum, esdegerAdet } = kayitDurumuHesapla(musteri, urun, veri.adet, veri.durum)

  const eskiEtki = bakiyeEtkisi(mevcut.durum, mevcut.tutar)
  const yeniTutar = veri.adet * veri.birimFiyat
  const yeniEtki = bakiyeEtkisi(durum, yeniTutar)
  const delta = yeniEtki - eskiEtki
  const unDelta = esdegerAdet - (mevcut.esdegerAdet ?? 0)

  await runTransaction(db, async (tx) => {
    tx.set(
      kayitRef,
      {
        musteriId: veri.musteriId,
        musteriAdi: veri.musteriAdi,
        productId: veri.productId,
        urunAdi: veri.urunAdi,
        adet: veri.adet,
        birimFiyat: veri.birimFiyat,
        tutar: yeniTutar,
        tarih: veri.tarih,
        durum,
        esdegerAdet,
        guncellenmeTarihi: serverTimestamp()
      },
      { merge: true }
    )
    const musteriGuncelleme: Record<string, unknown> = {}
    if (delta !== 0) musteriGuncelleme.veresiyeBakiye = increment(delta)
    if (unDelta !== 0) musteriGuncelleme['unHesabi.birikenEsdegerAdet'] = increment(unDelta)
    if (Object.keys(musteriGuncelleme).length > 0) tx.update(musteriRef, musteriGuncelleme)
  })
}

export async function veresiyeKaydiSil(mevcut: VeresiyeKaydi): Promise<void> {
  const db = requireDb()
  const etki = bakiyeEtkisi(mevcut.durum, mevcut.tutar)
  const batch = writeBatch(db)
  batch.delete(doc(db, KOLEKSIYON, mevcut.id))
  const musteriGuncelleme: Record<string, unknown> = {}
  if (etki !== 0) musteriGuncelleme.veresiyeBakiye = increment(-etki)
  if (mevcut.esdegerAdet) musteriGuncelleme['unHesabi.birikenEsdegerAdet'] = increment(-mevcut.esdegerAdet)
  if (Object.keys(musteriGuncelleme).length > 0) {
    batch.update(doc(db, 'musteriler', mevcut.musteriId), musteriGuncelleme)
  }
  await batch.commit()
}

// --- Günlük Giriş: toplu kayıt ---

export interface GunlukGirisSatiri {
  musteriId: string
  musteriAdi: string
  kalemler: { productId: string; urunAdi: string; adet: number; birimFiyat: number }[]
  odendi: boolean
  tarih: string
}

export async function gunlukGirisKaydet(
  satirlar: GunlukGirisSatiri[],
  musteriler: Musteri[],
  urunler: Urun[],
  kullanici: { uid: string }
): Promise<number> {
  const db = requireDb()
  const gecerliSatirlar = satirlar.filter((s) => s.kalemler.some((k) => k.adet > 0))
  if (gecerliSatirlar.length === 0) return 0

  const batch = writeBatch(db)
  const tlDeltalari = new Map<string, number>()
  const unDeltalari = new Map<string, number>()
  let kayitSayisi = 0

  for (const satir of gecerliSatirlar) {
    const musteri = musteriler.find((m) => m.id === satir.musteriId)
    const onerilenDurum: VeresiyeDurumu = satir.odendi ? 'nakit' : 'veresiye'

    for (const kalem of satir.kalemler) {
      if (kalem.adet <= 0) continue
      const urun = urunler.find((u) => u.id === kalem.productId)
      const { durum, esdegerAdet } = kayitDurumuHesapla(musteri, urun, kalem.adet, onerilenDurum)
      const tutar = kalem.adet * kalem.birimFiyat
      const kayitRef = doc(collection(db, KOLEKSIYON))
      batch.set(kayitRef, {
        musteriId: satir.musteriId,
        musteriAdi: satir.musteriAdi,
        productId: kalem.productId,
        urunAdi: kalem.urunAdi,
        adet: kalem.adet,
        birimFiyat: kalem.birimFiyat,
        tutar,
        tarih: satir.tarih,
        durum,
        girisYontemi: 'manuel',
        kaynakSiparisId: null,
        esdegerAdet,
        olusturanUid: kullanici.uid,
        olusturmaTarihi: serverTimestamp(),
        guncellenmeTarihi: serverTimestamp()
      })
      kayitSayisi += 1

      const etki = bakiyeEtkisi(durum, tutar)
      if (etki !== 0) tlDeltalari.set(satir.musteriId, (tlDeltalari.get(satir.musteriId) ?? 0) + etki)
      if (esdegerAdet !== 0) unDeltalari.set(satir.musteriId, (unDeltalari.get(satir.musteriId) ?? 0) + esdegerAdet)
    }
  }

  const tumMusteriIdler = new Set([...tlDeltalari.keys(), ...unDeltalari.keys()])
  for (const musteriId of tumMusteriIdler) {
    const guncelleme: Record<string, unknown> = {}
    const tlDelta = tlDeltalari.get(musteriId)
    const unDelta = unDeltalari.get(musteriId)
    if (tlDelta) guncelleme.veresiyeBakiye = increment(tlDelta)
    if (unDelta) guncelleme['unHesabi.birikenEsdegerAdet'] = increment(unDelta)
    batch.update(doc(db, 'musteriler', musteriId), guncelleme)
  }

  await batch.commit()
  return kayitSayisi
}

// --- Müşteriye özel fiyat: geçmişe uygulama ---

export interface GecmiseUygulaSonucu {
  guncellenenSayisi: number
}

/**
 * Bir müşterinin belirli bir üründeki TÜM geçmiş veresiye_kayitlar satırlarının
 * birim fiyatını yeni özel fiyatla yeniden hesaplar (adet aynı kalır, tutar ve
 * — durum='veresiye' olan satırlar için — müşterinin güncel bakiyesi buna göre
 * düzeltilir). Yalnızca veresiye_kayitlar'ı kapsar; sipariş/okul modüllerindeki
 * geçmiş snapshot'lar (kendi kayıtlarında zaten donmuş olduğu için) etkilenmez.
 */
export async function ozelFiyatiGecmiseUygula(
  musteriId: string,
  productId: string,
  yeniFiyat: number
): Promise<GecmiseUygulaSonucu> {
  const db = requireDb()
  const snap = await getDocs(
    query(collection(db, KOLEKSIYON), where('musteriId', '==', musteriId), where('productId', '==', productId))
  )
  if (snap.empty) return { guncellenenSayisi: 0 }

  let toplamDelta = 0
  const KOD_PARCA_BOYUTU = 400 // Firestore batch limiti 500 — pay bırak

  for (let i = 0; i < snap.docs.length; i += KOD_PARCA_BOYUTU) {
    const parca = snap.docs.slice(i, i + KOD_PARCA_BOYUTU)
    const batch = writeBatch(db)
    for (const d of parca) {
      const veri = d.data() as VeresiyeKaydi
      const yeniTutar = veri.adet * yeniFiyat
      const eskiEtki = bakiyeEtkisi(veri.durum, veri.tutar)
      const yeniEtki = bakiyeEtkisi(veri.durum, yeniTutar)
      toplamDelta += yeniEtki - eskiEtki
      batch.update(d.ref, { birimFiyat: yeniFiyat, tutar: yeniTutar, guncellenmeTarihi: serverTimestamp() })
    }
    await batch.commit()
  }

  if (toplamDelta !== 0) {
    await writeBatchTekGuncelleme(musteriId, toplamDelta)
  }

  return { guncellenenSayisi: snap.docs.length }
}

async function writeBatchTekGuncelleme(musteriId: string, delta: number) {
  const db = requireDb()
  const batch = writeBatch(db)
  batch.update(doc(db, 'musteriler', musteriId), { veresiyeBakiye: increment(delta) })
  await batch.commit()
}

export { esdegerAdetToplamHesapla }
