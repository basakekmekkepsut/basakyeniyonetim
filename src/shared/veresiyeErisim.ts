import { isAdmin, useSession } from '../lib/session'
import type { Musteri } from '../lib/types'

/**
 * Veresiye ekranlarında (Günlük Giriş, Özet, müşteri seçiciler vb.) hangi
 * müşterilerin gösterileceğini belirler. Admin ve "Tüm müşterileri görebilir"
 * işaretli personel her müşteriyi görür; kişi bazlı atanmış personel yalnızca
 * kendisine atanan müşterileri görür (bkz. Ayarlar > Kullanıcılar).
 * Firestore güvenlik kuralları da aynı mantıkla veri erişimini kısıtlar
 * (bkz. firestore.rules musteriler/{id} okuma kuralı).
 */
export function useVeresiyeMusteriFiltresi(): (musteri: Pick<Musteri, 'id'>) => boolean {
  const session = useSession()
  return (musteri) => {
    if (session.status !== 'signed-in') return false
    if (isAdmin(session.profile)) return true
    const izinli = session.profile.permissions.veresiye.gorebilecegiMusteriler
    return izinli === 'all' || izinli.includes(musteri.id)
  }
}
