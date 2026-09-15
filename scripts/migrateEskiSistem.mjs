/**
 * Eski sistemden (Sipariş.json + Veresiye.json) basakyeniyonetim'e TEK SEFERLİK veri aktarımı.
 *
 * Kullanım:
 *   1) Firebase Console > Project Settings > Service accounts > Generate new private key.
 *      İndirilen dosyayı örn. scripts/service-account.json olarak kaydedin (ASLA commit etmeyin).
 *
 *   2) Önce DRY RUN çalıştırın — hiçbir şey Firestore'a yazılmaz, yalnızca plan/özet basılır:
 *        node scripts/migrateEskiSistem.mjs --veresiye=Veresiye.json --siparis=Siparis.json --service-account=scripts/service-account.json
 *
 *   3) Çıktıdaki "Müşteri bazlı hesaplanacak GÜNCEL veresiye bakiyesi" listesini satır satır
 *      gerçek hayattaki (eski sistemdeki) güncel bakiyelerle karşılaştırıp doğrulayın.
 *
 *   4) Her şey doğruysa AYNI komuta --commit ekleyerek gerçekten yazın:
 *        node scripts/migrateEskiSistem.mjs --veresiye=Veresiye.json --siparis=Siparis.json --service-account=scripts/service-account.json --commit
 *
 *   5) Script bir kere --commit ile başarıyla tamamlanınca settings/migrationEskiSistem
 *      dokümanına damga vurur ve kazara ikinci kez veri ikilemesini önlemek için bir daha
 *      çalışmayı reddeder. Kasıtlı olarak tekrar çalıştırmak isterseniz --force ekleyin.
 *
 * Kapsam dışı bırakılanlar (bilinçli tercih):
 *   - Kullanıcı hesapları (users[]) — düz metin şifreler güvenli şekilde taşınamaz;
 *     Ayarlar > Kullanıcılar'dan elle oluşturulmalı.
 *   - Telegram ayarları — Ayarlar > Telegram'dan elle girilmeli.
 *   - Gelecek tarihli (bugünden sonraki) Sipariş.json kayıtları — bunlar eski sistemin
 *     tekrarlayan şablonundan önceden üretilmiş "taslak" kayıtlardır, atlanır; onun yerine
 *     aktif tekrarlayan şablonlar (recurringTemplates) doğrudan siparis_recurring_templates'e
 *     aktarılır.
 *   - Un Hesabı aktif müşterilerin GEÇMİŞ teslimatları: eski sistemde bu teslimatlar zaten
 *     gerçek ₺ borç (veresiye_kayitlar) olarak işlenmiş durumda; geçmiş borç bilgisini
 *     bozmamak için OLDUĞU GİBİ (₺ veresiye kaydı) aktarılır. Un Hesabı modeli SADECE
 *     bugünden itibaren (birikenEsdegerAdet: 0'dan başlar) geçerli olur.
 *   - Müşteri portalı şifreleri: eski sistemin 4 haneli şifreleri yeni sistemle (6 haneli)
 *     uyumsuz olduğu için YENİDEN üretilir — migrasyon sonrası müşterilere portal linkini
 *     WhatsApp'tan tekrar göndermeniz gerekir.
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
const veresiyeYolu = argAl('veresiye')
const siparisYolu = argAl('siparis')
const serviceAccountYolu = argAl('service-account', 'scripts/service-account.json')
const projeId = argAl('project', 'basakyeniyonetim')

if (!veresiyeYolu) {
  console.error('Kullanım: node scripts/migrateEskiSistem.mjs --veresiye=Veresiye.json [--siparis=Siparis.json] [--service-account=yol] [--commit] [--force]')
  process.exit(1)
}

function normalizeAd(ad) {
  return (ad ?? '')
    .toString()
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
}

function normalizeUrunAdi(ad) {
  return normalizeAd(ad)
    .replace(/\bekme(k|ği)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function altiHaneliParola() {
  return String(Math.floor(100000 + Math.random() * 900000))
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
    // Emülatör: kimlik doğrulama gerekmez.
    credential = undefined
  } else {
    credential = cert(JSON.parse(readFileSync(serviceAccountYolu, 'utf8')))
  }

  const app = initializeApp(credential ? { credential, projectId: projeId } : { projectId: projeId })
  const db = getFirestore(app)

  const guardRef = db.doc('settings/migrationEskiSistem')
  const guardSnap = await guardRef.get()
  if (guardSnap.exists && guardSnap.data().tamamlandi && !FORCE) {
    console.error('Bu migrasyon daha önce tamamlanmış görünüyor (settings/migrationEskiSistem.tamamlandi=true).')
    console.error('Kasıtlı olarak tekrar çalıştırmak istiyorsanız --force ekleyin.')
    process.exit(1)
  }

  const veresiye = JSON.parse(readFileSync(veresiyeYolu, 'utf8'))
  const siparis = siparisYolu ? JSON.parse(readFileSync(siparisYolu, 'utf8')) : null
  const bugun = new Date().toISOString().slice(0, 10)

  // --- 1) Ürünler: mevcut koleksiyon + Veresiye.ekmekTurleri + Sipariş.products birleşimi ---
  const mevcutUrunlerSnap = await db.collection('products').get()
  const urunPlan = new Map() // normalizeUrunAdi(ad) -> plan
  for (const d of mevcutUrunlerSnap.docs) {
    const v = d.data()
    urunPlan.set(normalizeUrunAdi(v.ad), { id: d.id, ad: v.ad, fiyat: v.fiyat, modules: v.modules ?? [], yeniMi: false, moduleEklendi: false })
  }

  const turIdToUrun = new Map()
  for (const t of veresiye.ekmekTurleri ?? []) {
    const anahtar = normalizeUrunAdi(t.ad)
    let girdi = urunPlan.get(anahtar)
    if (!girdi) {
      girdi = { id: db.collection('products').doc().id, ad: t.ad, fiyat: Number(t.fiyat) || 0, modules: ['veresiye'], yeniMi: true }
      urunPlan.set(anahtar, girdi)
    } else if (!girdi.modules.includes('veresiye')) {
      girdi.modules = [...girdi.modules, 'veresiye']
      girdi.moduleEklendi = true
    }
    turIdToUrun.set(t.id, girdi)
  }

  const siparisUrunIdToUrun = new Map()
  for (const p of siparis?.products ?? []) {
    const anahtar = normalizeUrunAdi(p.name)
    let girdi = urunPlan.get(anahtar)
    if (!girdi) {
      girdi = { id: db.collection('products').doc().id, ad: p.name, fiyat: 0, modules: ['siparis'], yeniMi: true }
      urunPlan.set(anahtar, girdi)
    } else if (!girdi.modules.includes('siparis')) {
      girdi.modules = [...girdi.modules, 'siparis']
      girdi.moduleEklendi = true
    }
    siparisUrunIdToUrun.set(p.id, girdi)
  }

  // --- 2) Müşteriler: Veresiye.musteriler ---
  const musteriPlan = new Map() // normalizeAd(ad) -> plan
  const eskiMusteriIdToPlan = new Map()
  for (const m of veresiye.musteriler ?? []) {
    const plan = {
      id: db.collection('musteriler').doc().id,
      ad: m.ad,
      adSoyad: m.adSoyad || '',
      hitapSekli: m.cinsiyet === 'erkek' ? 'bay' : m.cinsiyet === 'kadin' ? 'hanim' : null,
      telefon: m.telefon || '',
      adres: '',
      moduller: ['veresiye'],
      aktif: true,
      gecici: false,
      acilisBakiyesi: Number(m.acilisBakiyesi) || 0,
      ozelFiyatlar: {},
      sikUrunler: [],
      unHesabi: m.unHesabiAktif
        ? {
            aktif: true,
            referansUrunId: turIdToUrun.get(m.unHesabiUrunId)?.id ?? null,
            adetPerCuval: Number(m.unHesabiEsik) || null,
            birikenEsdegerAdet: 0
          }
        : null,
      veresiyeBorcToplam: 0,
      veresiyeOdemeToplami: 0,
      yeniMi: true,
      eskiId: m.id
    }
    for (const [eskiTurId, deger] of Object.entries(m.ozelFiyatlar ?? {})) {
      const urun = turIdToUrun.get(eskiTurId)
      if (urun) plan.ozelFiyatlar[urun.id] = deger
    }
    musteriPlan.set(normalizeAd(m.ad), plan)
    eskiMusteriIdToPlan.set(m.id, plan)
  }

  // --- 3) Aktif şablon satırları -> sikUrunler (adet bilgisi eski şemada yok, yalnızca ürün listesi) ---
  for (const s of veresiye.sablon ?? []) {
    if (!s.aktif) continue
    const plan = eskiMusteriIdToPlan.get(s.musteriId)
    const urun = turIdToUrun.get(s.turId)
    if (plan && urun && !plan.sikUrunler.includes(urun.id)) plan.sikUrunler.push(urun.id)
  }

  // --- 4) Veresiye kayıtları (geçmiş teslimatlar) ---
  const kayitPlanlari = []
  let atlananKayit = 0
  for (const k of veresiye.kayitlar ?? []) {
    const musteriPlani = eskiMusteriIdToPlan.get(k.musteriId)
    const urun = turIdToUrun.get(k.turId)
    if (!musteriPlani || !urun) {
      atlananKayit++
      continue
    }
    const adet = Number(k.adet) || 0
    const birimFiyat = Number(k.birimFiyat) || 0
    const tutar = adet * birimFiyat
    const durum = k.odendi ? 'odendi' : 'veresiye'
    kayitPlanlari.push({
      musteriId: musteriPlani.id,
      musteriAdi: musteriPlani.ad,
      productId: urun.id,
      urunAdi: urun.ad,
      adet,
      birimFiyat,
      tutar,
      tarih: k.tarih,
      durum,
      girisYontemi: 'migrasyon',
      kaynakSiparisId: null,
      esdegerAdet: 0
    })
    if (durum === 'veresiye') musteriPlani.veresiyeBorcToplam += tutar
  }

  // --- 5) Ödemeler ---
  const odemePlanlari = []
  let atlananOdeme = 0
  for (const o of veresiye.odemeler ?? []) {
    const musteriPlani = eskiMusteriIdToPlan.get(o.musteriId)
    if (!musteriPlani) {
      atlananOdeme++
      continue
    }
    const tutar = Number(o.tutar) || 0
    odemePlanlari.push({ musteriId: musteriPlani.id, musteriAdi: musteriPlani.ad, tutar, tarih: o.tarih, not: o.not || '' })
    musteriPlani.veresiyeOdemeToplami += tutar
  }

  // --- 6) Sipariş geçmişi + tekrarlayan şablonlar (opsiyonel) ---
  const siparisPlanlari = []
  const recurringPlanlari = []
  let atlananGelecekSiparis = 0
  let atlananSiparisUrunsuz = 0

  if (siparis) {
    for (const o of siparis.orders ?? []) {
      if (o.date > bugun) {
        atlananGelecekSiparis++
        continue
      }
      const anahtar = normalizeAd(o.customer)
      let musteriPlani = musteriPlan.get(anahtar)
      if (!musteriPlani) {
        musteriPlani = {
          id: db.collection('musteriler').doc().id,
          ad: o.customer,
          adSoyad: '',
          hitapSekli: null,
          telefon: '',
          adres: o.address || '',
          moduller: ['siparis'],
          aktif: true,
          // Sadece Sipariş.json'da geçen (Veresiye.json'da karşılığı olmayan) isimler —
          // gerçek/kalıcı olduğu doğrulanana kadar geçici sayılır (bkz. serbestMusteriBulYaOlustur
          // ile aynı ilke: "Kalıcı Müşteri Yap" akışıyla admin isterse kalıcıya çevirir).
          gecici: true,
          acilisBakiyesi: 0,
          ozelFiyatlar: {},
          sikUrunler: [],
          unHesabi: null,
          veresiyeBorcToplam: 0,
          veresiyeOdemeToplami: 0,
          yeniMi: true,
          eskiId: null
        }
        musteriPlan.set(anahtar, musteriPlani)
      } else if (!musteriPlani.moduller.includes('siparis')) {
        musteriPlani.moduller = [...musteriPlani.moduller, 'siparis']
      }

      const items = (o.items ?? [])
        .map((it) => {
          const urun = siparisUrunIdToUrun.get(it.productId) ?? urunPlan.get(normalizeUrunAdi(it.name))
          return { productId: urun?.id ?? '', urunAdi: urun?.ad ?? it.name ?? '', adet: Number(it.qty) || 0, birimFiyat: Number(it.price) || 0 }
        })
        .filter((it) => it.productId && it.adet > 0)
      if (items.length === 0) {
        atlananSiparisUrunsuz++
        continue
      }
      const toplamTutar = items.reduce((s, it) => s + it.adet * it.birimFiyat, 0)
      siparisPlanlari.push({
        musteriId: musteriPlani.id,
        musteriAdi: musteriPlani.ad,
        musteriGecici: musteriPlani.gecici,
        kaynakSablonId: null,
        adres: o.address || musteriPlani.adres || '',
        telefon: musteriPlani.telefon || '',
        not: o.note || '',
        teslimatTarihi: o.date,
        items,
        toplamTutar,
        durum: o.status === 'iptal' ? 'iptal' : 'teslim_edildi',
        odemeSekli: o.paid ? 'nakit' : 'veresiye',
        odemeDurumu: o.paid ? 'odendi' : 'odenmedi',
        veresiyeKayitIdler: [],
        silindi: false,
        olusturanUid: 'migrasyon-eski-sistem',
        olusturanAd: 'Eski Sistem'
      })
    }

    for (const rt of siparis.recurringTemplates ?? []) {
      if (!rt.active) continue
      const musteriPlani = musteriPlan.get(normalizeAd(rt.customer))
      if (!musteriPlani) continue
      const items = (rt.items ?? [])
        .map((it) => {
          const urun = siparisUrunIdToUrun.get(it.productId) ?? urunPlan.get(normalizeUrunAdi(it.name))
          return { productId: urun?.id ?? '', adet: Number(it.qty) || 0 }
        })
        .filter((it) => it.productId && it.adet > 0)
      if (items.length === 0) continue
      recurringPlanlari.push({
        musteriId: musteriPlani.id,
        musteriAdi: musteriPlani.ad,
        adres: rt.address || '',
        not: rt.note || '',
        items,
        gunler: [Number(rt.weekday)],
        bitisTarihi: null,
        aktif: true,
        sonOlusturulan: null
      })
      if (!musteriPlani.moduller.includes('siparis')) musteriPlani.moduller = [...musteriPlani.moduller, 'siparis']
    }
  }

  // --- ÖZET RAPORU ---
  const tumUrunler = [...urunPlan.values()]
  const tumMusteriler = [...musteriPlan.values()]
  console.log('=== MİGRASYON PLANI ÖZETİ ===')
  console.log(`Bugün (gelecek/geçmiş ayrımı için): ${bugun}`)
  console.log(`Ürünler: ${tumUrunler.length} (yeni oluşturulacak: ${tumUrunler.filter((u) => u.yeniMi).length}, modül eklenecek: ${tumUrunler.filter((u) => u.moduleEklendi).length})`)
  console.log(`Müşteriler: ${tumMusteriler.length} (Veresiye.json'dan: ${eskiMusteriIdToPlan.size}, Sipariş.json'dan yeni: ${tumMusteriler.length - eskiMusteriIdToPlan.size})`)
  console.log(`Veresiye kayıtları: ${kayitPlanlari.length} (müşteri/ürün eşleşmediği için atlanan: ${atlananKayit})`)
  console.log(`Ödemeler: ${odemePlanlari.length} (müşteri eşleşmediği için atlanan: ${atlananOdeme})`)
  if (siparis) {
    console.log(`Sipariş (geçmiş, tarih<=${bugun}): ${siparisPlanlari.length} (gelecek tarihli/taslak atlanan: ${atlananGelecekSiparis}, ürünsüz atlanan: ${atlananSiparisUrunsuz})`)
    console.log(`Tekrarlayan sipariş şablonu: ${recurringPlanlari.length}`)
  }
  console.log('')
  console.log('--- Müşteri bazlı hesaplanacak GÜNCEL veresiye bakiyesi (lütfen eski sistemle karşılaştırıp doğrulayın) ---')
  for (const m of tumMusteriler) {
    if (!m.moduller.includes('veresiye')) continue
    const final = m.acilisBakiyesi + m.veresiyeBorcToplam - m.veresiyeOdemeToplami
    console.log(
      `  ${m.ad.padEnd(24)} açılış:${m.acilisBakiyesi.toFixed(2).padStart(12)}  +borç:${m.veresiyeBorcToplam.toFixed(2).padStart(12)}  -ödeme:${m.veresiyeOdemeToplami.toFixed(2).padStart(12)}  = GÜNCEL:${final.toFixed(2).padStart(12)}`
    )
  }

  if (!COMMIT) {
    console.log('\n(DRY RUN — hiçbir şey yazılmadı. Plan doğruysa aynı komuta --commit ekleyerek gerçekten yazın.)')
    return
  }

  console.log('\n--commit verildi, Firestore\'a yazılıyor...')

  await parcalaYaz(
    db,
    tumUrunler
      .filter((u) => u.yeniMi)
      .map((u) => (batch) => {
        batch.set(db.collection('products').doc(u.id), { ad: u.ad, fiyat: u.fiyat, aktif: true, modules: u.modules, unKatsayisi: 1 })
      })
  )
  await parcalaYaz(
    db,
    tumUrunler
      .filter((u) => !u.yeniMi && u.moduleEklendi)
      .map((u) => (batch) => {
        batch.set(db.collection('products').doc(u.id), { modules: u.modules }, { merge: true })
      })
  )

  await parcalaYaz(
    db,
    tumMusteriler.map((m) => (batch) => {
      const finalBakiye = m.acilisBakiyesi + m.veresiyeBorcToplam - m.veresiyeOdemeToplami
      batch.set(db.collection('musteriler').doc(m.id), {
        ad: m.ad,
        adSoyad: m.adSoyad,
        hitapSekli: m.hitapSekli,
        telefon: m.telefon,
        adres: m.adres,
        moduller: m.moduller,
        aktif: m.aktif,
        gecici: m.gecici,
        acilisBakiyesi: m.acilisBakiyesi,
        veresiyeBakiye: m.moduller.includes('veresiye') ? finalBakiye : 0,
        ozelFiyatlar: m.ozelFiyatlar,
        sikUrunler: m.sikUrunler,
        unHesabi: m.unHesabi,
        portalSifre: m.moduller.includes('veresiye') ? altiHaneliParola() : null,
        olusturmaTarihi: FieldValue.serverTimestamp(),
        guncellenmeTarihi: FieldValue.serverTimestamp()
      })
    })
  )

  await parcalaYaz(
    db,
    kayitPlanlari.map((k) => (batch) => {
      batch.set(db.collection('veresiye_kayitlar').doc(), {
        ...k,
        olusturanUid: 'migrasyon-eski-sistem',
        olusturmaTarihi: FieldValue.serverTimestamp(),
        guncellenmeTarihi: FieldValue.serverTimestamp()
      })
    })
  )

  await parcalaYaz(
    db,
    odemePlanlari.map((o) => (batch) => {
      batch.set(db.collection('veresiye_odemeler').doc(), { ...o, olusturanUid: 'migrasyon-eski-sistem' })
    })
  )

  await parcalaYaz(
    db,
    siparisPlanlari.map((s) => (batch) => {
      batch.set(db.collection('siparis_orders').doc(), s)
    })
  )

  await parcalaYaz(
    db,
    recurringPlanlari.map((r) => (batch) => {
      batch.set(db.collection('siparis_recurring_templates').doc(), r)
    })
  )

  await guardRef.set({
    tamamlandi: true,
    tarih: FieldValue.serverTimestamp(),
    ozet: {
      musteri: tumMusteriler.length,
      urun: tumUrunler.length,
      veresiyeKaydi: kayitPlanlari.length,
      odeme: odemePlanlari.length,
      siparis: siparisPlanlari.length,
      recurringSablon: recurringPlanlari.length
    }
  })

  console.log('\nTAMAMLANDI.')
  console.log('ÖNEMLİ: Müşteri portal şifreleri yeniden üretildi (eski 4 haneli şifreler yeni 6 haneli')
  console.log('sistemle uyumsuz olduğu için) — müşterilere portal linkini WhatsApp\'tan tekrar göndermeniz gerekir.')
}

main().catch((err) => {
  console.error('HATA:', err)
  process.exit(1)
})
