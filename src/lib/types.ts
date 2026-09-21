export type Rol = 'admin' | 'personel'

export interface KullaniciProfili {
  ad: string
  eposta: string
  rol: Rol
  modules: {
    siparis: boolean
    veresiye: boolean
    okul: boolean
  }
  permissions: {
    siparis: { orderAdd: boolean; orderViewAll: boolean; products: boolean }
    veresiye: { gorebilecegiMusteriler: string[] | 'all' }
    okul: {
      siparis: boolean
      okullar: boolean
      urunler: boolean
      ekstre: boolean
      mesaj: boolean
    }
  }
  aktif: boolean
}

export type Modul = 'siparis' | 'veresiye' | 'okul'

export type HitapSekli = 'bay' | 'hanim' | null

/**
 * KESİNLEŞTİ (2026-09-16): Un Hesabı olan müşteride ekmek tamamen ÜCRETSİZDİR —
 * ödeme yalnızca un (çuval) ile yapılır. Bu yüzden TL bakiyesinden (veresiyeBakiye)
 * TAMAMEN BAĞIMSIZ, ayrı bir "eşdeğer adet" defteri tutulur:
 * - Müşteri ekmek aldıkça birikenEsdegerAdet ARTAR (adet × ürünün unKatsayisi).
 * - Müşteri un (çuval) getirdikçe birikenEsdegerAdet AZALIR (çuval × adetPerCuval).
 * Pozitif değer = müşterinin henüz un ile karşılamadığı ekmek borcu (adet cinsinden).
 */
export interface UnHesabi {
  aktif: boolean
  referansUrunId: string | null // örn. Baston Ekmek — "1 çuval kaç adet eder" bu ürün cinsindendir
  adetPerCuval: number | null // 1 çuval un kaç adet referans ürüne eşdeğer
  birikenEsdegerAdet: number // net eşdeğer adet bakiyesi (+ borç, - fazla un)
}

export interface Musteri {
  id: string
  ad: string
  adSoyad: string // WhatsApp mesajlarında hitap için tam ad (boşsa `ad` kullanılır)
  hitapSekli: HitapSekli
  telefon: string
  adres: string
  moduller: Modul[]
  aktif: boolean
  gecici: boolean // Düğün/dernek gibi tek seferlik müşteri — ana listelerde varsayılan gizli
  silindi: boolean // Çöp kutusuna taşındı mı — true ise hiçbir seçici/listede görünmez (bkz. musteriler/data.ts)
  acilisBakiyesi: number // "Geçmiş Bakiye" — sisteme geçmeden önceki devreden borç
  veresiyeBakiye: number
  ozelFiyatlar: Record<string, number>
  sikUrunler: string[] // Günlük Giriş'te gösterilecek ürün ID'leri — boşsa tüm veresiye ürünleri gösterilir
  unHesabi: UnHesabi | null
  portalSifre: string | null // 6 haneli müşteri portalı parolası (kod = musteri.id)
}

export type MusteriGirisi = Omit<Musteri, 'id' | 'veresiyeBakiye' | 'portalSifre' | 'silindi'>

export interface Urun {
  id: string
  ad: string
  fiyat: number
  aktif: boolean
  modules: Modul[]
  unKatsayisi: number // Un Hesabı: bu üründen 1 adet, referans üründen kaç adete eşdeğer (varsayılan 1)
}

export type UrunGirisi = Omit<Urun, 'id'>

export interface TelegramAyarlari {
  chatIds: {
    siparis: string
    veresiye: string
    okul: string
  }
}

export type VeresiyeDurumu = 'veresiye' | 'odendi' | 'nakit' | 'un_odemeli'
export type VeresiyeGirisYontemi = 'manuel' | 'un_hesabi' | 'siparis' | 'okul' | 'migrasyon'

export interface VeresiyeKaydi {
  id: string
  musteriId: string
  musteriAdi: string
  productId: string
  urunAdi: string
  adet: number
  birimFiyat: number
  tutar: number
  tarih: string
  durum: VeresiyeDurumu
  girisYontemi: VeresiyeGirisYontemi
  kaynakSiparisId: string | null
  esdegerAdet: number // durum='un_odemeli' ise adet×unKatsayisi, değilse 0 (bkz. UnHesabi)
  olusturanUid: string
}

// 'planlandi': tekrarlayan şablondan ileriye dönük toplu üretilmiş, henüz teslimat
// günü gelmemiş sipariş — veresiye bakiyesine YANSIMAZ (bkz. siparis/data.ts
// siparisAktifMi). Teslimat günü geldiğinde otomatik olarak 'yeni'ye döner ve o an
// veresiyeye işlenir (bkz. siparisPlanlananiAktifEt).
export type SiparisDurumu = 'planlandi' | 'yeni' | 'hazirlaniyor' | 'teslim_edildi' | 'iptal'
export type OdemeSekli = 'veresiye' | 'nakit'
export type OdemeDurumu = 'odenmedi' | 'odendi'

export interface SiparisKalemi {
  productId: string
  urunAdi: string
  adet: number
  birimFiyat: number
}

export interface Siparis {
  id: string
  musteriId: string
  musteriAdi: string
  musteriGecici: boolean // kayıt anındaki müşteri.gecici anlık görüntüsü — serbest metinle girilen siparişlerde rozet göstermek için
  kaynakSablonId: string | null // 'planlandi' siparişler için üretildiği tekrarlayan şablonun id'si
  adres: string
  telefon: string
  not: string
  teslimatTarihi: string
  items: SiparisKalemi[]
  toplamTutar: number
  durum: SiparisDurumu
  odemeSekli: OdemeSekli
  odemeDurumu: OdemeDurumu
  veresiyeKayitIdler: string[]
  silindi: boolean
  olusturanUid: string
  olusturanAd: string
}

export type SiparisFormVerisi = {
  musteriId: string
  musteriAdi: string
  adres: string
  telefon: string
  not: string
  teslimatTarihi: string
  items: SiparisKalemi[]
  odemeSekli: OdemeSekli
}

export interface SiparisSablonu {
  id: string
  musteriId: string
  musteriAdi: string
  adres: string
  not: string
  items: { productId: string; adet: number }[]
  gunler: number[]
  bitisTarihi: string | null
  aktif: boolean
  sonOlusturulan: string | null
  planlananSonTarih: string | null // "İleriye Dönük Oluştur" ile en son hangi tarihe kadar 'planlandi' sipariş üretildiği
}

export type SiparisSablonuFormVerisi = Omit<SiparisSablonu, 'id' | 'sonOlusturulan' | 'planlananSonTarih'>

export interface VeresiyeOdeme {
  id: string
  musteriId: string
  musteriAdi: string
  tutar: number
  tarih: string
  not: string
  olusturanUid: string
}

export type VeresiyeOdemeFormVerisi = Omit<VeresiyeOdeme, 'id' | 'olusturanUid'>

export interface VeresiyeSablonKalemi {
  productId: string
  urunAdi: string
  aktif: boolean // false = satır geçici olarak duraklatıldı (pasif), Günlük Giriş'te gösterilmez
  sira: number // Giriş Şablonu listesindeki ve Günlük Giriş'teki satır sırası (küçük önce) — eski sistemdeki "sıra" alanının karşılığı
}

export interface VeresiyeSablon {
  id: string
  musteriId: string
  musteriAdi: string
  kalemler: VeresiyeSablonKalemi[]
}

export type VeresiyeSablonFormVerisi = Omit<VeresiyeSablon, 'id'>

// Un ÖDEMESİ — müşterinin getirdiği çuval, birikenEsdegerAdet'i azaltır (bkz. UnHesabi).
export interface VeresiyeUnGirisi {
  id: string
  musteriId: string
  musteriAdi: string
  tarih: string
  cuvalSayisi: number
  esdegerAdet: number // cuvalSayisi × adetPerCuval (kayıt anındaki oranla donmuş)
  olusturanUid: string
}

// --- Okul modülü ---

export interface OkulHat {
  id: string
  productId: string
  urunAdi: string
  adet: number
  aktif: boolean
  // Bu hattın haftanın hangi günleri gideceği (Date.getDay() ile aynı:
  // 0=Pazar...6=Cumartesi) — okulun kendi acikGunler'ından BAĞIMSIZ, ek bir
  // kısıtlamadır (ör. her gün giden ekmeğe ek olarak yalnızca Pzt/Per simit).
  // Bu özellikten önce oluşturulmuş hatlarda yok — okuyan tarafta her zaman
  // `?? TUM_GUNLER` ile "her gün" varsayılır (bkz. orderData.ts).
  gunler?: number[]
}

export interface OkulSchool {
  id: string
  ad: string
  // Bağlıysa, bu okulun (ve varsa aynı musteriId'yi paylaşan diğer okulların)
  // günlük teslimat tutarı bu Veresiye müşterisine yansır (bkz. orderData.ts
  // gunuKapat). Birden fazla okul aynı faturalayan kuruma bağlıysa hepsine
  // aynı musteriId verilerek doğal olarak tek hesapta toplanır — ayrı bir
  // "Firma" katmanına gerek yok.
  musteriId: string | null
  lines: OkulHat[]
  // Haftanın hangi günleri açık (Date.getDay() ile aynı: 0=Pazar...6=Cumartesi).
  // Bu özellikten önce oluşturulmuş okullarda yok — okuyan tarafta her zaman
  // `?? TUM_GUNLER` ile "her gün açık" varsayılır (bkz. orderData.ts).
  acikGunler: number[]
  // true ise bu aslında bir okul değil, günlük sabit siparişi Okul modülünün
  // üretim/kapanış akışı üzerinden takip edilen normal bir müşteri (ör. Aşevi,
  // bir fabrika kantini) — listelerde "Okul Dışı" etiketiyle ayırt edilir.
  okulDegil: boolean
}

export type OkulSchoolFormVerisi = Omit<OkulSchool, 'id'>

export interface OkulOrder {
  id: string
  tarih: string
  schoolId: string
  lineId: string
  productId: string
  adet: number
  kapandiMi: boolean
}

export interface OkulTeslimat {
  id: string
  tarih: string
  schoolId: string
  lineId: string
  productId: string
  urunAdi: string
  adet: number
  birimFiyat: number
  tutar: number
  kapatanUid: string
  // Bu teslimatın yansıdığı veresiye_kayitlar belgesi — hedef (okul/firma) bir
  // Veresiye müşterisine bağlıysa dolu, değilse null. Günü Yeniden Aç'ta bu
  // kaydı silip bakiyeyi geri almak için kullanılır (bkz. gununKapanisiniGeriAl).
  veresiyeKayitId: string | null
}

export interface OkulKapanis {
  tarih: string
  kapandi: boolean
  kapatanUid: string
  satirSayisi: number
}

export interface OkulPayment {
  id: string
  hedefId: string
  tutar: number
  tarih: string
  not: string
  olusturanUid: string
}

export type OkulPaymentFormVerisi = Omit<OkulPayment, 'id' | 'olusturanUid'>
