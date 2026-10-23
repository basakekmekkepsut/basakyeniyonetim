import type { Urun } from '../lib/types'

/** Ürünün Günlük Veresiye (kasa) fiyatı — ayrı fiyat girilmemişse normal liste fiyatı. */
export function gunlukFiyati(urun: Pick<Urun, 'fiyat' | 'gunlukFiyat'>): number {
  return urun.gunlukFiyat ?? urun.fiyat
}
