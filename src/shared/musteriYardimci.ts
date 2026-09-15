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
