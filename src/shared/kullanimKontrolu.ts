import { collection, getDocs, query, where } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import type { OkulSchool, SiparisSablonu, VeresiyeSablon } from '../lib/types'

/**
 * Bir ürünün silinmeden önce "aktif konfigürasyonlarda" kullanılıp kullanılmadığını
 * kontrol eder (FIRESTORE_SCHEMA.md §3). Geçmiş sipariş/veresiye kayıtları kontrol
 * EDİLMEZ — onlar ürün adı/fiyatını kayıt anında snapshot olarak sakladığı için
 * ürün silinse bile bozulmazlar (bkz. şema dokümanının "denormalize" ilkesi).
 * Yalnızca canlı, tekrar kullanılan yapılandırmalar (şablonlar, okul hatları,
 * un hesabı bağlantısı) kontrol edilir.
 */
export async function urunKullanimdaMi(productId: string): Promise<string | null> {
  const db = requireDb()

  const [siparisSablonlari, veresiyeSablonlari, okullar, unHesabiMusterileri] = await Promise.all([
    getDocs(collection(db, 'siparis_recurring_templates')),
    getDocs(collection(db, 'veresiye_sablonlar')),
    getDocs(collection(db, 'okul_schools')),
    getDocs(query(collection(db, 'musteriler'), where('unHesabi.urunId', '==', productId)))
  ])

  if (siparisSablonlari.docs.some((d) => (d.data() as SiparisSablonu).items.some((i) => i.productId === productId))) {
    return 'Sipariş şablonlarından birinde kullanılıyor.'
  }
  if (veresiyeSablonlari.docs.some((d) => (d.data() as VeresiyeSablon).kalemler.some((k) => k.productId === productId))) {
    return 'Veresiye giriş şablonlarından birinde kullanılıyor.'
  }
  if (okullar.docs.some((d) => (d.data() as OkulSchool).lines.some((l) => l.productId === productId))) {
    return 'Bir okulun hattında kullanılıyor.'
  }
  if (!unHesabiMusterileri.empty) {
    return 'Bir müşterinin Un Hesaplı Giriş ayarında kullanılıyor.'
  }

  return null
}

/**
 * Bir müşterinin silinmeden önce aktif finansal durumu veya bağlantısı olup
 * olmadığını kontrol eder — geçmiş sipariş/veresiye kayıtları (musteriAdi
 * snapshot'ı sayesinde) engel değildir, ama açık bakiye veya aktif
 * okul/firma/şablon bağlantısı varsa silme engellenir.
 */
export async function musteriKullanimdaMi(
  musteriId: string,
  guncelBakiye: number
): Promise<string | null> {
  if (guncelBakiye !== 0) {
    return 'Bu müşterinin kapanmamış bir veresiye bakiyesi var — önce bakiyeyi sıfırlayın.'
  }

  const db = requireDb()
  const [okullar, firmalar, siparisSablonlari, veresiyeSablonlari] = await Promise.all([
    getDocs(query(collection(db, 'okul_schools'), where('musteriId', '==', musteriId))),
    getDocs(query(collection(db, 'okul_firmalar'), where('musteriId', '==', musteriId))),
    getDocs(query(collection(db, 'siparis_recurring_templates'), where('musteriId', '==', musteriId))),
    getDocs(query(collection(db, 'veresiye_sablonlar'), where('musteriId', '==', musteriId)))
  ])

  if (!okullar.empty || !firmalar.empty) return 'Bir okul/firmanın bağımsız veresiye hesabı olarak bağlı.'
  if (!siparisSablonlari.empty) return 'Bir sipariş şablonunda kullanılıyor.'
  if (!veresiyeSablonlari.empty) return 'Bir veresiye giriş şablonunda kullanılıyor.'

  return null
}
