/**
 * TEK SEFERLİK DÜZELTME — iki bağımsız sorunu giderir:
 *
 * 1) Yeniçeri çiftlenmesi: Okul modülündeki "YİBO" okulu, gerçek (Veresiye'deki)
 *    Yeniçeri müşterisi yerine tamamen boş/kullanılmayan bir "YENİÇERİ" (büyük harf)
 *    kopya müşteriye bağlıydı. Okulu gerçek müşteriye yeniden bağlar, kopya
 *    müşteriyi (sıfır bakiye, hiç kayıt yok — güvenle) siler. Kopuk firmaId
 *    referansı (zaten silinmiş bir firma) null'a çekilir.
 *
 * 2) Pansiyon'un yanlış ₺ borcu: Pansiyon un hesabı (çuval) ile çalışan bir
 *    müşteri ama geçmiş 542 teslimatı yanlışlıkla ₺ veresiye borcu olarak
 *    kaydedilmişti (₺175.488). Referans ürün dışındaki ürünler (Tost Ekmeği,
 *    Ramazan Pidesi) fiyat oranına göre çevrilmeli (unKatsayisi = kendi fiyatı /
 *    referans ürün fiyatı) — bu alan tüm ürünlerde yanlışlıkla 1 bırakılmıştı.
 *    Önce bu iki ürünün unKatsayisi'sini düzeltir (Tost Ekmeği 0.75, Ramazan
 *    Pidesi 1.25 — Baston Ekmek ₺16'ya oranla), sonra kayıtları doğru
 *    esdegerAdet ile 'un_odemeli' durumuna çevirir, Pansiyon'un veresiyeBakiye'sini
 *    0'a çeker ve birikenEsdegerAdet'i doğru toplama (10.968) eşitler.
 *
 * Kullanım:
 *   node scripts/duzeltYeniceriPansiyon.mjs --service-account=scripts/service-account.json
 *   node scripts/duzeltYeniceriPansiyon.mjs --service-account=scripts/service-account.json --commit
 */
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function argAl(isim, varsayilan = null) {
  const bulunan = process.argv.find((a) => a.startsWith(`--${isim}=`))
  return bulunan ? bulunan.slice(`--${isim}=`.length) : varsayilan
}
const COMMIT = process.argv.includes('--commit')
const serviceAccountYolu = argAl('service-account', 'scripts/service-account.json')
const projeId = argAl('project', 'basakyeniyonetim')

const GERCEK_YENICERI_ID = '0rvTblhqvDpRAC76BImZ'
const KOPYA_YENICERI_ID = 'FCvNqjWRuwhLTbtvlmLx'
const YIBO_OKUL_ID = 'YNbyrKKx785cbf3LVlH4'
const PANSIYON_ID = 'TfM7t9Jm6F6nek2eiS4q'
const BASTON_EKMEK_ID = 'DBUBit6QJPwbuU00P1Bs' // referans ürün — katsayı 1
const TOST_EKMEGI_ID = '45EAq6X75DZr6CHNAamm'
const RAMAZAN_PIDESI_ID = 'KCJsE54Su7zlu2Ystq9s'
// Fiyat oranı = ürünün kendi fiyatı / referans ürün (Baston Ekmek, ₺16) fiyatı
const DOGRU_UNKATSAYISI = {
  [BASTON_EKMEK_ID]: 1,
  [TOST_EKMEGI_ID]: 12 / 16, // 0.75
  [RAMAZAN_PIDESI_ID]: 20 / 16 // 1.25
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
  const credential = cert(JSON.parse(readFileSync(serviceAccountYolu, 'utf8')))
  const app = initializeApp({ credential, projectId: projeId })
  const db = getFirestore(app)

  console.log('=== 1) YENİÇERİ ÇİFTLENMESİ ===')
  const [gercekSnap, kopyaSnap, okulSnap] = await Promise.all([
    db.doc(`musteriler/${GERCEK_YENICERI_ID}`).get(),
    db.doc(`musteriler/${KOPYA_YENICERI_ID}`).get(),
    db.doc(`okul_schools/${YIBO_OKUL_ID}`).get()
  ])
  if (!gercekSnap.exists || !kopyaSnap.exists || !okulSnap.exists) {
    throw new Error('Beklenen dokümanlardan biri bulunamadı — id\'ler değişmiş olabilir, iptal ediliyor.')
  }
  const kopya = kopyaSnap.data()
  if ((kopya.veresiyeBakiye ?? 0) !== 0) {
    throw new Error(`GÜVENLİK: Kopya YENİÇERİ'nin bakiyesi 0 değil (${kopya.veresiyeBakiye}) — silme iptal edildi, elle kontrol edin.`)
  }
  const [kK, sK] = await Promise.all([
    db.collection('veresiye_kayitlar').where('musteriId', '==', KOPYA_YENICERI_ID).limit(1).get(),
    db.collection('siparis_orders').where('musteriId', '==', KOPYA_YENICERI_ID).limit(1).get()
  ])
  if (!kK.empty || !sK.empty) {
    throw new Error('GÜVENLİK: Kopya YENİÇERİ\'ye bağlı kayıt/sipariş bulundu — silme iptal edildi, elle kontrol edin.')
  }
  console.log(`YİBO okulu musteriId: ${okulSnap.data().musteriId} -> ${GERCEK_YENICERI_ID}`)
  console.log(`Kopya müşteri (${KOPYA_YENICERI_ID}, "${kopya.ad}") silinecek — doğrulandı: bakiye 0, hiç kayıt/sipariş yok.`)

  console.log('')
  console.log('=== 2) PANSİYON ÇUVAL DÜZELTMESİ ===')
  const pansiyonSnap = await db.doc(`musteriler/${PANSIYON_ID}`).get()
  if (!pansiyonSnap.exists || pansiyonSnap.data().ad !== 'Pansiyon') {
    throw new Error('Pansiyon dokümanı beklenen id ile bulunamadı — iptal ediliyor.')
  }
  const kayitlarSnap = await db.collection('veresiye_kayitlar').where('musteriId', '==', PANSIYON_ID).get()
  let toplamEsdegerAdet = 0
  let toplamTutar = 0
  let zatenUnOdemeli = 0
  let taniyamadigim = 0
  kayitlarSnap.forEach((d) => {
    const v = d.data()
    if (v.durum === 'un_odemeli') { zatenUnOdemeli++; return }
    const katsayi = DOGRU_UNKATSAYISI[v.productId]
    if (katsayi === undefined) { taniyamadigim++; return }
    toplamEsdegerAdet += v.adet * katsayi
    toplamTutar += v.tutar
  })
  if (taniyamadigim > 0) throw new Error(`${taniyamadigim} kayıtta beklenmeyen bir ürün var — script'i güncelleyip tekrar çalıştırın.`)
  toplamEsdegerAdet = Math.round(toplamEsdegerAdet * 100) / 100
  console.log(`Düzeltilecek kayıt: ${kayitlarSnap.size - zatenUnOdemeli} (zaten un_odemeli olan: ${zatenUnOdemeli})`)
  console.log(`Toplam eşdeğer adet (fiyat oranıyla): ${toplamEsdegerAdet}, toplam ₺ (kaldırılacak): ${toplamTutar}`)
  console.log(`Pansiyon veresiyeBakiye: ${pansiyonSnap.data().veresiyeBakiye} -> 0`)
  console.log(`Pansiyon birikenEsdegerAdet: ${pansiyonSnap.data().unHesabi?.birikenEsdegerAdet ?? 0} -> ${toplamEsdegerAdet}`)
  console.log(`~ ${(toplamEsdegerAdet / 200).toFixed(2)} çuval (1 çuval = 200 adet)`)

  if (!COMMIT) {
    console.log('\n(DRY RUN — hiçbir şey yazılmadı. Plan doğruysa aynı komuta --commit ekleyin.)')
    return
  }

  console.log('\n--commit verildi, Firestore\'a yazılıyor...')

  // 1) Yeniçeri düzeltmesi
  await db.doc(`okul_schools/${YIBO_OKUL_ID}`).update({ musteriId: GERCEK_YENICERI_ID, firmaId: null })
  await db.doc(`musteriler/${KOPYA_YENICERI_ID}`).delete()
  console.log('Yeniçeri düzeltmesi tamamlandı.')

  // 2) Ürün katsayı düzeltmesi (fiyat oranı — Baston Ekmek referans, katsayı 1)
  await db.doc(`products/${TOST_EKMEGI_ID}`).update({ unKatsayisi: DOGRU_UNKATSAYISI[TOST_EKMEGI_ID] })
  await db.doc(`products/${RAMAZAN_PIDESI_ID}`).update({ unKatsayisi: DOGRU_UNKATSAYISI[RAMAZAN_PIDESI_ID] })
  console.log('Ürün un katsayıları düzeltildi (Tost Ekmeği 0.75, Ramazan Pidesi 1.25).')

  // 3) Pansiyon düzeltmesi
  const guncellemeler = []
  kayitlarSnap.forEach((d) => {
    const v = d.data()
    if (v.durum === 'un_odemeli') return
    const katsayi = DOGRU_UNKATSAYISI[v.productId]
    guncellemeler.push((batch) => {
      batch.update(d.ref, { durum: 'un_odemeli', esdegerAdet: v.adet * katsayi })
    })
  })
  await parcalaYaz(db, guncellemeler)
  await db.doc(`musteriler/${PANSIYON_ID}`).update({
    veresiyeBakiye: 0,
    'unHesabi.birikenEsdegerAdet': toplamEsdegerAdet
  })
  console.log(`Pansiyon düzeltmesi tamamlandı: ${guncellemeler.length} kayıt un_odemeli yapıldı.`)

  console.log('\nTAMAMLANDI.')
}

main().catch((err) => {
  console.error('HATA:', err)
  process.exit(1)
})
