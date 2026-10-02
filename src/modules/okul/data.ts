import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import type { Musteri, OkulSchool, OkulSchoolFormVerisi } from '../../lib/types'

const OKULLAR = 'okul_schools'

export function useOkullar() {
  const [okullar, setOkullar] = useState<OkulSchool[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(requireDb(), OKULLAR), orderBy('ad'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOkullar(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OkulSchool))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
  }, [])

  return { okullar, yukleniyor, hata }
}

export async function okulEkle(veri: OkulSchoolFormVerisi): Promise<void> {
  await addDoc(collection(requireDb(), OKULLAR), veri)
}

// Silinen bir hattın (ya da okulun) önceden hazırlanmış, henüz kapanmamış
// siparişleri kalırsa Mesaj/Üretim/Ekstre'de "—" ürünüyle görünmeye ve
// toplamlara karışmaya devam eder — bu yüzden onlar da birlikte silinir.
// Kapanmış (kesinleşmiş) siparişlere dokunulmaz.
async function acikSiparisleriSil(schoolId: string, lineIdler: Set<string> | null): Promise<void> {
  const db = requireDb()
  const snap = await getDocs(query(collection(db, 'okul_orders'), where('schoolId', '==', schoolId), where('kapandiMi', '==', false)))
  const silinecek = snap.docs.filter((d) => lineIdler === null || lineIdler.has(d.data().lineId as string))
  for (let i = 0; i < silinecek.length; i += 400) {
    const batch = writeBatch(db)
    silinecek.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
}

export async function okulGuncelle(id: string, veri: OkulSchoolFormVerisi): Promise<void> {
  const ref = doc(requireDb(), OKULLAR, id)
  const eskiSnap = await getDoc(ref)
  const eskiHatlar = ((eskiSnap.data()?.lines as { id: string }[] | undefined) ?? []).map((l) => l.id)
  const yeniHatlar = new Set(veri.lines.map((l) => l.id))
  const silinenHatlar = new Set(eskiHatlar.filter((hatId) => !yeniHatlar.has(hatId)))
  await updateDoc(ref, { ...veri })
  if (silinenHatlar.size > 0) await acikSiparisleriSil(id, silinenHatlar)
}

export async function okulSil(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), OKULLAR, id))
  await acikSiparisleriSil(id, null)
}

export function yeniHatId(): string {
  return crypto.randomUUID()
}

export interface OkulGrup {
  anahtar: string
  baslik: string
  okullar: OkulSchool[]
}

/**
 * Okullar/Sipariş sayfalarında ortak kullanılan gruplama: önce "Okul Dışı"
 * (okulDegil) müşteriler, sonra AYNI Veresiye müşterisini paylaşan okullar
 * (o müşterinin adıyla, ör. "Yeniçeri"), en sonda kendi tekil hesabı olan
 * (veya hiç hesabı olmayan) okullar tek "Diğer Okullar" başlığı altında.
 */
export function okullariGrupla(okullarGirisi: OkulSchool[], musteriler: Musteri[]): OkulGrup[] {
  // Her grup içinde isim sırasına göre listelensin diye baştan sıralanır.
  const okullar = [...okullarGirisi].sort((a, b) => a.ad.localeCompare(b.ad, 'tr-TR'))
  const okulDisi = okullar.filter((o) => o.okulDegil)
  const kalan = okullar.filter((o) => !o.okulDegil)

  const musteriIdSayisi = new Map<string, number>()
  for (const o of kalan) {
    if (!o.musteriId) continue
    musteriIdSayisi.set(o.musteriId, (musteriIdSayisi.get(o.musteriId) ?? 0) + 1)
  }

  const ortakGruplar = new Map<string, OkulSchool[]>()
  const digerOkullar: OkulSchool[] = []
  for (const o of kalan) {
    const paylasimSayisi = o.musteriId ? (musteriIdSayisi.get(o.musteriId) ?? 0) : 0
    if (o.musteriId && paylasimSayisi > 1) {
      ortakGruplar.set(o.musteriId, [...(ortakGruplar.get(o.musteriId) ?? []), o])
    } else {
      digerOkullar.push(o)
    }
  }

  const gruplar: OkulGrup[] = []
  if (okulDisi.length > 0) gruplar.push({ anahtar: '__okul_disi__', baslik: 'Okul Dışı', okullar: okulDisi })
  for (const [musteriId, okullarGrubu] of ortakGruplar) {
    const baslik = musteriler.find((m) => m.id === musteriId)?.ad ?? '—'
    gruplar.push({ anahtar: musteriId, baslik, okullar: okullarGrubu })
  }
  if (digerOkullar.length > 0) gruplar.push({ anahtar: '__diger__', baslik: 'Diğer Okullar', okullar: digerOkullar })

  return gruplar
}
