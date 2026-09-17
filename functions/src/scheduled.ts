import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')
const TIME_ZONE = 'Europe/Istanbul'
const REGION = 'europe-west1'

// --- Tarih yardımcıları (Istanbul takvim gününe göre — sunucunun UTC saati
// bu üç zamanlama için gün taşımasına yol açmıyor, ama yine de doğru olan
// Istanbul'un takvim gününü baz almak) ---

function istanbulTarihStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

function gunEkle(tarihStr: string, gun: number): string {
  const [y, m, dd] = tarihStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, dd))
  dt.setUTCDate(dt.getUTCDate() + gun)
  return dt.toISOString().slice(0, 10)
}

const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

function tarihBaslikGoster(tarihStr: string): string {
  const [y, m, d] = tarihStr.split('-').map(Number)
  const tarih = new Date(Date.UTC(y, m - 1, d))
  return `${d} ${AY_ADLARI[m - 1]} ${GUN_ADLARI[tarih.getUTCDay()]}`
}

// --- Telegram yardımcıları ---

async function telegramMesajGonder(token: string, chatId: string, mesaj: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: mesaj })
  })
  const sonuc = (await response.json()) as { ok: boolean; description?: string }
  if (!response.ok || !sonuc.ok) {
    throw new Error(`Telegram mesaj gönderimi başarısız: ${sonuc.description ?? response.statusText}`)
  }
}

async function telegramDosyaGonder(token: string, chatId: string, icerik: string, dosyaAdi: string, aciklama: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendDocument`
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('caption', aciklama)
  form.append('document', new Blob([icerik], { type: 'application/json' }), dosyaAdi)
  const response = await fetch(url, { method: 'POST', body: form })
  const sonuc = (await response.json()) as { ok: boolean; description?: string }
  if (!response.ok || !sonuc.ok) {
    throw new Error(`Telegram dosya gönderimi başarısız: ${sonuc.description ?? response.statusText}`)
  }
}

async function telegramChatIdGetir(modul: 'siparis' | 'veresiye' | 'okul'): Promise<string | null> {
  const snap = await getFirestore().doc('settings/telegram').get()
  const chatId = snap.data()?.chatIds?.[modul]
  return typeof chatId === 'string' && chatId ? chatId : null
}

// --- Push bildirimleri (kullanıcı tercihine göre — bkz. KullaniciProfili.bildirimler) ---

export async function pushGonderKullanicilara(
  bildirimTuru: 'yeniSiparis' | 'gunlukHatirlatma' | 'yeniVeresiyeKaydi' | 'okulHatirlatma',
  baslik: string,
  govde: string
): Promise<void> {
  const db = getFirestore()
  const usersSnap = await db.collection('users').where(`bildirimler.${bildirimTuru}`, '==', true).get()
  const tokenKaynaklari: { uid: string; token: string }[] = []
  for (const d of usersSnap.docs) {
    const tokenlar: string[] = d.data().fcmTokens ?? []
    for (const t of tokenlar) tokenKaynaklari.push({ uid: d.id, token: t })
  }
  if (tokenKaynaklari.length === 0) return

  const sonuc = await getMessaging().sendEachForMulticast({
    tokens: tokenKaynaklari.map((t) => t.token),
    notification: { title: baslik, body: govde }
  })

  // Artık geçersiz (kaldırılmış/süresi dolmuş) token'ları sahibi kullanıcıdan temizle.
  const gecersizByUid = new Map<string, string[]>()
  sonuc.responses.forEach((r, i) => {
    if (!r.success) {
      const { uid, token } = tokenKaynaklari[i]
      gecersizByUid.set(uid, [...(gecersizByUid.get(uid) ?? []), token])
    }
  })
  await Promise.all(
    [...gecersizByUid.entries()].map(async ([uid, gecersizTokenlar]) => {
      const kullaniciDoc = usersSnap.docs.find((d) => d.id === uid)
      const mevcutTokenlar: string[] = kullaniciDoc?.data().fcmTokens ?? []
      const yeniTokenlar = mevcutTokenlar.filter((t) => !gecersizTokenlar.includes(t))
      await db.doc(`users/${uid}`).update({ fcmTokens: yeniTokenlar })
    })
  )
}

// --- Okul sipariş mesajı (bkz. src/modules/okul/MesajPage.tsx okulMesajOlustur ile aynı format) ---

interface OkulHatOzet {
  id: string
  productId: string
  urunAdi: string
}
interface OkulSchoolOzet {
  id: string
  ad: string
  lines: OkulHatOzet[]
}
interface OkulOrderOzet {
  schoolId: string
  lineId: string
  adet: number
}

async function okulMesajiOlustur(tarih: string): Promise<string> {
  const db = getFirestore()
  const [okullarSnap, ordersSnap] = await Promise.all([
    db.collection('okul_schools').get(),
    db.collection('okul_orders').where('tarih', '==', tarih).get()
  ])
  const okullar = okullarSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as OkulSchoolOzet)
  const orders = ordersSnap.docs.map((d) => d.data() as OkulOrderOzet)

  const satirlar: string[] = []
  const urunToplamlari = new Map<string, number>()

  for (const okul of okullar) {
    for (const o of orders.filter((x) => x.schoolId === okul.id)) {
      if (o.adet <= 0) continue
      const hat = okul.lines.find((l) => l.id === o.lineId)
      const urunAdi = hat?.urunAdi ?? '—'
      satirlar.push(`${okul.ad}: ${o.adet} adet (${urunAdi})`)
      urunToplamlari.set(urunAdi, (urunToplamlari.get(urunAdi) ?? 0) + o.adet)
    }
  }

  if (satirlar.length === 0) return ''

  const toplamSatirlari = [...urunToplamlari.entries()].map(([urun, adet]) => `${urun}: ${adet} adet`)
  return [`Ekmek Siparişi — ${tarihBaslikGoster(tarih)}`, '', ...satirlar, '', 'Ürün bazında toplam:', ...toplamSatirlari].join('\n')
}

// --- Sipariş (müşteri) mesajı (bkz. src/modules/siparis/MesajPage.tsx siparisMesajOlustur ile aynı format) ---

interface SiparisItemOzet {
  adet: number
  urunAdi: string
}
interface SiparisOzet {
  musteriAdi: string
  items: SiparisItemOzet[]
  durum: string
}

async function siparisMesajiOlustur(tarih: string): Promise<string> {
  const db = getFirestore()
  const snap = await db.collection('siparis_orders').where('teslimatTarihi', '==', tarih).where('silindi', '==', false).get()
  const siparisler = snap.docs.map((d) => d.data() as SiparisOzet).filter((s) => s.durum !== 'iptal')
  if (siparisler.length === 0) return ''

  const urunToplamlari = new Map<string, number>()
  const satirlar = siparisler.map((s) => {
    const urunler = s.items.map((it) => `${it.adet}x ${it.urunAdi}`).join(', ')
    for (const it of s.items) urunToplamlari.set(it.urunAdi, (urunToplamlari.get(it.urunAdi) ?? 0) + it.adet)
    return `• ${s.musteriAdi} — ${urunler}`
  })
  const toplamSatirlari = [...urunToplamlari.entries()].map(([urun, adet]) => `${urun}: ${adet} adet`)
  return [`📋 ${tarih} Sipariş Listesi`, '', ...satirlar, '', 'Ürün bazında toplam:', ...toplamSatirlari].join('\n')
}

// --- Zamanlanmış görevler ---

/** Her akşam 21:00 (İstanbul) — yarının okul sipariş listesini Telegram'a gönderir. */
export const okulSiparisiAksamGonder = onSchedule(
  { schedule: '0 21 * * *', timeZone: TIME_ZONE, region: REGION, secrets: [telegramBotToken] },
  async () => {
    const chatId = await telegramChatIdGetir('okul')
    if (!chatId) {
      console.log('[okulSiparisiAksamGonder] Okul için Telegram chat ID tanımlı değil, atlanıyor.')
      return
    }
    const yarin = gunEkle(istanbulTarihStr(new Date()), 1)
    const mesaj = await okulMesajiOlustur(yarin)
    if (!mesaj) {
      console.log(`[okulSiparisiAksamGonder] ${yarin} için sipariş yok, mesaj gönderilmedi.`)
      return
    }
    await telegramMesajGonder(telegramBotToken.value().trim(), chatId, mesaj)
  }
)

/** Her akşam 17:00 (İstanbul) — "okul hatırlatma" tercihi açık kullanıcılara, bugünün
 * okul siparişlerini gözden geçirip günü kapatmayı hatırlatan bir push gönderir.
 * Bugün için hiç bekleyen (henüz kapanmamış) satır yoksa gönderilmez. */
export const okulHatirlatmaGonder = onSchedule({ schedule: '0 17 * * *', timeZone: TIME_ZONE, region: REGION }, async () => {
  const bugun = istanbulTarihStr(new Date())
  const db = getFirestore()
  const snap = await db.collection('okul_orders').where('tarih', '==', bugun).where('kapandiMi', '==', false).get()
  if (snap.empty) {
    console.log(`[okulHatirlatmaGonder] ${bugun} için bekleyen sipariş yok, atlanıyor.`)
    return
  }
  await pushGonderKullanicilara(
    'okulHatirlatma',
    'Okul Siparişlerini Kontrol Edin',
    'Bugünün okul siparişlerini gözden geçirip günü kapatmayı unutmayın.'
  )
})

/** Sipariş modülü için ortak mantık — yarın + öbür günün listelerini ayrı ayrı gönderir. */
async function siparisListeleriniGonder(): Promise<void> {
  const chatId = await telegramChatIdGetir('siparis')
  if (!chatId) {
    console.log('[siparisListeleriniGonder] Sipariş için Telegram chat ID tanımlı değil, atlanıyor.')
    return
  }
  const bugun = istanbulTarihStr(new Date())
  const token = telegramBotToken.value().trim()
  for (const gun of [1, 2]) {
    const tarih = gunEkle(bugun, gun)
    const mesaj = await siparisMesajiOlustur(tarih)
    if (!mesaj) {
      console.log(`[siparisListeleriniGonder] ${tarih} için sipariş yok, atlanıyor.`)
      continue
    }
    await telegramMesajGonder(token, chatId, mesaj)
  }
}

/** Her sabah 07:45 (İstanbul) — yarın ve öbür günün sipariş listelerini Telegram'a, ayrıca
 * "günlük hatırlatma" tercihi açık personele yarının sipariş sayısını push olarak gönderir. */
export const siparisListeleriSabahGonder = onSchedule(
  { schedule: '45 7 * * *', timeZone: TIME_ZONE, region: REGION, secrets: [telegramBotToken] },
  async () => {
    await siparisListeleriniGonder()

    const yarin = gunEkle(istanbulTarihStr(new Date()), 1)
    const db = getFirestore()
    const snap = await db.collection('siparis_orders').where('teslimatTarihi', '==', yarin).where('silindi', '==', false).get()
    const sayisi = snap.docs.map((d) => d.data()).filter((s) => s.durum !== 'iptal').length
    if (sayisi === 0) return
    await pushGonderKullanicilara('gunlukHatirlatma', 'Yarın İçin Sipariş Var', `Yarın için ${sayisi} sipariş bulunuyor.`)
  }
)

/** Her akşam 17:00 (İstanbul) — yarın ve öbür günün sipariş listelerini tekrar gönderir (güncellemeler yansısın diye). */
export const siparisListeleriAksamGonder = onSchedule(
  { schedule: '0 17 * * *', timeZone: TIME_ZONE, region: REGION, secrets: [telegramBotToken] },
  async () => {
    await siparisListeleriniGonder()
  }
)

// --- JSON yedekleme ---

/** Her sabah 07:50 (İstanbul) — tüm Firestore koleksiyonlarını tek bir JSON dosyasına
 * yedekleyip Okul modülünün Telegram sohbetine dosya olarak gönderir. */
export const jsonYedekGonder = onSchedule(
  { schedule: '50 7 * * *', timeZone: TIME_ZONE, region: REGION, secrets: [telegramBotToken], memory: '512MiB', timeoutSeconds: 300 },
  async () => {
    const chatId = await telegramChatIdGetir('okul')
    if (!chatId) {
      console.log('[jsonYedekGonder] Okul için Telegram chat ID tanımlı değil, atlanıyor.')
      return
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

    const tarih = istanbulTarihStr(new Date())
    const icerik = JSON.stringify(yedek, null, 2)
    const dosyaAdi = `basak-yedek-${tarih}.json`
    await telegramDosyaGonder(telegramBotToken.value().trim(), chatId, icerik, dosyaAdi, `${tarih} tarihli otomatik veritabanı yedeği`)
  }
)

// --- Anlık push bildirimi: yeni sipariş girildiğinde ---

interface YeniSiparisVerisi {
  musteriAdi?: string
  durum?: string
  items?: { adet: number; urunAdi: string }[]
}

/** Yeni bir sipariş dokümanı oluşturulduğunda, "yeni sipariş" bildirimini açmış personele
 * anlık push gönderir. İleriye dönük toplu üretilmiş 'planlandi' taslaklar hariçtir —
 * bunlar tek seferde onlarca kayıt oluşturabildiği için bildirim spam'ine yol açardı. */
export const yeniSiparisBildirimi = onDocumentCreated({ document: 'siparis_orders/{siparisId}', region: REGION }, async (event) => {
  const veri = event.data?.data() as YeniSiparisVerisi | undefined
  if (!veri || veri.durum === 'planlandi') return
  const urunOzet = (veri.items ?? []).map((it) => `${it.adet}x ${it.urunAdi}`).join(', ')
  await pushGonderKullanicilara('yeniSiparis', 'Yeni Sipariş', `${veri.musteriAdi ?? '—'} — ${urunOzet}`)
})
