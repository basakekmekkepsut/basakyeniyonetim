import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import { musteriKullanimdaMi } from '../../shared/kullanimKontrolu'
import { altiHaneliParolaUret } from '../../shared/musteriYardimci'
import type { Musteri, MusteriGirisi } from '../../lib/types'

const KOLEKSIYON = 'musteriler'

/**
 * copKutusu:false (varsayılan) — silindi!=true olan tüm müşterileri döndürür; bu
 * sayede MusteriSecici, Günlük Giriş, Sipariş/Veresiye formları gibi TÜM diğer
 * kullanım yerleri hiçbir ek filtre yazmadan çöp kutusundaki müşterileri otomatik
 * olarak göstermez. copKutusu:true yalnızca Ayarlar > Müşteriler'in çöp kutusu
 * görünümünde kullanılır. Firestore sorgusu hâlâ tüm koleksiyonu dinler — eski
 * (silindi alanı hiç yazılmamış) dokümanlar da bu sayede "silinmemiş" sayılır.
 */
export function useMusteriler(opts?: { copKutusu?: boolean }) {
  const [tumMusteriler, setTumMusteriler] = useState<Musteri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), KOLEKSIYON), orderBy('ad'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTumMusteriler(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Musteri))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  const copKutusu = opts?.copKutusu ?? false
  const musteriler = useMemo(
    () => tumMusteriler.filter((m) => (copKutusu ? m.silindi === true : m.silindi !== true)),
    [tumMusteriler, copKutusu]
  )

  return { musteriler, yukleniyor, hata }
}

export async function musteriEkle(girisi: MusteriGirisi): Promise<void> {
  await addDoc(collection(requireDb(), KOLEKSIYON), {
    ...girisi,
    silindi: false,
    veresiyeBakiye: girisi.acilisBakiyesi,
    // Portal linki için kod = doküman ID'sinin kendisi; parola sadece
    // veresiye müşterileri için baştan üretilir (bkz. Müşteri Portalı).
    portalSifre: girisi.moduller.includes('veresiye') ? altiHaneliParolaUret() : null,
    olusturmaTarihi: serverTimestamp(),
    guncellenmeTarihi: serverTimestamp()
  })
}

export async function musteriGuncelle(id: string, girisi: MusteriGirisi): Promise<void> {
  const ref = doc(requireDb(), KOLEKSIYON, id)

  await runTransaction(requireDb(), async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Müşteri bulunamadı.')

    const mevcut = snap.data() as Musteri
    // Açılış bakiyesi değişirse, güncel bakiyeyi aynı miktarda kaydır — böylece
    // borç/tahsilat geçmişi bozulmadan devreden bakiye düzeltilmiş olur.
    const acilisFarki = girisi.acilisBakiyesi - mevcut.acilisBakiyesi

    const guncelleme: Record<string, unknown> = {
      ...girisi,
      veresiyeBakiye: mevcut.veresiyeBakiye + acilisFarki,
      guncellenmeTarihi: serverTimestamp()
    }
    // Sonradan Veresiye modülüne eklenen bir müşterinin henüz portal şifresi yoksa üret.
    if (girisi.moduller.includes('veresiye') && !mevcut.portalSifre) {
      guncelleme.portalSifre = altiHaneliParolaUret()
    }

    tx.update(ref, guncelleme)
  })
}

/**
 * Sipariş ekranında serbest metinle (kayıtlı müşteri seçmeden) girilen bir isim için
 * çağrılır. Aynı ad'a (tam, boşluk kırpılmış eşleşme) sahip bir müşteri zaten varsa
 * onu döndürür; yoksa "gecici" bir müşteri profili oluşturur. Böylece her serbest
 * metin siparişi baştan itibaren gerçek bir musteriId'ye bağlanır — sonradan "kalıcı
 * müşteri yap" (bkz. musteriKaliciYap) yalnızca gecici bayrağını çevirir, geçmiş
 * siparişleri yeniden bağlamaya gerek kalmaz.
 */
export async function serbestMusteriBulYaOlustur(ad: string): Promise<{ id: string; yeniMi: boolean }> {
  const adTemiz = ad.trim()
  const mevcutSnap = await getDocs(query(collection(requireDb(), KOLEKSIYON), where('ad', '==', adTemiz)))
  if (!mevcutSnap.empty) {
    const mevcutDoc = mevcutSnap.docs[0]
    // Daha önce çöp kutusuna taşınmış aynı isimli bir müşteri varsa, yeni bir
    // kopya oluşturmak yerine onu sessizce geri yükleyip yeniden kullanıyoruz.
    if ((mevcutDoc.data() as Musteri).silindi) {
      await updateDoc(mevcutDoc.ref, { silindi: false, guncellenmeTarihi: serverTimestamp() })
    }
    return { id: mevcutDoc.id, yeniMi: false }
  }

  const ref = await addDoc(collection(requireDb(), KOLEKSIYON), {
    ad: adTemiz,
    adSoyad: '',
    hitapSekli: null,
    telefon: '',
    adres: '',
    moduller: ['siparis'],
    aktif: true,
    gecici: true,
    silindi: false,
    acilisBakiyesi: 0,
    veresiyeBakiye: 0,
    ozelFiyatlar: {},
    sikUrunler: [],
    unHesabi: null,
    portalSifre: null,
    olusturmaTarihi: serverTimestamp(),
    guncellenmeTarihi: serverTimestamp()
  })
  return { id: ref.id, yeniMi: true }
}

/** "Geçici" bir müşteriyi kalıcıya çevirir. Zaten musteriId'ye bağlı olan geçmiş kayıtlar bu sayede otomatik olarak profile bağlı kalır. */
export async function musteriKaliciYap(musteriId: string): Promise<void> {
  await updateDoc(doc(requireDb(), KOLEKSIYON, musteriId), { gecici: false, guncellenmeTarihi: serverTimestamp() })
}

export async function portalSifreYenile(musteriId: string): Promise<string> {
  const yeniParola = altiHaneliParolaUret()
  await updateDoc(doc(requireDb(), KOLEKSIYON, musteriId), { portalSifre: yeniParola, guncellenmeTarihi: serverTimestamp() })
  return yeniParola
}

export async function musteriAktifDurumDegistir(id: string, aktif: boolean): Promise<void> {
  await updateDoc(doc(requireDb(), KOLEKSIYON, id), { aktif, guncellenmeTarihi: serverTimestamp() })
}

/** Müşteriyi çöp kutusuna taşır — geri alınabilir, hiçbir seçici/listede artık görünmez. */
export async function musteriCopeTasi(musteri: Musteri): Promise<void> {
  await updateDoc(doc(requireDb(), KOLEKSIYON, musteri.id), { silindi: true, guncellenmeTarihi: serverTimestamp() })
}

/** Çöp kutusundaki bir müşteriyi geri yükler. */
export async function musteriGeriYukle(musteri: Musteri): Promise<void> {
  await updateDoc(doc(requireDb(), KOLEKSIYON, musteri.id), { silindi: false, guncellenmeTarihi: serverTimestamp() })
}

/** Çöp kutusundan kalıcı olarak siler — yalnızca açık bakiyesi/aktif bağlantısı olmayan müşteriler için. */
export async function musteriKaliciSil(musteri: Musteri): Promise<void> {
  const sebep = await musteriKullanimdaMi(musteri.id, musteri.veresiyeBakiye)
  if (sebep) throw new Error(`Müşteri kalıcı silinemedi: ${sebep}`)
  await deleteDoc(doc(requireDb(), KOLEKSIYON, musteri.id))
}
