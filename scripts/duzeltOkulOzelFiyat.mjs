/**
 * TEK SEFERLİK DÜZELTME — Okul "Günü Kapat" müşteriye özel fiyatı dikkate
 * almaya başlamadan önce (≈ 2026-09-21) kapatılmış günlerde teslimatlar ürünün
 * LİSTE fiyatıyla kesinleşmişti (ör. Aşevi Roll Ekmek ₺4 yerine ₺0, Kantin Tost
 * ₺12 yerine ₺10). Okulun bağlı olduğu Veresiye müşterisinde o ürün için özel
 * fiyat tanımlıysa:
 *   - okul_teslimatlar.birimFiyat / tutar özel fiyata çekilir,
 *   - bağlı veresiye_kayitlar satırı da aynı fiyata çekilir,
 *   - satır durum='veresiye' ise müşterinin veresiyeBakiye'si farkı kadar düzeltilir.
 *
 * Kullanım:
 *   node scripts/duzeltOkulOzelFiyat.mjs --service-account=scripts/service-account.json            (yalnızca rapor)
 *   node scripts/duzeltOkulOzelFiyat.mjs --service-account=scripts/service-account.json --commit   (uygula)
 */
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

function argAl(isim, varsayilan = null) {
  const bulunan = process.argv.find((a) => a.startsWith(`--${isim}=`))
  return bulunan ? bulunan.slice(`--${isim}=`.length) : varsayilan
}

const saPath = argAl('service-account')
if (!saPath) {
  console.error('--service-account=... gerekli')
  process.exit(1)
}
const commit = process.argv.includes('--commit')

initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore()

const [okullarSnap, musterilerSnap, teslimatSnap] = await Promise.all([
  db.collection('okul_schools').get(),
  db.collection('musteriler').get(),
  db.collection('okul_teslimatlar').get()
])
const okullar = new Map(okullarSnap.docs.map((d) => [d.id, d.data()]))
const musteriler = new Map(musterilerSnap.docs.map((d) => [d.id, d.data()]))

const duzeltmeler = []
for (const d of teslimatSnap.docs) {
  const t = d.data()
  const okul = okullar.get(t.schoolId)
  const musteriId = okul?.musteriId
  const ozelFiyat = musteriId ? musteriler.get(musteriId)?.ozelFiyatlar?.[t.productId] : undefined
  if (ozelFiyat === undefined || ozelFiyat === t.birimFiyat) continue
  duzeltmeler.push({ ref: d.ref, t, okulAdi: okul.ad, musteriId, ozelFiyat })
}

duzeltmeler.sort((a, b) => a.t.tarih.localeCompare(b.t.tarih) || a.okulAdi.localeCompare(b.okulAdi, 'tr-TR'))
const bakiyeDeltalari = new Map()
let toplamFark = 0

const batch = db.batch()
for (const { ref, t, okulAdi, musteriId, ozelFiyat } of duzeltmeler) {
  const yeniTutar = t.adet * ozelFiyat
  const fark = yeniTutar - t.tutar
  toplamFark += fark
  console.log(`${t.tarih}  ${okulAdi.padEnd(22)} ${t.urunAdi.padEnd(14)} ${String(t.adet).padStart(4)} adet  ₺${t.birimFiyat} → ₺${ozelFiyat}  (fark ${fark.toFixed(2)})`)
  batch.update(ref, { birimFiyat: ozelFiyat, tutar: yeniTutar })

  if (t.veresiyeKayitId) {
    const vSnap = await db.doc(`veresiye_kayitlar/${t.veresiyeKayitId}`).get()
    const v = vSnap.data()
    if (vSnap.exists && v.birimFiyat !== ozelFiyat) {
      const vYeniTutar = v.adet * ozelFiyat
      batch.update(vSnap.ref, { birimFiyat: ozelFiyat, tutar: vYeniTutar, guncellenmeTarihi: FieldValue.serverTimestamp() })
      if (v.durum === 'veresiye') {
        bakiyeDeltalari.set(v.musteriId, (bakiyeDeltalari.get(v.musteriId) ?? 0) + (vYeniTutar - v.tutar))
      }
    }
  }
}

for (const [musteriId, delta] of bakiyeDeltalari) {
  console.log(`Bakiye: ${musteriler.get(musteriId)?.ad} ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`)
  batch.update(db.doc(`musteriler/${musteriId}`), { veresiyeBakiye: FieldValue.increment(delta) })
}

console.log(`\n${duzeltmeler.length} teslimat, toplam fark ₺${toplamFark.toFixed(2)}`)
if (duzeltmeler.length === 0) process.exit(0)
if (!commit) {
  console.log('Kuru çalıştırma — uygulamak için --commit ekleyin.')
  process.exit(0)
}
await batch.commit()
console.log('Uygulandı.')
