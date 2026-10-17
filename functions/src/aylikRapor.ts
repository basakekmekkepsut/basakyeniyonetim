import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { getFirestore } from 'firebase-admin/firestore'

const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')
const TIME_ZONE = 'Europe/Istanbul'

const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

type Modul = 'siparis' | 'veresiye' | 'okul'

interface Ay {
  baslangic: string
  bitis: string
  etiket: string
}

/** Istanbul takvimine göre bir önceki ay: { baslangic: '2026-09-01', bitis: '2026-09-30', etiket: 'Eylül 2026' } */
function gecenAy(simdi: Date): Ay {
  const bugun = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(simdi)
  const [y, m] = bugun.split('-').map(Number)
  const yil = m === 1 ? y - 1 : y
  const ay = m === 1 ? 12 : m - 1
  const sonGun = new Date(Date.UTC(yil, ay, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    baslangic: `${yil}-${pad(ay)}-01`,
    bitis: `${yil}-${pad(ay)}-${pad(sonGun)}`,
    etiket: `${AY_ADLARI[ay - 1]} ${yil}`
  }
}

const tl = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} ₺`

async function chatIdGetir(modul: Modul): Promise<string | null> {
  const snap = await getFirestore().doc('settings/telegram').get()
  const chatId = snap.data()?.chatIds?.[modul]
  return typeof chatId === 'string' && chatId ? chatId : null
}

async function mesajGonder(token: string, chatId: string, mesaj: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: mesaj.slice(0, 4000) })
  })
  const sonuc = (await response.json()) as { ok: boolean; description?: string }
  if (!response.ok || !sonuc.ok) throw new Error(`Telegram mesaj gönderimi başarısız: ${sonuc.description ?? response.statusText}`)
}

async function veresiyeRaporu(ay: Ay): Promise<string> {
  const db = getFirestore()
  const [kayitlar, odemeler, musteriler] = await Promise.all([
    db.collection('veresiye_kayitlar').where('tarih', '>=', ay.baslangic).where('tarih', '<=', ay.bitis).get(),
    db.collection('veresiye_odemeler').where('tarih', '>=', ay.baslangic).where('tarih', '<=', ay.bitis).get(),
    db.collection('musteriler').get()
  ])

  let veresiye = 0
  let nakit = 0
  for (const d of kayitlar.docs) {
    const { durum, tutar } = d.data() as { durum: string; tutar: number }
    if (durum === 'nakit') nakit += tutar ?? 0
    else veresiye += tutar ?? 0
  }
  const tahsilat = odemeler.docs.reduce((t, d) => t + ((d.data().tutar as number) ?? 0), 0)

  const borclular = musteriler.docs
    .map((d) => d.data() as { ad: string; veresiyeBakiye?: number; moduller?: string[] })
    .filter((m) => m.moduller?.includes('veresiye') && (m.veresiyeBakiye ?? 0) > 0)
    .sort((a, b) => (b.veresiyeBakiye ?? 0) - (a.veresiyeBakiye ?? 0))
  const toplamBakiye = borclular.reduce((t, m) => t + (m.veresiyeBakiye ?? 0), 0)

  return [
    `📊 ${ay.etiket} Veresiye Raporu`,
    '',
    `Veresiye teslimat: ${tl(veresiye)}`,
    `Peşin (nakit) teslimat: ${tl(nakit)}`,
    `Tahsilat (ödemeler): ${tl(tahsilat)}`,
    '',
    `Güncel toplam alacak: ${tl(toplamBakiye)} (${borclular.length} müşteri)`,
    '',
    'En borçlu 5 müşteri:',
    ...borclular.slice(0, 5).map((m, i) => `${i + 1}. ${m.ad} — ${tl(m.veresiyeBakiye ?? 0)}`)
  ].join('\n')
}

async function okulRaporu(ay: Ay): Promise<string> {
  const db = getFirestore()
  const [teslimatlar, odemeler, okullar] = await Promise.all([
    db.collection('okul_teslimatlar').where('tarih', '>=', ay.baslangic).where('tarih', '<=', ay.bitis).get(),
    db.collection('okul_payments').where('tarih', '>=', ay.baslangic).where('tarih', '<=', ay.bitis).get(),
    db.collection('okul_schools').get()
  ])
  const okulAd = new Map(okullar.docs.map((d) => [d.id, (d.data().ad as string) ?? d.id]))

  const okulTutar = new Map<string, number>()
  const urunAdet = new Map<string, number>()
  let toplam = 0
  for (const d of teslimatlar.docs) {
    const t = d.data() as { schoolId: string; tutar: number; adet: number; urunAdi: string }
    toplam += t.tutar ?? 0
    okulTutar.set(t.schoolId, (okulTutar.get(t.schoolId) ?? 0) + (t.tutar ?? 0))
    urunAdet.set(t.urunAdi, (urunAdet.get(t.urunAdi) ?? 0) + (t.adet ?? 0))
  }
  const tahsilat = odemeler.docs.reduce((t, d) => t + ((d.data().tutar as number) ?? 0), 0)

  const okulSatirlari = [...okulTutar.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([id, tutar]) => `• ${okulAd.get(id) ?? id}: ${tl(tutar)}`)
  const urunSatirlari = [...urunAdet.entries()].sort((a, b) => b[1] - a[1]).map(([u, a]) => `${u}: ${a} adet`)

  return [
    `🏫 ${ay.etiket} Okul Raporu`,
    '',
    `Toplam teslimat: ${tl(toplam)}`,
    `Tahsilat: ${tl(tahsilat)}`,
    '',
    'Okul bazında teslimat:',
    ...(okulSatirlari.length ? okulSatirlari : ['(kayıt yok)']),
    '',
    'Ürün toplamları:',
    ...(urunSatirlari.length ? urunSatirlari : ['(kayıt yok)'])
  ].join('\n')
}

async function siparisRaporu(ay: Ay): Promise<string> {
  const snap = await getFirestore()
    .collection('siparis_orders')
    .where('teslimatTarihi', '>=', ay.baslangic)
    .where('teslimatTarihi', '<=', ay.bitis)
    .get()

  let adet = 0
  let iptal = 0
  let ciro = 0
  const urunAdet = new Map<string, number>()
  for (const d of snap.docs) {
    const s = d.data() as { silindi?: boolean; durum: string; toplamTutar?: number; items: { urunAdi: string; adet: number }[] }
    if (s.silindi) continue
    if (s.durum === 'iptal') {
      iptal++
      continue
    }
    adet++
    ciro += s.toplamTutar ?? 0
    for (const it of s.items) urunAdet.set(it.urunAdi, (urunAdet.get(it.urunAdi) ?? 0) + it.adet)
  }
  const urunSatirlari = [...urunAdet.entries()].sort((a, b) => b[1] - a[1]).map(([u, a]) => `${u}: ${a} adet`)

  return [
    `📋 ${ay.etiket} Sipariş Raporu`,
    '',
    `Sipariş sayısı: ${adet}${iptal ? ` (+${iptal} iptal)` : ''}`,
    `Toplam tutar: ${tl(ciro)}`,
    '',
    'Ürün toplamları:',
    ...(urunSatirlari.length ? urunSatirlari : ['(kayıt yok)'])
  ].join('\n')
}

/** Her ayın 1'i 08:00 (İstanbul) — geçen ayın Veresiye, Okul ve Sipariş raporlarını kendi Telegram sohbetlerine gönderir. */
export const aylikRaporGonder = onSchedule(
  { schedule: '0 8 1 * *', timeZone: TIME_ZONE, region: 'europe-west1', secrets: [telegramBotToken] },
  async () => {
    const ay = gecenAy(new Date())
    const token = telegramBotToken.value().trim()
    const raporlar: [Modul, (a: Ay) => Promise<string>][] = [
      ['veresiye', veresiyeRaporu],
      ['okul', okulRaporu],
      ['siparis', siparisRaporu]
    ]
    for (const [modul, olustur] of raporlar) {
      try {
        const chatId = await chatIdGetir(modul)
        if (!chatId) {
          console.log(`[aylikRaporGonder] ${modul} için Telegram chat ID tanımlı değil, atlanıyor.`)
          continue
        }
        await mesajGonder(token, chatId, await olustur(ay))
      } catch (err) {
        console.error(`[aylikRaporGonder] ${modul} raporu gönderilemedi:`, err)
      }
    }
  }
)
