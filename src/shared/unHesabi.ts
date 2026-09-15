import type { Musteri, Urun, VeresiyeDurumu } from '../lib/types'

export function unHesabiAktifMi(musteri: Pick<Musteri, 'unHesabi'> | undefined | null): boolean {
  return musteri?.unHesabi?.aktif === true
}

/**
 * Un Hesabı aktif bir müşteri için bir teslimatın gerçek durumunu ve eşdeğer
 * adedini hesaplar — ekmek ücretsizdir, ₺ bakiyeye hiç girmez (durum='un_odemeli'),
 * yalnızca birikenEsdegerAdet'e eklenir. Un Hesabı aktif DEĞİLSE, çağıranın
 * önerdiği durum aynen kullanılır ve esdegerAdet 0'dır.
 */
export function kayitDurumuHesapla(
  musteri: Pick<Musteri, 'unHesabi'> | undefined | null,
  urun: Pick<Urun, 'unKatsayisi'> | undefined,
  adet: number,
  onerilenDurum: VeresiyeDurumu
): { durum: VeresiyeDurumu; esdegerAdet: number } {
  if (unHesabiAktifMi(musteri)) {
    const katsayi = urun?.unKatsayisi ?? 1
    return { durum: 'un_odemeli', esdegerAdet: adet * katsayi }
  }
  return { durum: onerilenDurum, esdegerAdet: 0 }
}

export function esdegerAdetToplamHesapla(
  kalemler: { productId: string; adet: number }[],
  urunler: Pick<Urun, 'id' | 'unKatsayisi'>[]
): number {
  return kalemler.reduce((toplam, k) => {
    const urun = urunler.find((u) => u.id === k.productId)
    return toplam + k.adet * (urun?.unKatsayisi ?? 1)
  }, 0)
}

export function cuvalGoster(birikenEsdegerAdet: number, adetPerCuval: number | null): string {
  if (!adetPerCuval || adetPerCuval <= 0) return `${birikenEsdegerAdet} adet eşdeğer`
  const cuval = birikenEsdegerAdet / adetPerCuval
  return `≈ ${cuval.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} çuval (${birikenEsdegerAdet} adet eşdeğer)`
}
