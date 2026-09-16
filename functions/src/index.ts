import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

initializeApp()

const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')

export * from './scheduled'

async function cagiranAdminMi(uid: string): Promise<boolean> {
  const snap = await getFirestore().doc(`users/${uid}`).get()
  return snap.data()?.rol === 'admin'
}

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

// --- Manuel yedekleme / geri yükleme (Ayarlar) ---

/**
 * Ayarlar > Yedekleme sayfasından tetiklenen manuel tam veritabanı yedeği.
 * jsonYedekGonder (otomatik günlük Telegram yedeği) ile aynı mantığı kullanır,
 * ancak dosyayı Telegram'a değil doğrudan admin'in tarayıcısına döner.
 */
export const manuelYedekOlustur = onCall({ region: 'europe-west1', memory: '512MiB', timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmış olmanız gerekiyor.')
  }
  if (!(await cagiranAdminMi(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Bu işlem yalnızca yöneticiler içindir.')
  }

  const db = getFirestore()
  const koleksiyonlar = await db.listCollections()
  const yedek: Record<string, Record<string, FirebaseFirestore.DocumentData>> = {}
  for (const koleksiyon of koleksiyonlar) {
    const snap = await koleksiyon.get()
    const dokumanlar: Record<string, FirebaseFirestore.DocumentData> = {}
    for (const d of snap.docs) dokumanlar[d.id] = d.data()
    yedek[koleksiyon.id] = dokumanlar
  }

  return { yedek, olusturmaTarihi: new Date().toISOString() }
})

interface ManuelYedekYukleData {
  yedek: Record<string, Record<string, unknown>>
}

/** JSON'da Timestamp alanları admin SDK'nın kendi { _seconds, _nanoseconds }
 * biçiminde dışa aktarılır (bkz. manuelYedekOlustur) — geri yüklerken bu şekle
 * uyan nesneler gerçek bir Firestore Timestamp'e çevrilir, aksi halde o alanlar
 * sıralama/orderBy gibi Timestamp bekleyen kullanımlarda bozulur. */
function timestampGeriYukle(deger: unknown): unknown {
  if (deger === null || typeof deger !== 'object') return deger
  if (Array.isArray(deger)) return deger.map(timestampGeriYukle)
  const obj = deger as Record<string, unknown>
  const anahtarlar = Object.keys(obj)
  if (anahtarlar.length === 2 && typeof obj._seconds === 'number' && typeof obj._nanoseconds === 'number') {
    return Timestamp.fromMillis(obj._seconds * 1000 + obj._nanoseconds / 1e6)
  }
  const sonuc: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) sonuc[k] = timestampGeriYukle(v)
  return sonuc
}

/**
 * Ayarlar > Yedekleme sayfasından bir JSON yedek dosyası yüklenerek tetiklenir.
 * Yedekteki her koleksiyon/belge kendi kimliğiyle ÜZERİNE YAZILIR (set) —
 * yedekte olmayan, sonradan eklenmiş belgeler SİLİNMEZ (tam senkron değil,
 * yalnızca eksik/bozulan veriyi geri yükleme amaçlıdır).
 */
export const manuelYedekYukle = onCall<ManuelYedekYukleData>(
  { region: 'europe-west1', memory: '512MiB', timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Bu işlem için giriş yapmış olmanız gerekiyor.')
    }
    if (!(await cagiranAdminMi(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'Bu işlem yalnızca yöneticiler içindir.')
    }

    const { yedek } = request.data ?? {}
    if (!yedek || typeof yedek !== 'object') {
      throw new HttpsError('invalid-argument', 'Geçerli bir yedek verisi gerekiyor.')
    }

    const db = getFirestore()
    let yazilanBelge = 0
    for (const [koleksiyonId, dokumanlar] of Object.entries(yedek)) {
      if (!dokumanlar || typeof dokumanlar !== 'object') continue
      const girdiler = Object.entries(dokumanlar as Record<string, FirebaseFirestore.DocumentData>)
      for (let i = 0; i < girdiler.length; i += 400) {
        const parca = girdiler.slice(i, i + 400)
        const batch = db.batch()
        for (const [docId, veri] of parca) {
          batch.set(db.collection(koleksiyonId).doc(docId), timestampGeriYukle(veri) as FirebaseFirestore.DocumentData)
        }
        await batch.commit()
        yazilanBelge += parca.length
      }
    }

    return { basarili: true, yazilanBelge }
  }
)
