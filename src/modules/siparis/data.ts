import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe
} from 'firebase/firestore'
import { requireDb } from '../../lib/firebase'
import { siparisiVeresiyeyeSenkronizeEt, type VeresiyeKalemGirisi } from '../../shared/veresiyeSenkron'
import { kayitDurumuHesapla } from '../../shared/unHesabi'
import type { Musteri, OdemeDurumu, Siparis, SiparisDurumu, SiparisFormVerisi, Urun, VeresiyeDurumu } from '../../lib/types'

const KOLEKSIYON = 'siparis_orders'

export interface SiparisFiltre {
  baslangic: string | null
  bitis: string | null
  silindi: boolean
  sadeceKendi: string | null // uid — null ise herkesin siparişleri
}

export function useSiparisler(filtre: SiparisFiltre) {
  const [siparisler, setSiparisler] = useState<Siparis[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    setYukleniyor(true)
    const kisitlar = [where('silindi', '==', filtre.silindi)]
    if (filtre.sadeceKendi) kisitlar.push(where('olusturanUid', '==', filtre.sadeceKendi))
    if (filtre.baslangic) kisitlar.push(where('teslimatTarihi', '>=', filtre.baslangic))
    if (filtre.bitis) kisitlar.push(where('teslimatTarihi', '<=', filtre.bitis))

    const q = query(collection(requireDb(), KOLEKSIYON), ...kisitlar, orderBy('teslimatTarihi'))
    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        setSiparisler(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Siparis))
        setYukleniyor(false)
      },
      (err) => {
        setHata(err.message)
        setYukleniyor(false)
      }
    )
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtre.baslangic, filtre.bitis, filtre.silindi, filtre.sadeceKendi])

  return { siparisler, yukleniyor, hata }
}

function kalemDurumu(veri: Pick<SiparisFormVerisi, 'odemeSekli'>, odemeDurumu: OdemeDurumu) {
  if (veri.odemeSekli === 'nakit') return 'nakit' as const
  return odemeDurumu === 'odendi' ? ('odendi' as const) : ('veresiye' as const)
}

function siparisAktifMi(durum: SiparisDurumu, silindi: boolean) {
  // 'planlandi': şablondan ileriye dönük üretilmiş, teslimat günü henüz gelmemiş
  // sipariş — veresiyeye YANSIMAZ (bkz. siparisPlanlananiAktifEt).
  return durum !== 'iptal' && durum !== 'planlandi' && !silindi
}

async function kaydetVeSenkronizeEt(
  mevcut: Siparis | null,
  veri: SiparisFormVerisi,
  ekstra: { durum: SiparisDurumu; odemeDurumu: OdemeDurumu; silindi: boolean },
  kullanici: { uid: string; ad: string }
): Promise<void> {
  const db = requireDb()
  const siparisRef = mevcut ? doc(db, KOLEKSIYON, mevcut.id) : doc(collection(db, KOLEKSIYON))
  const toplamTutar = veri.items.reduce((s, i) => s + i.adet * i.birimFiyat, 0)
  const aktif = siparisAktifMi(ekstra.durum, ekstra.silindi)
  const durumKalem = kalemDurumu(veri, ekstra.odemeDurumu)

  // Un Hesabı aktif müşterilerde sipariş de ücretsizdir — bkz. shared/unHesabi.ts.
  // musteri.gecici anlık görüntüsü listede "Geçici Müşteri" rozeti göstermek için her zaman okunur.
  const musteriSnap = await getDoc(doc(db, 'musteriler', veri.musteriId))
  const musteri: Musteri | undefined = musteriSnap.exists() ? (musteriSnap.data() as Musteri) : undefined
  let urunler: Urun[] = []
  if (aktif && veri.items.length > 0) {
    const productIds = [...new Set(veri.items.map((it) => it.productId))]
    const urunSnap = await getDocs(query(collection(db, 'products'), where(documentId(), 'in', productIds.slice(0, 30))))
    urunler = urunSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Urun)
  }

  const yeniKalemler: VeresiyeKalemGirisi[] = aktif
    ? veri.items.map((it) => {
        const urun = urunler.find((u) => u.id === it.productId)
        const { durum, esdegerAdet } = kayitDurumuHesapla(musteri, urun, it.adet, durumKalem)
        return {
          musteriId: veri.musteriId,
          musteriAdi: veri.musteriAdi,
          productId: it.productId,
          urunAdi: it.urunAdi,
          adet: it.adet,
          birimFiyat: it.birimFiyat,
          tarih: veri.teslimatTarihi,
          durum,
          girisYontemi: 'siparis' as const,
          kaynakSiparisId: siparisRef.id,
          esdegerAdet,
          olusturanUid: mevcut?.olusturanUid ?? kullanici.uid
        }
      })
    : []

  const siparisVerisi = {
    musteriId: veri.musteriId,
    musteriAdi: veri.musteriAdi,
    musteriGecici: musteri?.gecici ?? false,
    kaynakSablonId: mevcut?.kaynakSablonId ?? null,
    // Eski/göçürülmüş bazı belgelerde bu alanlar hiç yazılmamış olabilir (undefined) —
    // Firestore set()'e undefined göndermek "Unsupported field value" hatasıyla TÜM
    // yazmayı (dolayısıyla ödeme durumu değişikliğini de) sessizce başarısız kılar.
    adres: veri.adres ?? '',
    telefon: veri.telefon ?? '',
    not: veri.not ?? '',
    teslimatTarihi: veri.teslimatTarihi,
    items: veri.items,
    toplamTutar,
    durum: ekstra.durum,
    odemeSekli: veri.odemeSekli,
    odemeDurumu: ekstra.odemeDurumu,
    silindi: ekstra.silindi,
    silinmeTarihi: ekstra.silindi ? serverTimestamp() : null,
    olusturanUid: mevcut?.olusturanUid ?? kullanici.uid,
    olusturanAd: mevcut?.olusturanAd ?? kullanici.ad
  }

  await siparisiVeresiyeyeSenkronizeEt({
    db,
    siparisRef,
    siparisVerisi,
    musteriId: veri.musteriId,
    eskiKayitIdler: mevcut?.veresiyeKayitIdler ?? [],
    yeniKalemler,
    yeniKayit: !mevcut
  })
}

/**
 * Durumu hâlâ 'planlandi' olan TÜM siparişleri (görünürdeki tarih/durum filtresinden
 * bağımsız) getirir — SiparislerPage.tsx'teki otomatik aktivasyon efektinin, admin
 * hangi tarih aralığına bakıyor olursa olsun (ör. "Yaklaşan" görünümü gün değiştiğinde
 * geçmişte kalan bir siparişi listeden düşürebilir) teslimat günü geçmiş bir siparişi
 * asla gözden kaçırmaması için kullanılır.
 */
export function usePlanlananSiparisler(aktif: boolean) {
  const [siparisler, setSiparisler] = useState<Siparis[]>([])
  useEffect(() => {
    // Salt kendi siparişlerini görebilen (orderViewAll izni olmayan) personel için bu
    // sorgu çalıştırılmaz — güvenlik kuralları sahiplik dışı dokümanları reddedip
    // dinleyiciyi tamamen düşürür (bkz. firestore.rules siparis_orders okuma kuralı).
    if (!aktif) {
      setSiparisler([])
      return
    }
    const q = query(collection(requireDb(), KOLEKSIYON), where('durum', '==', 'planlandi'))
    const unsub = onSnapshot(q, (snap) => setSiparisler(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Siparis)))
    return unsub
  }, [aktif])
  return siparisler
}

/** Bir müşteriye ait (çöp kutusundakiler hariç) toplam sipariş sayısı — "kalıcı müşteri yap" önerisi eşiği için. */
export async function musteriSiparisSayisi(musteriId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(requireDb(), KOLEKSIYON), where('musteriId', '==', musteriId), where('silindi', '==', false))
  )
  return snap.data().count
}

/**
 * 'planlandi' bir siparişin teslimat günü geldiğinde çağrılır: siparişi 'yeni'ye
 * çevirir ve o an veresiye_kayitlar + müşteri bakiyesine yansıtır. Kendi transaction'ı
 * içinde siparişi TAZE okuyup durumunu kontrol ettiği için birden fazla istemci aynı
 * anda çağırsa bile güvenlidir (ilk commit eden kazanır, diğerleri no-op geçer) —
 * bkz. SiparislerPage.tsx'teki otomatik aktivasyon efekti.
 */
export async function siparisPlanlananiAktifEt(siparisId: string, urunler: Urun[], kullanici: { uid: string }): Promise<void> {
  const db = requireDb()
  const siparisRef = doc(db, KOLEKSIYON, siparisId)

  await runTransaction(db, async (tx) => {
    const siparisSnap = await tx.get(siparisRef)
    if (!siparisSnap.exists()) return
    const s = siparisSnap.data() as Siparis
    if (s.durum !== 'planlandi' || s.silindi) return // başka bir istemci zaten aktif etmiş

    const musteriRef = doc(db, 'musteriler', s.musteriId)
    const musteriSnap = await tx.get(musteriRef)
    const musteri = musteriSnap.exists() ? (musteriSnap.data() as Musteri) : undefined
    const durumKalem: VeresiyeDurumu = s.odemeSekli === 'nakit' ? 'nakit' : 'veresiye'

    const yeniRefler = s.items.map(() => doc(collection(db, 'veresiye_kayitlar')))
    let delta = 0
    let unDelta = 0
    s.items.forEach((it, i) => {
      const urun = urunler.find((u) => u.id === it.productId)
      const { durum, esdegerAdet } = kayitDurumuHesapla(musteri, urun, it.adet, durumKalem)
      const tutar = it.adet * it.birimFiyat
      if (durum === 'veresiye') delta += tutar
      unDelta += esdegerAdet
      tx.set(yeniRefler[i], {
        musteriId: s.musteriId,
        musteriAdi: s.musteriAdi,
        productId: it.productId,
        urunAdi: it.urunAdi,
        adet: it.adet,
        birimFiyat: it.birimFiyat,
        tutar,
        tarih: s.teslimatTarihi,
        durum,
        girisYontemi: 'siparis' as const,
        kaynakSiparisId: siparisId,
        esdegerAdet,
        olusturanUid: kullanici.uid,
        olusturmaTarihi: serverTimestamp(),
        guncellenmeTarihi: serverTimestamp()
      })
    })

    const musteriGuncelleme: Record<string, unknown> = {}
    if (delta !== 0) musteriGuncelleme.veresiyeBakiye = increment(delta)
    if (unDelta !== 0) musteriGuncelleme['unHesabi.birikenEsdegerAdet'] = increment(unDelta)
    if (Object.keys(musteriGuncelleme).length > 0) tx.update(musteriRef, musteriGuncelleme)

    tx.update(siparisRef, {
      durum: 'yeni' as const,
      veresiyeKayitIdler: yeniRefler.map((r) => r.id),
      guncellenmeTarihi: serverTimestamp()
    })
  })
}

export async function siparisEkle(veri: SiparisFormVerisi, kullanici: { uid: string; ad: string }): Promise<void> {
  await kaydetVeSenkronizeEt(null, veri, { durum: 'yeni', odemeDurumu: 'odenmedi', silindi: false }, kullanici)
}

export async function siparisGuncelle(
  mevcut: Siparis,
  veri: SiparisFormVerisi,
  kullanici: { uid: string; ad: string }
): Promise<void> {
  await kaydetVeSenkronizeEt(
    mevcut,
    veri,
    { durum: mevcut.durum, odemeDurumu: mevcut.odemeDurumu, silindi: mevcut.silindi },
    kullanici
  )
}

export async function siparisDurumGuncelle(
  mevcut: Siparis,
  yeniDurum: SiparisDurumu,
  kullanici: { uid: string; ad: string }
): Promise<void> {
  const veri: SiparisFormVerisi = {
    musteriId: mevcut.musteriId,
    musteriAdi: mevcut.musteriAdi,
    adres: mevcut.adres,
    telefon: mevcut.telefon,
    not: mevcut.not,
    teslimatTarihi: mevcut.teslimatTarihi,
    items: mevcut.items,
    odemeSekli: mevcut.odemeSekli
  }
  await kaydetVeSenkronizeEt(mevcut, veri, { durum: yeniDurum, odemeDurumu: mevcut.odemeDurumu, silindi: mevcut.silindi }, kullanici)
}

export async function siparisOdemeDurumuGuncelle(
  mevcut: Siparis,
  yeniOdemeDurumu: OdemeDurumu,
  kullanici: { uid: string; ad: string }
): Promise<void> {
  const veri: SiparisFormVerisi = {
    musteriId: mevcut.musteriId,
    musteriAdi: mevcut.musteriAdi,
    adres: mevcut.adres,
    telefon: mevcut.telefon,
    not: mevcut.not,
    teslimatTarihi: mevcut.teslimatTarihi,
    items: mevcut.items,
    odemeSekli: mevcut.odemeSekli
  }
  await kaydetVeSenkronizeEt(mevcut, veri, { durum: mevcut.durum, odemeDurumu: yeniOdemeDurumu, silindi: mevcut.silindi }, kullanici)
}

export async function siparisCopeTasi(mevcut: Siparis, kullanici: { uid: string; ad: string }): Promise<void> {
  const veri: SiparisFormVerisi = {
    musteriId: mevcut.musteriId,
    musteriAdi: mevcut.musteriAdi,
    adres: mevcut.adres,
    telefon: mevcut.telefon,
    not: mevcut.not,
    teslimatTarihi: mevcut.teslimatTarihi,
    items: mevcut.items,
    odemeSekli: mevcut.odemeSekli
  }
  await kaydetVeSenkronizeEt(mevcut, veri, { durum: mevcut.durum, odemeDurumu: mevcut.odemeDurumu, silindi: true }, kullanici)
}

export async function siparisGeriYukle(mevcut: Siparis, kullanici: { uid: string; ad: string }): Promise<void> {
  const veri: SiparisFormVerisi = {
    musteriId: mevcut.musteriId,
    musteriAdi: mevcut.musteriAdi,
    adres: mevcut.adres,
    telefon: mevcut.telefon,
    not: mevcut.not,
    teslimatTarihi: mevcut.teslimatTarihi,
    items: mevcut.items,
    odemeSekli: mevcut.odemeSekli
  }
  await kaydetVeSenkronizeEt(mevcut, veri, { durum: mevcut.durum, odemeDurumu: mevcut.odemeDurumu, silindi: false }, kullanici)
}

// Kalıcı silme: yalnızca çöp kutusundaki (silindi:true, dolayısıyla veresiye
// bağlantısı zaten sıfırlanmış) siparişler için kullanılır — admin-only, UI katmanında kısıtlanır.
export async function siparisKaliciSil(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), KOLEKSIYON, id))
}
