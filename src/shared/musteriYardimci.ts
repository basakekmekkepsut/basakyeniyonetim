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

/** Günlük Veresiye müşterisinin portal linki — aynı portal sayfası, `tur=gunluk` ile gunluk_* koleksiyonlarından okur. */
export function gunlukPortalLinki(musteriId: string): string {
  return `${PORTAL_SITE_URL}/portal.html?kod=${musteriId}&tur=gunluk`
}

export function gunlukPortalMesajOlustur(musteri: { id: string; ad: string; portalSifre: string | null }): string | null {
  if (!musteri.portalSifre) return null
  return `Merhaba ${musteri.ad}, kasadan aldığınız ürünleri ve hesabınızı görüntülemek için:\n${gunlukPortalLinki(musteri.id)}\nŞifreniz: ${musteri.portalSifre}\n\nBu bir otomatik program mesajıdır.`
}

export interface DonemOzeti {
  baslangic: string | null // YYYY-MM-DD, null = en baştan
  bitis: string // YYYY-MM-DD
  devreden: number
  alis: number
  odeme: number
  donemSonu: number
}

function tarihTr(tarih: string): string {
  const [y, m, d] = tarih.split('-')
  return `${d}.${m}.${y}`
}

/** Müşteriye WhatsApp'tan gönderilecek bakiye mesajı — portal linki ya da
 * kalem kalem döküm içermez. Dönem verilmezse yalnızca güncel bakiye; verilirse
 * devreden / alışveriş / ödeme / dönem sonu bakiyesi özetlenir. Un hesabıyla
 * çalışan müşterilerde güncel çuval bakiyesi de eklenir. */
export function bakiyeMesajOlustur(
  musteri: Pick<Musteri, 'ad' | 'adSoyad' | 'hitapSekli' | 'veresiyeBakiye' | 'unHesabi'>,
  donem?: DonemOzeti
): string {
  const bugun = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const bakiyeYazi = (bakiye: number) =>
    bakiye > 0.004 ? `${formatTutar(bakiye)} borç` : bakiye < -0.004 ? `${formatTutar(-bakiye)} alacak` : 'borç yok'

  const satirlar: string[] = []
  if (donem) {
    const aralik = donem.baslangic
      ? donem.baslangic === donem.bitis
        ? tarihTr(donem.bitis)
        : `${tarihTr(donem.baslangic)} – ${tarihTr(donem.bitis)}`
      : `${tarihTr(donem.bitis)} tarihine kadar`
    satirlar.push(`Hesap özetiniz (${aralik}):`)
    if (donem.baslangic) satirlar.push(`Devreden bakiye: ${bakiyeYazi(donem.devreden)}`)
    satirlar.push(`Alışveriş: ${formatTutar(donem.alis)}`)
    satirlar.push(`Ödeme: ${formatTutar(donem.odeme)}`)
    satirlar.push(`Dönem sonu bakiye: ${bakiyeYazi(donem.donemSonu)}`)
    if (Math.abs(donem.donemSonu - musteri.veresiyeBakiye) > 0.004) {
      satirlar.push('', `Güncel bakiye (${bugun}): ${bakiyeYazi(musteri.veresiyeBakiye)}`)
    }
  } else {
    satirlar.push(`${bugun} itibarıyla güncel bakiyeniz: ${bakiyeYazi(musteri.veresiyeBakiye)}`)
  }

  if (unHesabiAktifMi(musteri)) {
    const un = musteri.unHesabi!
    satirlar.push(`Un hesabı bakiyeniz: ${cuvalGoster(un.birikenEsdegerAdet, un.adetPerCuval)}`)
  }

  return [`Merhaba ${musteriHitabi(musteri)},`, '', ...satirlar, '', 'Başak Ekmek Fırını', 'Bu bir otomatik program mesajıdır.'].join('\n')
}
