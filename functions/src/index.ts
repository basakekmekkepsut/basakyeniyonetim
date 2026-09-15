import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp()

const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')

interface TelegramNotifyData {
  chatId: string
  message: string
}

/**
 * Sipariş/Okul modüllerinin "Telegram'a Gönder" butonlarından çağrılır.
 * Bot token istemciye asla gönderilmez — yalnızca bu fonksiyonun sunucu
 * ortamında (Secret Manager) tutulur (FIRESTORE_SCHEMA.md §4).
 */
export const telegramNotify = onCall<TelegramNotifyData>(
  { secrets: [telegramBotToken], region: 'europe-west1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmış olmanız gerekiyor.')
    }

    const { chatId, message } = request.data ?? {}
    if (!chatId || typeof chatId !== 'string') {
      throw new HttpsError('invalid-argument', 'Geçerli bir Telegram chat ID gerekiyor.')
    }
    if (!message || typeof message !== 'string') {
      throw new HttpsError('invalid-argument', 'Gönderilecek mesaj boş olamaz.')
    }

    const token = telegramBotToken.value()
    const url = `https://api.telegram.org/bot${token}/sendMessage`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message })
    })

    const sonuc = (await response.json()) as { ok: boolean; description?: string }

    if (!response.ok || !sonuc.ok) {
      throw new HttpsError('internal', `Telegram gönderimi başarısız: ${sonuc.description ?? response.statusText}`)
    }

    return { basarili: true }
  }
)

interface PortalGirisData {
  musteriId: string
  sifre: string
}

/**
 * Müşteri Portalı girişi — Firebase Auth GEREKTİRMEZ (müşteriler sistem
 * kullanıcısı değildir). Admin SDK ile doğrudan Firestore'dan okur, rules'u
 * bypass eder; bu yüzden yalnızca DAR ve CURATED bir veri döndürür — müşterinin
 * kendi bakiyesi ve son hareketleri dışında hiçbir şey sızdırılmaz.
 */
export const portalGiris = onCall<PortalGirisData>({ region: 'europe-west1' }, async (request) => {
  const { musteriId, sifre } = request.data ?? {}
  if (!musteriId || typeof musteriId !== 'string' || !sifre || typeof sifre !== 'string') {
    throw new HttpsError('invalid-argument', 'Kod ve şifre gerekli.')
  }

  const db = getFirestore()
  const musteriSnap = await db.doc(`musteriler/${musteriId}`).get()
  const musteri = musteriSnap.data()

  // Kod ile şifre uyuşmazlığı ile "böyle bir müşteri yok" durumunu ayırt
  // ettirmemek için aynı genel hata mesajı kullanılıyor (numara denemesini zorlaştırır).
  if (!musteriSnap.exists || !musteri?.portalSifre || musteri.portalSifre !== sifre) {
    throw new HttpsError('permission-denied', 'Kod veya şifre hatalı.')
  }

  const tarihSirala = (a: { tarih: string }, b: { tarih: string }) => b.tarih.localeCompare(a.tarih)

  const [kayitlarSnap, odemelerSnap] = await Promise.all([
    db.collection('veresiye_kayitlar').where('musteriId', '==', musteriId).orderBy('tarih', 'desc').limit(50).get(),
    db.collection('veresiye_odemeler').where('musteriId', '==', musteriId).orderBy('tarih', 'desc').limit(50).get()
  ])

  const teslimatlar = kayitlarSnap.docs.map((d) => {
    const v = d.data()
    return { tarih: v.tarih as string, tur: 'teslimat' as const, aciklama: `${v.adet}× ${v.urunAdi}`, tutar: v.tutar as number, durum: v.durum as string }
  })
  const odemeler = odemelerSnap.docs.map((d) => {
    const v = d.data()
    return { tarih: v.tarih as string, tur: 'odeme' as const, aciklama: v.not || 'Ödeme', tutar: v.tutar as number, durum: 'odendi' }
  })

  const hareketler = [...teslimatlar, ...odemeler].sort(tarihSirala).slice(0, 60)

  return {
    ad: musteri.ad as string,
    adSoyad: (musteri.adSoyad as string) || '',
    hitapSekli: musteri.hitapSekli ?? null,
    veresiyeBakiye: musteri.veresiyeBakiye as number,
    unHesabi: musteri.unHesabi ?? null,
    hareketler
  }
})
