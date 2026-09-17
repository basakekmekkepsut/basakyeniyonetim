import type { Musteri } from '../lib/types'

/** WhatsApp mesajlarında kullanılacak hitap: "Ahmet Bey", "Ayşe Hanım" gibi. */
export function musteriHitabi(musteri: Pick<Musteri, 'ad' | 'adSoyad' | 'hitapSekli'>): string {
  const isim = musteri.adSoyad.trim() || musteri.ad
  if (musteri.hitapSekli === 'bay') return `${isim} Bey`
  if (musteri.hitapSekli === 'hanim') return `${isim} Hanım`
  return isim
}

/** 6 haneli, sadece rakamlardan oluşan bir portal parolası üretir (örn. "042817"). */
export function altiHaneliParolaUret(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// window.location.origin KASITLI OLARAK kullanılmıyor — telefona ana ekran
// kısayolu (PWA) olarak eklenmiş oturumlar, domain değiştirilse bile kurulum
// anındaki eski adrese sabit kalabiliyor. Portal linki bu yüzden her zaman
// güncel marka alan adına sabitlenir (bkz. MusteriFormModal.tsx geçmişi).
export const PORTAL_SITE_URL = 'https://basakekmekfirini.com'

/** Müşteri portalı giriş linki + şifresini içeren, doğrudan WhatsApp'tan
 * paylaşılabilecek hazır mesaj. Müşterinin portal şifresi yoksa (ör. Veresiye
 * modülünde değilse) null döner — çağıran taraf bunu ele almalı. */
export function portalMesajOlustur(musteri: Pick<Musteri, 'id' | 'ad' | 'adSoyad' | 'hitapSekli' | 'portalSifre'>): string | null {
  if (!musteri.portalSifre) return null
  const link = `${PORTAL_SITE_URL}/portal.html?kod=${musteri.id}`
  return `Merhaba ${musteriHitabi(musteri)}, hesap ekstrenizi görüntülemek için:\n${link}\nŞifreniz: ${musteri.portalSifre}\n\nBu bir otomatik program mesajıdır.`
}
