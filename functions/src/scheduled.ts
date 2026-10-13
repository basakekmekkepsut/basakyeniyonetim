import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

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

const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

/** "2026-09-19" -> "2026-09-19 Cumartesi" */
function tarihGunAdiIle(tarihStr: string): string {
  const [y, m, d] = tarihStr.split('-').map(Number)
  const tarih = new Date(Date.UTC(y, m - 1, d))
  return `${tarihStr} ${GUN_ADLARI[tarih.getUTCDay()]}`
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
  not?: string
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
      if (!hat) continue // silinmiş hat — gönderilmez
      const urunAdi = hat.urunAdi
      const notEki = o.not ? ` — ${o.not}` : ''
      satirlar.push(`${okul.ad}: ${o.adet} adet (${urunAdi})${notEki}`)
      urunToplamlari.set(urunAdi, (urunToplamlari.get(urunAdi) ?? 0) + o.adet)
    }
  }

  if (satirlar.length === 0) return ''

  const toplamSatirlari = [...urunToplamlari.entries()].map(([urun, adet]) => `${urun}: ${adet} adet`)
  return [`Ekmek Siparişi — ${tarihGunAdiIle(tarih)}`, '', ...satirlar, '', 'Ürün bazında toplam:', ...toplamSatirlari].join('\n')
}

// --- Sipariş (müşteri) mesajı (bkz. src/modules/siparis/MesajPage.tsx siparisMesajOlustur ile aynı format) ---

interface SiparisItemOzet {
  adet: number
  urunAdi: string
}
interface SiparisOzet {
  musteriAdi: string
  items: SiparisItemOzet[]
  not?: string
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
    const notEki = s.not?.trim() ? ` — Not: ${s.not.trim()}` : ''
    return `• ${s.musteriAdi} — ${urunler}${notEki}`
  })
  const toplamSatirlari = [...urunToplamlari.entries()].map(([urun, adet]) => `${urun}: ${adet} adet`)
  return [`📋 ${tarihGunAdiIle(tarih)} Sipariş Listesi`, '', ...satirlar, '', 'Ürün bazında toplam:', ...toplamSatirlari].join('\n')
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

// --- Okul günü kapatma: hatırlatma + otomatik kapanış ---
//
// Akış (D = sipariş günü): D günü 16:00 hatırlatma → D+1 sabah 07:30 ikinci
// hatırlatma → D+1 12:00'de hâlâ kapatılmamışsa sunucu günü kendisi kapatır.

/** "2026-09-30" -> "30.09.2026" */
function tarihTr(tarihStr: string): string {
  const [y, m, d] = tarihStr.split('-')
  return `${d}.${m}.${y}`
}

/** Henüz kapatılmamış (kapandiMi:false) okul siparişlerinin, verilen üst sınıra
 * kadarki (dahil) tarihlerini sıralı döner — ileri tarihler (yarının siparişi
 * vb.) hariç tutulur, onlar zaten henüz kapatılamaz. */
async function acikOkulGunleri(sonTarihDahil: string): Promise<string[]> {
  const snap = await getFirestore().collection('okul_orders').where('kapandiMi', '==', false).get()
  const tarihler = new Set<string>()
  for (const d of snap.docs) {
    const tarih = d.data().tarih as string
    if (tarih <= sonTarihDahil) tarihler.add(tarih)
  }
  return [...tarihler].sort()
}

interface OkulKapanisSonucu {
  satirSayisi: number
  toplamTutar: number
  veresiyeYansimayan: number
}

/**
 * src/modules/okul/orderData.ts gunuKapat'ın sunucu (admin SDK) karşılığı —
 * aynı fiyat mantığı: ürünün liste fiyatı, okulun bağlı olduğu Veresiye
 * müşterisinde o ürün için özel fiyat varsa o. İkisi birbirinden ayrışmasın
 * diye değişiklik yapılırsa her iki yerde de yapılmalı.
 *
 * Gün daha önce kapatılmış olsa bile kapanış sonrası eklenmiş açık satırlar
 * varsa onları da kesinleştirip mevcut kapanış kaydına ekler.
 */
async function okulGunuKapatSunucu(tarih: string, kapatanUid: string): Promise<OkulKapanisSonucu> {
  const db = getFirestore()
  const [ordersSnap, okullarSnap, urunlerSnap, kapanisSnap] = await Promise.all([
    db.collection('okul_orders').where('tarih', '==', tarih).where('kapandiMi', '==', false).get(),
    db.collection('okul_schools').get(),
    db.collection('products').get(),
    db.doc(`okul_kapanislar/${tarih}`).get()
  ])
  const okullar = new Map(okullarSnap.docs.map((d) => [d.id, d.data()]))
  const urunler = new Map(urunlerSnap.docs.map((d) => [d.id, d.data()]))

  const musteriIdler = [...new Set(okullarSnap.docs.map((d) => d.data().musteriId as string | null).filter((id): id is string => !!id))]
  const musteriler = new Map<string, { ad: string; ozelFiyatlar: Record<string, number> }>()
  await Promise.all(
    musteriIdler.map(async (id) => {
      const s = await db.doc(`musteriler/${id}`).get()
      if (s.exists) musteriler.set(id, { ad: (s.data()?.ad as string) ?? '—', ozelFiyatlar: (s.data()?.ozelFiyatlar as Record<string, number>) ?? {} })
    })
  )

  const batch = db.batch()
  let satirSayisi = 0
  let toplamTutar = 0
  let veresiyeYansimayan = 0
  const bakiyeDeltalari = new Map<string, number>()

  for (const d of ordersSnap.docs) {
    const order = d.data() as { schoolId: string; lineId: string; productId: string; adet: number }
    const okul = okullar.get(order.schoolId)
    const hat = (okul?.lines as { id: string }[] | undefined)?.find((l) => l.id === order.lineId)
    const urun = urunler.get(order.productId)
    // 0 adetli ya da okulu/hattı/ürünü silinmiş satırlar teslimat üretmez ama
    // kapatılır — yoksa "Beklemede" listesinde sonsuza kadar asılı kalırlar.
    batch.update(d.ref, { kapandiMi: true })
    if (order.adet <= 0 || !okul || !hat || !urun) continue

    const veresiyeMusteriId = (okul.musteriId as string | null) ?? null
    const ozelFiyat = veresiyeMusteriId ? musteriler.get(veresiyeMusteriId)?.ozelFiyatlar[order.productId] : undefined
    const birimFiyat = ozelFiyat ?? (urun.fiyat as number)
    const tutar = order.adet * birimFiyat
    const veresiyeRef = veresiyeMusteriId ? db.collection('veresiye_kayitlar').doc() : null
    if (!veresiyeMusteriId) veresiyeYansimayan += 1

    batch.set(db.collection('okul_teslimatlar').doc(), {
      tarih,
      schoolId: order.schoolId,
      lineId: order.lineId,
      productId: order.productId,
      urunAdi: urun.ad,
      adet: order.adet,
      birimFiyat,
      tutar,
      kapanisZamani: FieldValue.serverTimestamp(),
      kapatanUid,
      veresiyeKayitId: veresiyeRef?.id ?? null
    })
    satirSayisi += 1
    toplamTutar += tutar

    if (veresiyeRef && veresiyeMusteriId) {
      batch.set(veresiyeRef, {
        musteriId: veresiyeMusteriId,
        musteriAdi: musteriler.get(veresiyeMusteriId)?.ad ?? '—',
        productId: order.productId,
        urunAdi: `${okul.ad} — ${urun.ad}`,
        adet: order.adet,
        birimFiyat,
        tutar,
        tarih,
        durum: 'veresiye',
        girisYontemi: 'okul',
        kaynakSiparisId: null,
        esdegerAdet: 0,
        olusturanUid: kapatanUid,
        olusturmaTarihi: FieldValue.serverTimestamp(),
        guncellenmeTarihi: FieldValue.serverTimestamp()
      })
      bakiyeDeltalari.set(veresiyeMusteriId, (bakiyeDeltalari.get(veresiyeMusteriId) ?? 0) + tutar)
    }
  }

  for (const [musteriId, delta] of bakiyeDeltalari) {
    batch.update(db.doc(`musteriler/${musteriId}`), { veresiyeBakiye: FieldValue.increment(delta) })
  }

  const oncedenKapali = kapanisSnap.exists && kapanisSnap.data()?.kapandi === true
  if (oncedenKapali) {
    batch.update(kapanisSnap.ref, { satirSayisi: FieldValue.increment(satirSayisi) })
  } else {
    batch.set(kapanisSnap.ref, { tarih, kapandi: true, kapanisZamani: FieldValue.serverTimestamp(), kapatanUid, satirSayisi })
  }

  await batch.commit()
  return { satirSayisi, toplamTutar, veresiyeYansimayan }
}

/** Her gün 16:00 (İstanbul) — bugün (ve varsa önceki günler) için okul ekstresi
 * hâlâ kapatılmamışsa Okul Telegram sohbetine hatırlatma gönderir. */
export const okulHatirlatmaGonder = onSchedule(
  { schedule: '0 16 * * *', timeZone: TIME_ZONE, region: REGION, secrets: [telegramBotToken] },
  async () => {
    const bugun = istanbulTarihStr(new Date())
    const gunler = await acikOkulGunleri(bugun)
    if (gunler.length === 0) {
      console.log(`[okulHatirlatmaGonder] ${bugun} ve öncesinde kapatılmamış gün yok, atlanıyor.`)
      return
    }
    const chatId = await telegramChatIdGetir('okul')
    if (!chatId) {
      console.log('[okulHatirlatmaGonder] Okul için Telegram chat ID tanımlı değil, atlanıyor.')
      return
    }
    const mesaj = [
      '⏰ Okul ekstresinde günü kapatmayı unutmayın.',
      '',
      `Kapatılmamış gün(ler): ${gunler.map(tarihTr).join(', ')}`,
      '',
      'Kapatılmazsa ertesi gün saat 12:00\'de otomatik kapatılacak.'
    ].join('\n')
    await telegramMesajGonder(telegramBotToken.value().trim(), chatId, mesaj)
  }
)

/** Her sabah 07:30 (İstanbul) — dün (veya daha önce) kapatılmamış okul günü
 * varsa, öğlen otomatik kapanıştan önce son bir hatırlatma gönderir. */
export const okulHatirlatmaSabahGonder = onSchedule(
  { schedule: '30 7 * * *', timeZone: TIME_ZONE, region: REGION, secrets: [telegramBotToken] },
  async () => {
    const dun = gunEkle(istanbulTarihStr(new Date()), -1)
    const gunler = await acikOkulGunleri(dun)
    if (gunler.length === 0) {
      console.log(`[okulHatirlatmaSabahGonder] ${dun} ve öncesinde kapatılmamış gün yok, atlanıyor.`)
      return
    }
    const chatId = await telegramChatIdGetir('okul')
    if (!chatId) {
      console.log('[okulHatirlatmaSabahGonder] Okul için Telegram chat ID tanımlı değil, atlanıyor.')
      return
    }
    const mesaj = [
      '⚠️ Okul ekstresinde kapatılmamış gün var!',
      '',
      `Gün(ler): ${gunler.map(tarihTr).join(', ')}`,
      '',
      'Bugün saat 12:00\'ye kadar kapatılmazsa sistem otomatik kapatacak.'
    ].join('\n')
    await telegramMesajGonder(telegramBotToken.value().trim(), chatId, mesaj)
  }
)

/** Her gün 12:00 (İstanbul) — dün ve öncesine ait hâlâ kapatılmamış okul
 * günlerini (bugün hariç) otomatik kapatır ve sonucu Telegram'a bildirir. */
export const okulGunuOtomatikKapat = onSchedule(
  { schedule: '0 12 * * *', timeZone: TIME_ZONE, region: REGION, secrets: [telegramBotToken] },
  async () => {
    const dun = gunEkle(istanbulTarihStr(new Date()), -1)
    const gunler = await acikOkulGunleri(dun)
    if (gunler.length === 0) {
      console.log(`[okulGunuOtomatikKapat] ${dun} ve öncesinde kapatılmamış gün yok, atlanıyor.`)
      return
    }

    const satirlar: string[] = []
    for (const tarih of gunler) {
      try {
        const sonuc = await okulGunuKapatSunucu(tarih, 'otomatik')
        const tutarStr = sonuc.toplamTutar.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
        satirlar.push(
          `✅ ${tarihTr(tarih)} — ${sonuc.satirSayisi} satır, ₺${tutarStr}` +
            (sonuc.veresiyeYansimayan > 0 ? ` (${sonuc.veresiyeYansimayan} satır Veresiye'ye bağlı değil)` : '')
        )
      } catch (err) {
        console.error(`[okulGunuOtomatikKapat] ${tarih} kapatılamadı`, err)
        satirlar.push(`❌ ${tarihTr(tarih)} — kapatılamadı: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    const chatId = await telegramChatIdGetir('okul')
    if (!chatId) {
      console.log('[okulGunuOtomatikKapat] Okul için Telegram chat ID tanımlı değil, mesaj gönderilmedi.')
      return
    }
    const mesaj = ['🔒 Okul ekstresi otomatik kapatıldı', '', ...satirlar, '', 'Hata varsa Ekstre > Son Kapatılan Günler\'den "Yeniden Aç" ile düzeltebilirsiniz.'].join('\n')
    await telegramMesajGonder(telegramBotToken.value().trim(), chatId, mesaj)
  }
)

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

/** Her sabah 07:45 (İstanbul) — yarın ve öbür günün sipariş listelerini Telegram'a gönderir. */
export const siparisListeleriSabahGonder = onSchedule(
  { schedule: '45 7 * * *', timeZone: TIME_ZONE, region: REGION, secrets: [telegramBotToken] },
  async () => {
    await siparisListeleriniGonder()
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
