/**
 * TEK SEFERLİK DÜZELTME — migrateEskiSistem.mjs ilk çalıştığında Sipariş.json'dan
 * (Veresiye.json'da karşılığı OLMAYAN) otomatik oluşturulan müşteriler yanlışlıkla
 * gecici:false yazılmıştı. Bu script, o müşterileri (yalnızca onları — Veresiye.json'da
 * gerçek karşılığı olan isimlere DOKUNMADAN) gecici:true olarak düzeltir.
 *
 * Ayrım: Veresiye.json'daki 15 müşterinin adı + Sipariş.json'daki (orders + recurringTemplates)
 * tüm müşteri adları normalize edilip karşılaştırılır — yalnızca Sipariş.json'da geçip
 * Veresiye.json'da KARŞILIĞI OLMAYAN adlar "düzeltilecekler" listesine girer.
 *
 * Kullanım:
 *   node scripts/duzeltGeciciMusteriler.mjs --veresiye=Veresiye.json --siparis=Siparis.json --service-account=scripts/service-account.json
 *   node scripts/duzeltGeciciMusteriler.mjs --veresiye=Veresiye.json --siparis=Siparis.json --service-account=scripts/service-account.json --commit
 */
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function argAl(isim, varsayilan = null) {
  const bulunan = process.argv.find((a) => a.startsWith(`--${isim}=`))
  return bulunan ? bulunan.slice(`--${isim}=`.length) : varsayilan
}
const COMMIT = process.argv.includes('--commit')
const veresiyeYolu = argAl('veresiye')
const siparisYolu = argAl('siparis')
const serviceAccountYolu = argAl('service-account', 'scripts/service-account.json')
const projeId = argAl('project', 'basakyeniyonetim')

if (!veresiyeYolu || !siparisYolu) {
  console.error('Kullanım: node scripts/duzeltGeciciMusteriler.mjs --veresiye=Veresiye.json --siparis=Siparis.json [--service-account=yol] [--commit]')
  process.exit(1)
}

function normalizeAd(ad) {
  return (ad ?? '').toString().trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')
}

async function parcalaYaz(db, islemler) {
  const PARCA = 400
  for (let i = 0; i < islemler.length; i += PARCA) {
    const batch = db.batch()
    for (const fn of islemler.slice(i, i + PARCA)) fn(batch)
    await batch.commit()
  }
}

async function main() {
  let credential
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    credential = undefined
  } else {
    credential = cert(JSON.parse(readFileSync(serviceAccountYolu, 'utf8')))
  }
  const app = initializeApp(credential ? { credential, projectId: projeId } : { projectId: projeId })
  const db = getFirestore(app)

  const veresiye = JSON.parse(readFileSync(veresiyeYolu, 'utf8'))
  const siparis = JSON.parse(readFileSync(siparisYolu, 'utf8'))

  const veresiyeAdlari = new Set((veresiye.musteriler ?? []).map((m) => normalizeAd(m.ad)))

  const siparisAdlari = new Set()
  for (const o of siparis.orders ?? []) siparisAdlari.add(normalizeAd(o.customer))
  for (const rt of siparis.recurringTemplates ?? []) siparisAdlari.add(normalizeAd(rt.customer))

  const sadeceSiparisteOlanlar = new Set([...siparisAdlari].filter((ad) => !veresiyeAdlari.has(ad)))

  console.log(`Veresiye.json'daki müşteri sayısı: ${veresiyeAdlari.size}`)
  console.log(`Sipariş.json'daki farklı müşteri sayısı: ${siparisAdlari.size}`)
  console.log(`Sadece Sipariş.json'da olan (düzeltme adayı): ${sadeceSiparisteOlanlar.size}`)

  const musteriSnap = await db.collection('musteriler').get()
  const duzeltilecekler = []
  for (const d of musteriSnap.docs) {
    const v = d.data()
    const anahtar = normalizeAd(v.ad)
    if (sadeceSiparisteOlanlar.has(anahtar) && v.gecici !== true) {
      duzeltilecekler.push({ id: d.id, ad: v.ad, mevcutGecici: v.gecici })
    }
  }

  console.log('')
  console.log(`Firestore'da düzeltilecek müşteri: ${duzeltilecekler.length}`)
  for (const m of duzeltilecekler) {
    console.log(`  - ${m.ad}  (gecici: ${m.mevcutGecici} -> true)`)
  }

  if (duzeltilecekler.length === 0) {
    console.log('Düzeltilecek bir şey yok.')
    return
  }

  if (!COMMIT) {
    console.log('\n(DRY RUN — hiçbir şey yazılmadı. Liste doğruysa aynı komuta --commit ekleyin.)')
    return
  }

  await parcalaYaz(
    db,
    duzeltilecekler.map((m) => (batch) => {
      batch.update(db.collection('musteriler').doc(m.id), { gecici: true })
    })
  )

  console.log(`\nTAMAMLANDI. ${duzeltilecekler.length} müşteri gecici:true olarak düzeltildi.`)
}

main().catch((err) => {
  console.error('HATA:', err)
  process.exit(1)
})
