/**
 * TAMAMLAYICI script — migrateEskiSistem.mjs ilk çalıştığında "gelecek tarihli" diye
 * ATLANAN Sipariş.json kayıtlarının içinden GERÇEK, tek seferlik siparişleri (BARAJ BRJ'nin
 * otomatik tekrarlayan şablon taslakları HARİÇ) production'a ekler.
 *
 * Ayrım mantığı: eski sistemde tekrarlayan şablondan önceden üretilmiş taslak siparişlerin
 * id'si hep "o_<aynıTimestamp>_<TARİH>" biçimindeydi (örn. "o_1787398463684_2027-12-28").
 * Bu desene UYMAYAN, tarihi bugünden ileride olan siparişler GERÇEK siparişlerdir ve bu
 * script onları ekler; desene UYANLAR zaten siparis_recurring_templates'e aktarıldığı için
 * (ve yeni sistemin kendi tekrarlayan sipariş mekanizması onları gününde otomatik
 * üreteceği için) burada bilerek atlanır.
 *
 * Kullanım (migrateEskiSistem.mjs ile aynı güvenlik akışı):
 *   node scripts/migrateGelecekSiparisler.mjs --siparis=Siparis.json --service-account=scripts/service-account.json
 *   node scripts/migrateGelecekSiparisler.mjs --siparis=Siparis.json --service-account=scripts/service-account.json --commit
 */
import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

function argAl(isim, varsayilan = null) {
  const bulunan = process.argv.find((a) => a.startsWith(`--${isim}=`))
  return bulunan ? bulunan.slice(`--${isim}=`.length) : varsayilan
}

const COMMIT = process.argv.includes('--commit')
const FORCE = process.argv.includes('--force')
const siparisYolu = argAl('siparis')
const serviceAccountYolu = argAl('service-account', 'scripts/service-account.json')
const projeId = argAl('project', 'basakyeniyonetim')

if (!siparisYolu) {
  console.error('Kullanım: node scripts/migrateGelecekSiparisler.mjs --siparis=Siparis.json [--service-account=yol] [--commit] [--force]')
  process.exit(1)
}

function normalizeAd(ad) {
  return (ad ?? '').toString().trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')
}
function normalizeUrunAdi(ad) {
  return normalizeAd(ad).replace(/\bekme(k|ği)\b/g, '').replace(/\s+/g, ' ').trim()
}
// Eski sistemin tekrarlayan şablondan otomatik ürettiği taslak sipariş id deseni.
const TASLAK_ID_DESENI = /^o_\d+_\d{4}-\d{2}-\d{2}$/

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

  const guardRef = db.doc('settings/migrationGelecekSiparisler')
  const guardSnap = await guardRef.get()
  if (guardSnap.exists && guardSnap.data().tamamlandi && !FORCE) {
    console.error('Bu tamamlayıcı migrasyon daha önce çalıştırılmış (settings/migrationGelecekSiparisler.tamamlandi=true).')
    console.error('Kasıtlı tekrar çalıştırmak için --force ekleyin.')
    process.exit(1)
  }

  const siparis = JSON.parse(readFileSync(siparisYolu, 'utf8'))
  const bugun = new Date().toISOString().slice(0, 10)

  const gelecekGercekSiparisler = (siparis.orders ?? []).filter((o) => o.date > bugun && !TASLAK_ID_DESENI.test(o.id))
  const taslakSayisi = (siparis.orders ?? []).filter((o) => o.date > bugun && TASLAK_ID_DESENI.test(o.id)).length

  console.log(`Bugün: ${bugun}`)
  console.log(`Gelecek tarihli toplam: ${gelecekGercekSiparisler.length + taslakSayisi}`)
  console.log(`  - Tekrarlayan şablon taslağı (bilerek atlanıyor, şablon zaten aktarıldı): ${taslakSayisi}`)
  console.log(`  - Gerçek, tek seferlik gelecek sipariş (eklenecek): ${gelecekGercekSiparisler.length}`)

  if (gelecekGercekSiparisler.length === 0) {
    console.log('Eklenecek sipariş yok.')
    return
  }

  // Mevcut ürün + müşteri koleksiyonlarını oku — migrateEskiSistem.mjs'in oluşturduğu
  // gerçek doküman ID'leriyle eşleştirmek için (yeni doküman OLUŞTURMAK yerine).
  const [urunSnap, musteriSnap] = await Promise.all([db.collection('products').get(), db.collection('musteriler').get()])
  const urunPlan = new Map()
  for (const d of urunSnap.docs) {
    const v = d.data()
    urunPlan.set(normalizeUrunAdi(v.ad), { id: d.id, ad: v.ad, modules: v.modules ?? [] })
  }
  const musteriPlan = new Map()
  for (const d of musteriSnap.docs) {
    const v = d.data()
    musteriPlan.set(normalizeAd(v.ad), { id: d.id, ad: v.ad, gecici: v.gecici === true, moduller: v.moduller ?? [], adres: v.adres ?? '', telefon: v.telefon ?? '' })
  }

  const yeniMusteriler = []
  const moduleGuncellenecekMusteriler = []
  const siparisPlanlari = []

  for (const o of gelecekGercekSiparisler) {
    const anahtar = normalizeAd(o.customer)
    let musteri = musteriPlan.get(anahtar)
    if (!musteri) {
      musteri = {
        id: db.collection('musteriler').doc().id,
        ad: o.customer,
        gecici: true,
        moduller: ['siparis'],
        adres: o.address || '',
        telefon: '',
        yeniMi: true
      }
      musteriPlan.set(anahtar, musteri)
      yeniMusteriler.push(musteri)
    } else if (!musteri.moduller.includes('siparis')) {
      musteri.moduller = [...musteri.moduller, 'siparis']
      moduleGuncellenecekMusteriler.push(musteri)
    }

    const items = (o.items ?? [])
      .map((it) => {
        const urun = urunPlan.get(normalizeUrunAdi(it.name))
        return { productId: urun?.id ?? '', urunAdi: urun?.ad ?? it.name ?? '', adet: Number(it.qty) || 0, birimFiyat: Number(it.price) || 0 }
      })
      .filter((it) => it.productId && it.adet > 0)
    if (items.length === 0) continue

    const toplamTutar = items.reduce((s, it) => s + it.adet * it.birimFiyat, 0)
    siparisPlanlari.push({
      musteriId: musteri.id,
      musteriAdi: musteri.ad,
      musteriGecici: musteri.gecici,
      kaynakSablonId: null,
      adres: o.address || musteri.adres || '',
      telefon: musteri.telefon || '',
      not: o.note || '',
      teslimatTarihi: o.date,
      items,
      toplamTutar,
      durum: 'yeni',
      odemeSekli: o.paid ? 'nakit' : 'veresiye',
      odemeDurumu: o.paid ? 'odendi' : 'odenmedi',
      veresiyeKayitIdler: [],
      silindi: false,
      olusturanUid: 'migrasyon-eski-sistem',
      olusturanAd: 'Eski Sistem'
    })
  }

  console.log('')
  console.log('--- Eklenecek siparişler ---')
  for (const s of siparisPlanlari) {
    console.log(`  ${s.teslimatTarihi}  ${s.musteriAdi.padEnd(24)} ${s.items.map((i) => `${i.adet}× ${i.urunAdi}`).join(', ')}  (${s.odemeDurumu})`)
  }
  if (yeniMusteriler.length > 0) {
    console.log('')
    console.log(`Yeni oluşturulacak müşteri: ${yeniMusteriler.map((m) => m.ad).join(', ')}`)
  }

  if (!COMMIT) {
    console.log('\n(DRY RUN — hiçbir şey yazılmadı. Plan doğruysa aynı komuta --commit ekleyerek gerçekten yazın.)')
    return
  }

  console.log('\n--commit verildi, Firestore\'a yazılıyor...')

  await parcalaYaz(
    db,
    yeniMusteriler.map((m) => (batch) => {
      batch.set(db.collection('musteriler').doc(m.id), {
        ad: m.ad,
        adSoyad: '',
        hitapSekli: null,
        telefon: '',
        adres: m.adres,
        moduller: m.moduller,
        aktif: true,
        gecici: true,
        acilisBakiyesi: 0,
        veresiyeBakiye: 0,
        ozelFiyatlar: {},
        sikUrunler: [],
        unHesabi: null,
        portalSifre: null,
        olusturmaTarihi: FieldValue.serverTimestamp(),
        guncellenmeTarihi: FieldValue.serverTimestamp()
      })
    })
  )

  await parcalaYaz(
    db,
    moduleGuncellenecekMusteriler.map((m) => (batch) => {
      batch.set(db.collection('musteriler').doc(m.id), { moduller: m.moduller }, { merge: true })
    })
  )

  await parcalaYaz(
    db,
    siparisPlanlari.map((s) => (batch) => {
      batch.set(db.collection('siparis_orders').doc(), s)
    })
  )

  await guardRef.set({
    tamamlandi: true,
    tarih: FieldValue.serverTimestamp(),
    ozet: { eklenenSiparis: siparisPlanlari.length, yeniMusteri: yeniMusteriler.length, atlananTaslak: taslakSayisi }
  })

  console.log(`\nTAMAMLANDI. ${siparisPlanlari.length} gerçek gelecek sipariş eklendi.`)
}

main().catch((err) => {
  console.error('HATA:', err)
  process.exit(1)
})
