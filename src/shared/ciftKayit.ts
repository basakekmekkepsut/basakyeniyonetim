import { collection, getDocs, query, where } from 'firebase/firestore'
import { requireDb } from '../lib/firebase'
import type { VeresiyeGirisYontemi, VeresiyeKaydi } from '../lib/types'

// Olası çift kayıt tespiti. Aynı müşteriye aynı gün aynı ürünün birden fazla
// kez yazılması tek başına hata DEĞİL (ör. Hastane'ye günde 3 servis, Yeniçeri'nin
// okulları, sipariş harici ek ekmek). Gerçek hatalar hep şu iki biçimde çıktı:
//   - otomatik bir kaynak (Sipariş/Okul) ile elle giriş AYNI adetle çakışıyor
//     (ör. silinmiş şablonun bıraktığı sipariş + Baraj'ın elle girilen simidi),
//   - Sipariş ve Okul aynı müşteriye aynı ürünü birlikte yazıyor (adet fark etmez).
// Yalnızca bu çiftler işaretlenir; kullanıcı "Sorun değil" dediğinde kayıtlara
// ciftKayitOnay:true yazılır ve tekrar uyarılmaz.
// NOT: functions/src/ciftKayit.ts aynı kuralın sunucu (Telegram) kopyasıdır —
// kural değişirse ikisi birlikte güncellenmeli.

export const KONTROL_GUN_SAYISI = 14

const OTOMATIK: VeresiyeGirisYontemi[] = ['siparis', 'okul']

export const KAYNAK_ETIKETI: Record<VeresiyeGirisYontemi, string> = {
  manuel: 'Elle',
  un_hesabi: 'Un hesabı',
  siparis: 'Sipariş',
  okul: 'Okul',
  migrasyon: 'Eski sistem'
}

export interface CiftKayitGrubu {
  anahtar: string
  musteriId: string
  musteriAdi: string
  tarih: string
  urunAdi: string
  kayitlar: VeresiyeKaydi[]
}

type OnayliKayit = VeresiyeKaydi & { ciftKayitOnay?: boolean }

function cakisiyorMu(a: VeresiyeKaydi, b: VeresiyeKaydi): boolean {
  if (a.girisYontemi === b.girisYontemi) return false
  const aOto = OTOMATIK.includes(a.girisYontemi)
  const bOto = OTOMATIK.includes(b.girisYontemi)
  if (aOto && bOto) return true
  return (aOto || bOto) && a.adet === b.adet
}

/** Okul satırlarında urunAdi "Okul — Ürün" biçiminde — başlıkta yalın ürün adı gösterilir. */
function yalinUrunAdi(urunAdi: string): string {
  const i = urunAdi.lastIndexOf(' — ')
  return i === -1 ? urunAdi : urunAdi.slice(i + 3)
}

export function ciftKayitlariBul(kayitlar: VeresiyeKaydi[]): CiftKayitGrubu[] {
  const gruplar = new Map<string, OnayliKayit[]>()
  for (const k of kayitlar as OnayliKayit[]) {
    if (k.ciftKayitOnay) continue
    const anahtar = `${k.musteriId}|${k.tarih}|${k.productId}`
    gruplar.set(anahtar, [...(gruplar.get(anahtar) ?? []), k])
  }

  const sonuc: CiftKayitGrubu[] = []
  for (const grup of gruplar.values()) {
    if (grup.length < 2) continue
    const supheli = new Set<VeresiyeKaydi>()
    for (let i = 0; i < grup.length; i++) {
      for (let j = i + 1; j < grup.length; j++) {
        if (cakisiyorMu(grup[i], grup[j])) {
          supheli.add(grup[i])
          supheli.add(grup[j])
        }
      }
    }
    if (supheli.size === 0) continue
    const liste = [...supheli].sort((a, b) => a.girisYontemi.localeCompare(b.girisYontemi))
    const ilk = liste[0]
    sonuc.push({
      anahtar: liste
        .map((k) => k.id)
        .sort()
        .join(','),
      musteriId: ilk.musteriId,
      musteriAdi: ilk.musteriAdi,
      tarih: ilk.tarih,
      urunAdi: yalinUrunAdi(ilk.urunAdi),
      kayitlar: liste
    })
  }
  return sonuc.sort((a, b) => b.tarih.localeCompare(a.tarih) || a.musteriAdi.localeCompare(b.musteriAdi, 'tr-TR'))
}

/**
 * Elle giriş kaydedilmeden ÖNCE: aynı müşteri+gün+ürün için Sipariş/Okul'un
 * zaten aynı adeti yazıp yazmadığına bakar. Çakışanların okunur açıklamasını döner
 * (boşsa sorun yok).
 */
export async function otomatikCakismaBul(
  kalemler: { musteriId: string; musteriAdi: string; tarih: string; productId: string; urunAdi: string; adet: number }[]
): Promise<string[]> {
  const db = requireDb()
  const musteriTarihleri = new Map<string, Set<string>>()
  for (const k of kalemler) {
    if (k.adet <= 0) continue
    musteriTarihleri.set(k.musteriId, (musteriTarihleri.get(k.musteriId) ?? new Set()).add(k.tarih))
  }
  const mevcut: VeresiyeKaydi[] = []
  for (const musteriId of musteriTarihleri.keys()) {
    const tarihler = [...musteriTarihleri.get(musteriId)!].slice(0, 30) // 'in' sınırı
    const snap = await getDocs(
      query(collection(db, 'veresiye_kayitlar'), where('musteriId', '==', musteriId), where('tarih', 'in', tarihler))
    )
    snap.docs.forEach((d) => {
      const v = { id: d.id, ...d.data() } as VeresiyeKaydi
      if (OTOMATIK.includes(v.girisYontemi)) mevcut.push(v)
    })
  }
  const uyarilar: string[] = []
  for (const k of kalemler) {
    if (k.adet <= 0) continue
    const cakisan = mevcut.find((v) => v.musteriId === k.musteriId && v.tarih === k.tarih && v.productId === k.productId && v.adet === k.adet)
    if (cakisan) uyarilar.push(`${k.musteriAdi}: ${k.adet} × ${yalinUrunAdi(k.urunAdi)} — ${KAYNAK_ETIKETI[cakisan.girisYontemi]} tarafından zaten yazılmış`)
  }
  return uyarilar
}
