import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

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

    // Sırrı interaktif komut satırından girerken sona kaçabilen boşluk/satır
    // sonu karakterleri URL'yi bozup Telegram'dan "Not Found" döndürebiliyor.
    const token = telegramBotToken.value().trim()
    const url = `https://api.telegram.org/bot${token}/sendMessage`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message })
    })

    const sonuc = (await response.json()) as { ok: boolean; description?: string }

    if (!response.ok || !sonuc.ok) {
      // GEÇİCİ TEŞHİS BİLGİSİ — token'ın TAMAMI değil, yalnızca uzunluğu ve uç
      // karakterleri (kullanıcının kendi token'ıyla karşılaştırması için).
      const tani = `chatId=${chatId}, tokenUzunluk=${token.length}, tokenBaşı=${token.slice(0, 12)}, tokenSonu=${token.slice(-4)}, status=${response.status}`
      throw new HttpsError('internal', `Telegram gönderimi başarısız: ${sonuc.description ?? response.statusText} [${tani}]`)
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

// --- Push bildirimleri (FCM) ---

interface PushTokenKaydetData {
  token: string
}

/**
 * Personel/admin için FCM cihaz tokenını kaydeder. Kişinin kendi `users/{uid}`
 * dokümanını client'tan doğrudan yazamaması (firestore.rules — yalnızca admin
 * yazabilir, ayrıcalık yükseltmeyi önlemek için) NEDENİYLE bu callable üzerinden,
 * admin SDK ile (rules bypass) yazılır — yalnızca KENDİ token'ını ekleyebilir.
 */
export const pushTokenKaydet = onCall<PushTokenKaydetData>({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmış olmanız gerekiyor.')
  }
  const { token } = request.data ?? {}
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'Geçerli bir bildirim token\'ı gerekiyor.')
  }
  await getFirestore()
    .doc(`users/${request.auth.uid}`)
    .update({ fcmTokens: FieldValue.arrayUnion(token) })
  return { basarili: true }
})

interface PortalPushTokenKaydetData {
  musteriId: string
  sifre: string
  token: string
}

/**
 * Müşteri portalı için FCM cihaz tokenını kaydeder — portalGiris ile aynı
 * kod+şifre doğrulamasını kullanır (müşteri Firebase Auth kullanmaz).
 */
export const portalPushTokenKaydet = onCall<PortalPushTokenKaydetData>({ region: 'europe-west1' }, async (request) => {
  const { musteriId, sifre, token } = request.data ?? {}
  if (!musteriId || typeof musteriId !== 'string' || !sifre || typeof sifre !== 'string') {
    throw new HttpsError('invalid-argument', 'Kod ve şifre gerekli.')
  }
  if (!token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'Geçerli bir bildirim token\'ı gerekiyor.')
  }

  const db = getFirestore()
  const musteriRef = db.doc(`musteriler/${musteriId}`)
  const musteriSnap = await musteriRef.get()
  const musteri = musteriSnap.data()

  if (!musteriSnap.exists || !musteri?.portalSifre || musteri.portalSifre !== sifre) {
    throw new HttpsError('permission-denied', 'Kod veya şifre hatalı.')
  }

  await musteriRef.update({ fcmTokens: FieldValue.arrayUnion(token) })
  return { basarili: true }
})

interface PushTestGonderData {
  hedefTipi: 'personel' | 'musteri'
  id: string
}

/**
 * Admin panelinden tetiklenen test bildirimi — belirtilen personel (users/{id})
 * veya müşterinin (musteriler/{id}) kayıtlı TÜM cihazlarına gönderir. Artık
 * geçersiz (kaldırılmış/süresi dolmuş) token'lar otomatik temizlenir.
 */
export const pushTestGonder = onCall<PushTestGonderData>({ region: 'europe-west1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmış olmanız gerekiyor.')
  }
  const db = getFirestore()
  const cagiranSnap = await db.doc(`users/${request.auth.uid}`).get()
  if (cagiranSnap.data()?.rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Bu işlem yalnızca yöneticiler içindir.')
  }

  const { hedefTipi, id } = request.data ?? {}
  if ((hedefTipi !== 'personel' && hedefTipi !== 'musteri') || !id || typeof id !== 'string') {
    throw new HttpsError('invalid-argument', 'Geçerli bir hedef gerekiyor.')
  }

  const hedefRef = db.doc(hedefTipi === 'personel' ? `users/${id}` : `musteriler/${id}`)
  const hedefSnap = await hedefRef.get()
  const tokenlar: string[] = hedefSnap.data()?.fcmTokens ?? []
  if (tokenlar.length === 0) {
    throw new HttpsError('failed-precondition', 'Bu kişi için kayıtlı bildirim izni yok — önce uygulamadan "Bildirimleri Aç" ile izin vermesi gerekiyor.')
  }

  const sonuc = await getMessaging().sendEachForMulticast({
    tokens: tokenlar,
    notification: { title: 'Başak Ekmek', body: 'Bu bir test bildirimidir — bildirimleriniz çalışıyor.' }
  })

  const geciriliTokenlar = tokenlar.filter((_, i) => sonuc.responses[i].success)
  if (geciriliTokenlar.length !== tokenlar.length) {
    await hedefRef.update({ fcmTokens: geciriliTokenlar })
  }

  return { basarili: sonuc.successCount, basarisiz: sonuc.failureCount }
})
