import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
  type Firestore
} from 'firebase/firestore'
import type { VeresiyeDurumu, VeresiyeGirisYontemi } from '../lib/types'

export interface VeresiyeKalemGirisi {
  musteriId: string
  musteriAdi: string
  productId: string
  urunAdi: string
  adet: number
  birimFiyat: number
  tarih: string
  durum: VeresiyeDurumu
  girisYontemi: VeresiyeGirisYontemi
  kaynakSiparisId?: string | null
  esdegerAdet?: number // Un Hesabı aktifse adet×unKatsayisi, değilse 0/atlanır
  olusturanUid: string
}

/**
 * Bir siparişin (sipariş_orders dokümanı) ilişkili veresiye_kayitlar satırlarını
 * baştan oluşturur: eski kayıtları siler + bakiye etkisini geri alır, yeni kalemler
 * için kayıt oluşturur + bakiyeyi günceller — hepsi tek transaction içinde.
 *
 * Sipariş oluşturma (eskiKayitIdler:[]), düzenleme, iptal/silme (yeniKalemler:[])
 * ve geri yükleme hep bu tek fonksiyondan geçer (PLAN.md §7 madde 4).
 */
export async function siparisiVeresiyeyeSenkronizeEt(params: {
  db: Firestore
  siparisRef: DocumentReference
  siparisVerisi: Record<string, unknown>
  musteriId: string
  eskiKayitIdler: string[]
  yeniKalemler: VeresiyeKalemGirisi[]
  yeniKayit: boolean
}): Promise<string[]> {
  const { db, siparisRef, siparisVerisi, musteriId, eskiKayitIdler, yeniKalemler, yeniKayit } = params
  const musteriRef = doc(db, 'musteriler', musteriId)

  return runTransaction(db, async (tx) => {
    // Firestore transaction kuralı: TÜM okumalar TÜM yazmalardan önce yapılmalı.
    let eskiDelta = 0
    let eskiUnDelta = 0
    for (const id of eskiKayitIdler) {
      const snap = await tx.get(doc(db, 'veresiye_kayitlar', id))
      if (snap.exists()) {
        const veri = snap.data() as { durum: VeresiyeDurumu; tutar: number; esdegerAdet?: number }
        if (veri.durum === 'veresiye') eskiDelta += veri.tutar
        eskiUnDelta += veri.esdegerAdet ?? 0
      }
    }

    const yeniRefler = yeniKalemler.map(() => doc(collection(db, 'veresiye_kayitlar')))
    let yeniDelta = 0
    let yeniUnDelta = 0
    for (const kalem of yeniKalemler) {
      const tutar = kalem.adet * kalem.birimFiyat
      if (kalem.durum === 'veresiye') yeniDelta += tutar
      yeniUnDelta += kalem.esdegerAdet ?? 0
    }

    const delta = yeniDelta - eskiDelta
    const unDelta = yeniUnDelta - eskiUnDelta

    // --- okumalar bitti, artık sadece yazma ---

    yeniKalemler.forEach((kalem, i) => {
      const tutar = kalem.adet * kalem.birimFiyat
      tx.set(yeniRefler[i], {
        musteriId: kalem.musteriId,
        musteriAdi: kalem.musteriAdi,
        productId: kalem.productId,
        urunAdi: kalem.urunAdi,
        adet: kalem.adet,
        birimFiyat: kalem.birimFiyat,
        tutar,
        tarih: kalem.tarih,
        durum: kalem.durum,
        girisYontemi: kalem.girisYontemi,
        kaynakSiparisId: kalem.kaynakSiparisId ?? null,
        esdegerAdet: kalem.esdegerAdet ?? 0,
        olusturanUid: kalem.olusturanUid,
        olusturmaTarihi: serverTimestamp(),
        guncellenmeTarihi: serverTimestamp()
      })
    })

    for (const id of eskiKayitIdler) {
      tx.delete(doc(db, 'veresiye_kayitlar', id))
    }

    const musteriGuncelleme: Record<string, unknown> = {}
    if (delta !== 0) musteriGuncelleme.veresiyeBakiye = increment(delta)
    if (unDelta !== 0) musteriGuncelleme['unHesabi.birikenEsdegerAdet'] = increment(unDelta)
    if (Object.keys(musteriGuncelleme).length > 0) {
      tx.update(musteriRef, musteriGuncelleme)
    }

    const yeniKayitIdler = yeniRefler.map((r) => r.id)
    tx.set(
      siparisRef,
      {
        ...siparisVerisi,
        veresiyeKayitIdler: yeniKayitIdler,
        guncellenmeTarihi: serverTimestamp(),
        ...(yeniKayit ? { olusturmaTarihi: serverTimestamp() } : {})
      },
      { merge: true }
    )

    return yeniKayitIdler
  })
}
