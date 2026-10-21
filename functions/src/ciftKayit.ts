import { defineSecret } from 'firebase-functions/params'
import { getFirestore } from 'firebase-admin/firestore'

// Olası çift kayıt Telegram uyarısı. Kural src/shared/ciftKayit.ts ile AYNI —
// biri değişirse diğeri de güncellenmeli. Kısaca: aynı müşteri+gün+ürün için
// otomatik (Sipariş/Okul) bir kayıtla elle giriş AYNI adetle çakışıyorsa ya da
// Sipariş ve Okul birlikte yazmışsa şüpheli sayılır. "Sorun değil" denen
// kayıtlar (ciftKayitOnay) ve daha önce bildirilmiş gruplar tekrar gönderilmez.

const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN')
const TIME_ZONE = 'Europe/Istanbul'
const KONTROL_GUN_SAYISI = 14
const OTOMATIK = ['siparis', 'okul']
const KAYNAK_ETIKETI: Record<string, string> = { manuel: 'Elle', un_hesabi: 'Un hesabı', siparis: 'Sipariş', okul: 'Okul', migrasyon: 'Eski sistem' }

interface Kayit {
  id: string
  musteriId: string
  musteriAdi: string
  productId: string
  urunAdi: string
  adet: number
  tutar: number
  tarih: string
  girisYontemi: string
  ciftKayitOnay?: boolean
}

function cakisiyorMu(a: Kayit, b: Kayit): boolean {
  if (a.girisYontemi === b.girisYontemi) return false
  const aOto = OTOMATIK.includes(a.girisYontemi)
  const bOto = OTOMATIK.includes(b.girisYontemi)
  if (aOto && bOto) return true
  return (aOto || bOto) && a.adet === b.adet
}

function yalinUrunAdi(urunAdi: string): string {
  const i = urunAdi.lastIndexOf(' — ')
  return i === -1 ? urunAdi : urunAdi.slice(i + 3)
}

function tarihStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Günde 3 kez — 09:00, 14:00 ve 20:00 (İstanbul), bkz. zamanlayici — — son 14 günün veresiye kayıtlarında yeni
 * bir olası çift kayıt varsa Veresiye (yoksa Okul) Telegram sohbetine yazar. */
export async function ciftKayitKontrol(): Promise<void> {
  const db = getFirestore()
  const bas = new Date()
  bas.setDate(bas.getDate() - KONTROL_GUN_SAYISI)
  const snap = await db.collection('veresiye_kayitlar').where('tarih', '>=', tarihStr(bas)).get()

  const gruplar = new Map<string, Kayit[]>()
  for (const d of snap.docs) {
    const k = { id: d.id, ...d.data() } as Kayit
    if (k.ciftKayitOnay) continue
    const anahtar = `${k.musteriId}|${k.tarih}|${k.productId}`
    gruplar.set(anahtar, [...(gruplar.get(anahtar) ?? []), k])
  }

  const supheliGruplar: { anahtar: string; kayitlar: Kayit[] }[] = []
  for (const grup of gruplar.values()) {
    const supheli = new Set<Kayit>()
    for (let i = 0; i < grup.length; i++) {
      for (let j = i + 1; j < grup.length; j++) {
        if (cakisiyorMu(grup[i], grup[j])) {
          supheli.add(grup[i])
          supheli.add(grup[j])
        }
      }
    }
    if (supheli.size === 0) continue
    const kayitlar = [...supheli]
    supheliGruplar.push({ anahtar: kayitlar.map((k) => k.id).sort().join(','), kayitlar })
  }

  const bildirimRef = db.doc('settings/ciftKayitBildirimleri')
  const oncekiler = new Set<string>(((await bildirimRef.get()).data()?.anahtarlar as string[] | undefined) ?? [])
  const yeniler = supheliGruplar.filter((g) => !oncekiler.has(g.anahtar))
  if (yeniler.length === 0) {
    console.log('[ciftKayitKontrol] Yeni olası çift kayıt yok.')
    return
  }

  const telegram = (await db.doc('settings/telegram').get()).data()?.chatIds as Record<string, string> | undefined
  const chatId = telegram?.veresiye || telegram?.okul
  if (!chatId) {
    console.log('[ciftKayitKontrol] Telegram chat ID tanımlı değil, atlanıyor.')
    return
  }

  const satirlar = yeniler
    .sort((a, b) => b.kayitlar[0].tarih.localeCompare(a.kayitlar[0].tarih))
    .map(({ kayitlar }) => {
      const ilk = kayitlar[0]
      const tarih = ilk.tarih.split('-').reverse().join('.')
      const detay = kayitlar.map((k) => `${k.adet} adet (${KAYNAK_ETIKETI[k.girisYontemi] ?? k.girisYontemi})`).join(' + ')
      return `• ${ilk.musteriAdi} — ${tarih} ${yalinUrunAdi(ilk.urunAdi)}: ${detay}`
    })
  const mesaj = [
    '⚠️ Olası çift veresiye kaydı',
    '',
    ...satirlar,
    '',
    'Uygulamanın üstündeki sarı uyarıdan inceleyip "Elle gireni sil" ya da "Sorun değil" diyebilirsiniz.'
  ].join('\n')

  const token = telegramBotToken.value().trim()
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: mesaj })
  })
  const sonuc = (await response.json()) as { ok: boolean; description?: string }
  if (!response.ok || !sonuc.ok) throw new Error(`Telegram mesaj gönderimi başarısız: ${sonuc.description ?? response.statusText}`)

  // Yalnızca hâlâ şüpheli olan grupların anahtarları saklanır — liste kendiliğinden küçük kalır.
  const guncel = supheliGruplar.map((g) => g.anahtar)
  await bildirimRef.set({ anahtarlar: guncel })
}
