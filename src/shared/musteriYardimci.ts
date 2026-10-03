import type { Musteri } from '../lib/types'
import { formatTutar } from './TutarGoster'
import { cuvalGoster, unHesabiAktifMi } from './unHesabi'

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

/** Yalnızca müşterinin güncel bakiyesini bildiren kısa WhatsApp mesajı — portal
 * linki ya da hareket dökümü içermez. Un hesabıyla çalışan müşterilerde çuval
 * bakiyesi, varsa ₺ bakiyesiyle birlikte gösterilir. */
export function bakiyeMesajOlustur(
  musteri: Pick<Musteri, 'ad' | 'adSoyad' | 'hitapSekli' | 'veresiyeBakiye' | 'unHesabi'>
): string {
  const tarih = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const tlSatiri = (bakiye: number) =>
    bakiye > 0.004
      ? `Güncel borç bakiyeniz: ${formatTutar(bakiye)}`
      : bakiye < -0.004
        ? `Alacak bakiyeniz: ${formatTutar(-bakiye)}`
        : 'Borcunuz bulunmamaktadır.'

  const satirlar: string[] = []
  if (unHesabiAktifMi(musteri)) {
    const un = musteri.unHesabi!
    satirlar.push(`Un hesabı bakiyeniz: ${cuvalGoster(un.birikenEsdegerAdet, un.adetPerCuval)}`)
    if (Math.abs(musteri.veresiyeBakiye) > 0.004) satirlar.push(tlSatiri(musteri.veresiyeBakiye))
  } else {
    satirlar.push(tlSatiri(musteri.veresiyeBakiye))
  }

  return [`Merhaba ${musteriHitabi(musteri)},`, '', `${tarih} itibarıyla:`, ...satirlar, '', 'Başak Ekmek Fırını', 'Bu bir otomatik program mesajıdır.'].join('\n')
}
