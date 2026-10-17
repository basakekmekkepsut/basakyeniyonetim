import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

initializeApp()

const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')

export * from './scheduled'
export * from './ciftKayit'
export * from './aylikRapor'

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

  // Aylık özet ve "tüm zamanlar" ürün toplamı için tam geçmiş gerekiyor — bu
  // yüzden 50/60 kaydıyla sınırlanmıyor (müşteri başına makul bir üst sınır
  // olarak 2000 kayıt/ödeme yeterince geniş, kötüye kullanımı da engelliyor).
  const [kayitlarSnap, odemelerSnap] = await Promise.all([
    db.collection('veresiye_kayitlar').where('musteriId', '==', musteriId).orderBy('tarih', 'desc').limit(2000).get(),
    db.collection('veresiye_odemeler').where('musteriId', '==', musteriId).orderBy('tarih', 'desc').limit(2000).get()
  ])

  const kayitlar = kayitlarSnap.docs
    .map((d) => {
      const v = d.data()
      return { tarih: v.tarih as string, urunAdi: v.urunAdi as string, adet: v.adet as number, tutar: v.tutar as number, durum: v.durum as string }
    })
    .sort(tarihSirala)
  const odemeler = odemelerSnap.docs
    .map((d) => {
      const v = d.data()
      return { tarih: v.tarih as string, tutar: v.tutar as number, not: (v.not as string) || null }
    })
    .sort(tarihSirala)

  return {
    ad: musteri.ad as string,
    adSoyad: (musteri.adSoyad as string) || '',
    hitapSekli: musteri.hitapSekli ?? null,
    veresiyeBakiye: musteri.veresiyeBakiye as number,
    unHesabi: musteri.unHesabi ?? null,
    kayitlar,
    odemeler
  }
})

interface UretimOzetiData {
  tarih: string
}

interface UretimOzetiSiparisVerisi {
  silindi?: boolean
  durum?: string
  musteriAdi?: string
  items?: { adet: number; urunAdi: string }[]
}

interface UretimOzetiOkulSchoolVerisi {
  ad: string
  lines?: { id: string; urunAdi: string }[]
}

interface UretimOzetiOkulOrderVerisi {
  schoolId: string
  lineId: string
  adet: number
  not?: string
}

/**
 * Ustaların (üretim ekibi) giriş yapmadan bakabileceği bir üretim özeti —
 * Sipariş ve Okul modüllerindeki o günkü siparişleri hem ürün bazında
 * toplayıp hem de kime/hangi okula ait olduğunu göstererek döner.
 */
export const uretimOzetiGetir = onCall<UretimOzetiData>({ region: 'europe-west1' }, async (request) => {
  const { tarih } = request.data ?? {}
  if (!tarih || typeof tarih !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
    throw new HttpsError('invalid-argument', 'Geçerli bir tarih (YYYY-MM-DD) gerekli.')
  }

  const db = getFirestore()
  const toplamlar = new Map<string, number>()
  const ekle = (urunAdi: string, adet: number) => toplamlar.set(urunAdi, (toplamlar.get(urunAdi) ?? 0) + adet)

  const siparisSnap = await db
    .collection('siparis_orders')
    .where('teslimatTarihi', '==', tarih)
    .where('silindi', '==', false)
    .get()
  const siparisler: { musteriAdi: string; satirlar: { urunAdi: string; adet: number }[] }[] = []
  for (const d of siparisSnap.docs) {
    const veri = d.data() as UretimOzetiSiparisVerisi
    if (veri.durum === 'iptal') continue
    const satirlar = (veri.items ?? []).map((it) => ({ urunAdi: it.urunAdi, adet: it.adet }))
    if (satirlar.length === 0) continue
    for (const it of satirlar) ekle(it.urunAdi, it.adet)
    siparisler.push({ musteriAdi: veri.musteriAdi || '—', satirlar })
  }
  siparisler.sort((a, b) => a.musteriAdi.localeCompare(b.musteriAdi, 'tr-TR'))

  const [okullarSnap, okulOrdersSnap] = await Promise.all([
    db.collection('okul_schools').get(),
    db.collection('okul_orders').where('tarih', '==', tarih).get()
  ])
  const okulHatlari = new Map<string, Map<string, string>>()
  const okulAdlari = new Map<string, string>()
  okullarSnap.docs.forEach((d) => {
    const veri = d.data() as UretimOzetiOkulSchoolVerisi
    okulAdlari.set(d.id, veri.ad)
    const hatMap = new Map<string, string>()
    for (const l of veri.lines ?? []) hatMap.set(l.id, l.urunAdi)
    okulHatlari.set(d.id, hatMap)
  })

  // Not (ör. "dilimli") belirli bir hatta ait olduğu için, aynı okulda aynı
  // ürün adını taşıyan satırlar birleştirilmez — her okul_orders kaydı kendi
  // notuyla ayrı bir satır olarak kalır.
  const okulSatirlari = new Map<string, { urunAdi: string; adet: number; not?: string }[]>()
  for (const d of okulOrdersSnap.docs) {
    const veri = d.data() as UretimOzetiOkulOrderVerisi
    if (veri.adet <= 0) continue
    const urunAdi = okulHatlari.get(veri.schoolId)?.get(veri.lineId)
    if (!urunAdi) continue // silinmiş okul/hat — üretime girmez
    ekle(urunAdi, veri.adet)
    const satirlar = okulSatirlari.get(veri.schoolId) ?? []
    satirlar.push({ urunAdi, adet: veri.adet, not: veri.not || undefined })
    okulSatirlari.set(veri.schoolId, satirlar)
  }

  const urunler = [...toplamlar.entries()]
    .map(([urunAdi, adet]) => ({ urunAdi, adet }))
    .sort((a, b) => b.adet - a.adet)

  const okullar = [...okulSatirlari.entries()]
    .map(([schoolId, satirlar]) => {
      const sirali = [...satirlar].sort((a, b) => b.adet - a.adet)
      const toplam = sirali.reduce((s, x) => s + x.adet, 0)
      return { okulAdi: okulAdlari.get(schoolId) ?? '—', satirlar: sirali, toplam }
    })
    .sort((a, b) => b.toplam - a.toplam)

  return { urunler, siparisler, okullar }
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
