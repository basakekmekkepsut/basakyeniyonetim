import { useEffect, useState } from 'react'
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

export function useMusteriler() {
  const [musteriler, setMusteriler] = useState<Musteri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), KOLEKSIYON), orderBy('ad'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMusteriler(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Musteri))
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

export async function musteriEkle(girisi: MusteriGirisi): Promise<void> {
  await addDoc(collection(requireDb(), KOLEKSIYON), {
    ...girisi,
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
  if (!mevcutSnap.empty) return { id: mevcutSnap.docs[0].id, yeniMi: false }

  const ref = await addDoc(collection(requireDb(), KOLEKSIYON), {
    ad: adTemiz,
    adSoyad: '',
    hitapSekli: null,
    telefon: '',
    adres: '',
    moduller: ['siparis'],
    aktif: true,
    gecici: true,
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

export async function musteriSil(musteri: Musteri): Promise<void> {
  const sebep = await musteriKullanimdaMi(musteri.id, musteri.veresiyeBakiye)
  if (sebep) throw new Error(`Müşteri silinemedi: ${sebep} Önce "Pasif" yapabilirsiniz.`)
  await deleteDoc(doc(requireDb(), KOLEKSIYON, musteri.id))
}
