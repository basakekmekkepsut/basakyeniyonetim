import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import { altiHaneliParolaUret } from '../../shared/musteriYardimci'
import type {
  GunlukDurumu,
  GunlukKaydi,
  GunlukMusteri,
  GunlukMusteriGirisi,
  GunlukOdeme,
  GunlukOdemeFormVerisi
} from '../../lib/types'

// Ana Veresiye'den (musteriler / veresiye_kayitlar / veresiye_odemeler) tamamen
// ayrı koleksiyonlar — bkz. lib/types.ts "Günlük Veresiye modülü".
const MUSTERI_KOLEKSIYONU = 'gunluk_musteriler'
const KAYIT_KOLEKSIYONU = 'gunluk_kayitlar'
const ODEME_KOLEKSIYONU = 'gunluk_odemeler'

export interface GunlukFiltre {
  baslangic: string | null
  bitis: string | null
  musteriId: string | null
}

function bakiyeEtkisi(durum: GunlukDurumu, tutar: number) {
  return durum === 'veresiye' ? tutar : 0
}

// --- Müşteriler ---

export function useGunlukMusteriler() {
  const [musteriler, setMusteriler] = useState<GunlukMusteri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), MUSTERI_KOLEKSIYONU), orderBy('ad'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMusteriler(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GunlukMusteri))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  return { musteriler, yukleniyor, hata }
}

export async function gunlukMusteriEkle(girisi: GunlukMusteriGirisi): Promise<{ id: string }> {
  const ref = await addDoc(collection(requireDb(), MUSTERI_KOLEKSIYONU), {
    ...girisi,
    bakiye: girisi.acilisBakiyesi,
    portalSifre: altiHaneliParolaUret(),
    olusturmaTarihi: serverTimestamp(),
    guncellenmeTarihi: serverTimestamp()
  })
  return { id: ref.id }
}

export async function gunlukMusteriGuncelle(id: string, girisi: GunlukMusteriGirisi): Promise<void> {
  const db = requireDb()
  const ref = doc(db, MUSTERI_KOLEKSIYONU, id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Müşteri bulunamadı.')
    const mevcut = snap.data() as GunlukMusteri
    // Açılış bakiyesi değişirse güncel bakiye aynı miktarda kayar — geçmiş
    // hareketler bozulmadan devreden borç düzeltilmiş olur (bkz. musteriler/data.ts).
    const acilisFarki = girisi.acilisBakiyesi - mevcut.acilisBakiyesi
    tx.update(ref, {
      ...girisi,
      bakiye: mevcut.bakiye + acilisFarki,
      // Portal özelliğinden önce açılmış müşteriye ilk düzenlemede şifre verilir.
      ...(mevcut.portalSifre ? {} : { portalSifre: altiHaneliParolaUret() }),
      guncellenmeTarihi: serverTimestamp()
    })
  })
}

/** Yeni portal şifresi üretir (eski şifre/link artık çalışmaz) — şifresi hiç olmayan müşteriye de şifre verir. */
export async function gunlukPortalSifreYenile(id: string): Promise<string> {
  const yeniParola = altiHaneliParolaUret()
  await updateDoc(doc(requireDb(), MUSTERI_KOLEKSIYONU, id), { portalSifre: yeniParola, guncellenmeTarihi: serverTimestamp() })
  return yeniParola
}

export async function gunlukMusteriAktifDurumDegistir(id: string, aktif: boolean): Promise<void> {
  await updateDoc(doc(requireDb(), MUSTERI_KOLEKSIYONU, id), { aktif, guncellenmeTarihi: serverTimestamp() })
}

/** Yalnızca hiç hareketi olmayan ve bakiyesi sıfır olan müşteri silinebilir — aksi halde "Pasif" yapılır. */
export async function gunlukMusteriSil(musteri: GunlukMusteri): Promise<void> {
  const db = requireDb()
  if (musteri.bakiye !== 0) throw new Error('Müşterinin açık bakiyesi var, silinemez. Önce "Pasif" yapabilirsiniz.')
  const [kayitSnap, odemeSnap] = await Promise.all([
    getDocs(query(collection(db, KAYIT_KOLEKSIYONU), where('musteriId', '==', musteri.id), limit(1))),
    getDocs(query(collection(db, ODEME_KOLEKSIYONU), where('musteriId', '==', musteri.id), limit(1)))
  ])
  if (!kayitSnap.empty || !odemeSnap.empty) {
    throw new Error('Müşterinin geçmiş hareketleri var, silinemez. Önce "Pasif" yapabilirsiniz.')
  }
  await deleteDoc(doc(db, MUSTERI_KOLEKSIYONU, musteri.id))
}

// --- Kayıtlar (kasadan alınan ürünler) ---

export function useGunlukKayitlar(filtre: GunlukFiltre) {
  const [kayitlar, setKayitlar] = useState<GunlukKaydi[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    setYukleniyor(true)
    const kisitlar = []
    if (filtre.musteriId) kisitlar.push(where('musteriId', '==', filtre.musteriId))
    if (filtre.baslangic) kisitlar.push(where('tarih', '>=', filtre.baslangic))
    if (filtre.bitis) kisitlar.push(where('tarih', '<=', filtre.bitis))

    const q = query(collection(requireDb(), KAYIT_KOLEKSIYONU), ...kisitlar, orderBy('tarih', 'desc'))
    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        setKayitlar(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GunlukKaydi))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [filtre.baslangic, filtre.bitis, filtre.musteriId])

  return { kayitlar, yukleniyor, hata }
}

export interface GunlukKalem {
  productId: string
  urunAdi: string
  adet: number
  birimFiyat: number
}

export interface GunlukKayitFormVerisi {
  musteriId: string
  musteriAdi: string
  tarih: string
  durum: GunlukDurumu
  kalemler: GunlukKalem[]
}

/** Bir müşterinin aynı anda aldığı tüm ürünleri (her biri ayrı kayıt) tek batch'te yazar. */
export async function gunlukKayitlarEkle(veri: GunlukKayitFormVerisi, kullanici: { uid: string }): Promise<void> {
  const db = requireDb()
  const batch = writeBatch(db)
  let toplamEtki = 0

  for (const kalem of veri.kalemler) {
    if (kalem.adet <= 0) continue
    const tutar = kalem.adet * kalem.birimFiyat
    batch.set(doc(collection(db, KAYIT_KOLEKSIYONU)), {
      musteriId: veri.musteriId,
      musteriAdi: veri.musteriAdi,
      productId: kalem.productId,
      urunAdi: kalem.urunAdi,
      adet: kalem.adet,
      birimFiyat: kalem.birimFiyat,
      tutar,
      tarih: veri.tarih,
      durum: veri.durum,
      olusturanUid: kullanici.uid,
      olusturmaTarihi: serverTimestamp(),
      guncellenmeTarihi: serverTimestamp()
    })
    toplamEtki += bakiyeEtkisi(veri.durum, tutar)
  }

  if (toplamEtki !== 0) {
    batch.update(doc(db, MUSTERI_KOLEKSIYONU, veri.musteriId), { bakiye: increment(toplamEtki) })
  }
  await batch.commit()
}

export async function gunlukKaydiGuncelle(
  mevcut: GunlukKaydi,
  veri: { musteriId: string; musteriAdi: string; tarih: string; durum: GunlukDurumu } & GunlukKalem
): Promise<void> {
  const db = requireDb()
  const yeniTutar = veri.adet * veri.birimFiyat
  const eskiEtki = bakiyeEtkisi(mevcut.durum, mevcut.tutar)
  const yeniEtki = bakiyeEtkisi(veri.durum, yeniTutar)

  const batch = writeBatch(db)
  batch.update(doc(db, KAYIT_KOLEKSIYONU, mevcut.id), {
    musteriId: veri.musteriId,
    musteriAdi: veri.musteriAdi,
    productId: veri.productId,
    urunAdi: veri.urunAdi,
    adet: veri.adet,
    birimFiyat: veri.birimFiyat,
    tutar: yeniTutar,
    tarih: veri.tarih,
    durum: veri.durum,
    guncellenmeTarihi: serverTimestamp()
  })
  // Müşteri değiştiyse eski müşteriden etkiyi geri al, yenisine ekle.
  if (veri.musteriId !== mevcut.musteriId) {
    if (eskiEtki !== 0) batch.update(doc(db, MUSTERI_KOLEKSIYONU, mevcut.musteriId), { bakiye: increment(-eskiEtki) })
    if (yeniEtki !== 0) batch.update(doc(db, MUSTERI_KOLEKSIYONU, veri.musteriId), { bakiye: increment(yeniEtki) })
  } else if (yeniEtki !== eskiEtki) {
    batch.update(doc(db, MUSTERI_KOLEKSIYONU, veri.musteriId), { bakiye: increment(yeniEtki - eskiEtki) })
  }
  await batch.commit()
}

export async function gunlukKaydiSil(mevcut: GunlukKaydi): Promise<void> {
  const db = requireDb()
  const batch = writeBatch(db)
  batch.delete(doc(db, KAYIT_KOLEKSIYONU, mevcut.id))
  const etki = bakiyeEtkisi(mevcut.durum, mevcut.tutar)
  if (etki !== 0) batch.update(doc(db, MUSTERI_KOLEKSIYONU, mevcut.musteriId), { bakiye: increment(-etki) })
  await batch.commit()
}

// --- Ödemeler ---

export function useGunlukOdemeler(filtre: GunlukFiltre) {
  const [odemeler, setOdemeler] = useState<GunlukOdeme[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    setYukleniyor(true)
    const kisitlar = []
    if (filtre.musteriId) kisitlar.push(where('musteriId', '==', filtre.musteriId))
    if (filtre.baslangic) kisitlar.push(where('tarih', '>=', filtre.baslangic))
    if (filtre.bitis) kisitlar.push(where('tarih', '<=', filtre.bitis))

    const q = query(collection(requireDb(), ODEME_KOLEKSIYONU), ...kisitlar, orderBy('tarih', 'desc'))
    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        setOdemeler(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GunlukOdeme))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [filtre.baslangic, filtre.bitis, filtre.musteriId])

  return { odemeler, yukleniyor, hata }
}

export async function gunlukOdemeEkle(veri: GunlukOdemeFormVerisi, kullanici: { uid: string }): Promise<void> {
  const db = requireDb()
  const batch = writeBatch(db)
  batch.set(doc(collection(db, ODEME_KOLEKSIYONU)), {
    ...veri,
    olusturanUid: kullanici.uid,
    olusturmaTarihi: serverTimestamp()
  })
  batch.update(doc(db, MUSTERI_KOLEKSIYONU, veri.musteriId), { bakiye: increment(-veri.tutar) })
  await batch.commit()
}

export async function gunlukOdemeGuncelle(mevcut: GunlukOdeme, veri: GunlukOdemeFormVerisi): Promise<void> {
  const db = requireDb()
  const batch = writeBatch(db)
  batch.update(doc(db, ODEME_KOLEKSIYONU, mevcut.id), { ...veri })
  if (veri.musteriId !== mevcut.musteriId) {
    batch.update(doc(db, MUSTERI_KOLEKSIYONU, mevcut.musteriId), { bakiye: increment(mevcut.tutar) })
    batch.update(doc(db, MUSTERI_KOLEKSIYONU, veri.musteriId), { bakiye: increment(-veri.tutar) })
  } else if (veri.tutar !== mevcut.tutar) {
    batch.update(doc(db, MUSTERI_KOLEKSIYONU, veri.musteriId), { bakiye: increment(mevcut.tutar - veri.tutar) })
  }
  await batch.commit()
}

export async function gunlukOdemeSil(mevcut: GunlukOdeme): Promise<void> {
  const db = requireDb()
  const batch = writeBatch(db)
  batch.delete(doc(db, ODEME_KOLEKSIYONU, mevcut.id))
  batch.update(doc(db, MUSTERI_KOLEKSIYONU, mevcut.musteriId), { bakiye: increment(mevcut.tutar) })
  await batch.commit()
}
