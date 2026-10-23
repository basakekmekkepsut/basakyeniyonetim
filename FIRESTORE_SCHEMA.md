# Başak Ekmek Yönetim — Firestore Şeması (basakyeniyonetim)

Bu doküman, **sıfırdan kurulacak yeni Firebase projesi** için kesinleşmesi gereken Firestore veri modelini tanımlar. Eski `basak-yonetim` projesindeki kod ve şema dokümanı yalnızca **iş mantığı referansı** olarak incelendi; hiçbir koleksiyon/ID/kod doğrudan taşınmıyor. Aşağıdaki tasarım, eski sistemde iyi çalışan desenleri korur, tespit edilen teknik borç ve tutarsızlıkları düzeltir.

Genel kurallar:
- Alan adları **Türkçe**.
- İş tarihleri (`tarih`, `teslimatTarihi` vb.) `YYYY-MM-DD` string; yazma/denetim zaman damgaları (`olusturmaTarihi`, `guncellenmeTarihi`, `kapanisZamani`) her zaman `serverTimestamp()` (eski sistemin "client `new Date()`" hatası tekrarlanmayacak).
- Koleksiyonlar flat/top-level, modül önekli: `siparis_*`, `veresiye_*`, `okul_*`. Gerçekten paylaşılan varlıklar (`users`, `musteriler`, `products`, `settings`, `activity_log`) önek taşımaz.
- **`kaynak: {uygulama,id}` gibi migration-izleme alanları YOK** — bu sıfırdan bir sistem, göç geçmişi tutulmayacak.
- Para tutarları `number` (TL, kuruş hassasiyeti gerekmiyorsa tam sayı/ondalık serbest — UI'da `₺240,00` formatında gösterilir).
- Her finansal işlemi başlatan yazma, ürün adı/fiyatı gibi değişebilir alanları **o andaki değeriyle snapshot** olarak da tutar (denormalize) — ürün sonradan yeniden adlandırılsa/fiyatı değişse bile geçmiş kayıt bozulmaz. Bu, eski sistemde sipariş ve okul-kapanış modüllerinde zaten doğru uygulanmış bir desendi; artık **veresiye** kayıtlarına da tutarlı şekilde uygulanıyor.

---

## 1. `users/{uid}`

Doküman ID = Firebase Auth UID.

```
{
  ad: string,
  eposta: string,
  rol: 'admin' | 'personel',
  modules: { siparis: boolean, veresiye: boolean, okul: boolean },
  permissions: {
    siparis: { orderAdd: boolean, orderViewAll: boolean, products: boolean },
    veresiye: { gorebilecegiMusteriler: string[] | 'all' },
    okul: { siparis: boolean, okullar: boolean, urunler: boolean, ekstre: boolean, mesaj: boolean }
  },
  aktif: boolean,
  olusturmaTarihi: Timestamp
}
```

- Personel kendi dokümanını yazamaz (rol/izin yükseltmesi engellenir) — sadece admin.
- `session` katmanı `users/{uid}` dokümanını canlı dinler; admin yetki değiştirdiğinde kullanıcı tekrar giriş yapmadan güncel yetkiyle karşılaşır (eski sistemin iyi çalışan tasarımı korunuyor).

---

## 2. `musteriler/{id}` — ORTAK müşteri/cari kaydı

Üç modülün de birinci sınıf, tek doğruluk kaynağı. **Eski sistemde sipariş modülü `musteriId`'yi hiç doldurmuyordu (ölü alan) — bu, yeni tasarımda kapatılan en kritik açık.** Artık sipariş dahil üç modül de aynı `musteriler` kaydına referans verir.

```
{
  ad: string,
  telefon: string,
  adres: string,                     // sipariş teslimat adresi varsayılanı
  moduller: string[],                // ['siparis','veresiye','okul'] — bu müşteri hangi modüllerde görünür/kullanılır
  aktif: boolean,

  // --- veresiye alanları (moduller içinde 'veresiye' varsa anlamlı) ---
  acilisBakiyesi: number,            // sistem öncesi devreden borç — ARTIK BAKİYE HESABINA DAHİL EDİLİR (eski sistemde ghost/unused alandı)
  veresiyeBakiye: number,            // denormalize edilmiş GÜNCEL bakiye (acilisBakiyesi + borç − tahsilat), transaction/increment() ile canlı tutulur
  ozelFiyatlar: { [productId: string]: number },

  unHesabi: {                        // "Un Hesaplı Giriş" özelliği — bkz. §6, eski sistemde tanımlı ama hiç kodlanmamış ghost alanların gerçek karşılığı
    aktif: boolean,
    urunId: string | null,           // → products/{id}, biriken un hangi ekmeğe çevrilecek
    gramajPerCuval: number | null,   // örn. 50000 (gram) — 1 çuval kaç gram
    esikGramaj: number | null,       // bu gramaja ulaşınca otomatik teslimat/borç kaydı oluşturulur
    adetPerEsik: number | null,      // KESİNLEŞTİ (Faz 3) — eşik aşılınca kaç adet ekmek borcu oluşturulsun (taslakta eksikti, dönüşüm için zorunlu)
    birikenGramaj: number            // henüz eşiğe ulaşmamış, bekleyen gramaj
  } | null,

  olusturmaTarihi: Timestamp,
  guncellenmeTarihi: Timestamp
}
```

> **Not (ID):** Firestore auto-id kullanılır (eski `okul_schools`'daki isimden türetilmiş slug ID deseni terk edildi — isim değişince ID'nin eski adı taşımaya devam etmesi sorunu böylece hiç oluşmaz).

---

## 3. `products/{id}` — ORTAK ürün kataloğu

```
{
  ad: string,
  fiyat: number,
  aktif: boolean,
  modules: string[],                 // ['siparis','veresiye','okul'] — hangi modüllerde satışa/seçime açık
  olusturmaTarihi: Timestamp,
  guncellenmeTarihi: Timestamp
}
```

- **Silme koruması tüm modülleri kapsar:** Bir ürün `siparis_orders` (aktif/son N gün), `siparis_recurring_templates`, `okul_schools.lines[]`, `veresiye_sablonlar` içinde kullanımdaysa silinemez, sadece `aktif:false` yapılabilir. (Eski sistemde bu kontrol yalnızca okul modülünü kapsıyordu — bilinen bir eksiklikti, düzeltiliyor.)

---

## 4. `settings/telegram` ve `settings/app`

```
settings/telegram: { chatIds: { siparis: string, veresiye: string, okul: string } }
settings/app: { versiyon: string, guncellenmeTarihi: Timestamp }
```

- Bot token'ı **Firestore'da asla saklanmaz** — sunucu tarafı (Firebase Cloud Function ortam değişkeni) `TELEGRAM_BOT_TOKEN` olarak tutulur, istemci yalnızca `{chatId, message}` gönderir.

---

## 5. `activity_log/{id}` — tüm modüller ortak aktivite kaydı

Eski sistemde her modülün kendi `*_activity` koleksiyonu vardı, hepsi filtresiz/limitsiz çekiliyordu. Tek koleksiyona indirildi, **sorgu her zaman `where('modul','==',x) + orderBy('olusturmaTarihi','desc') + limit(50)`** ile yapılır.

```
{
  modul: 'siparis' | 'veresiye' | 'okul',
  mesaj: string,
  kullaniciUid: string,
  kullaniciAd: string,
  olusturmaTarihi: Timestamp
}
```

**Gerekli composite index:** `(modul ASC, olusturmaTarihi DESC)`.

---

## 6. Sipariş modülü (`siparis_*`)

### `siparis_orders/{id}` (auto-id)

```
{
  musteriId: string,                 // → musteriler/{id}, ZORUNLU (eski sistemin ölü alanı artık gerçek referans)
  musteriAdi: string,                // snapshot — offline/hızlı görüntüleme için denormalize
  adres: string,
  telefon: string,
  not: string,
  teslimatTarihi: string,            // YYYY-MM-DD
  items: [
    { productId: string, urunAdi: string, adet: number, birimFiyat: number }
  ],
  toplamTutar: number,                // yazma anında hesaplanıp SAKLANIR: Σ(adet*birimFiyat) — eski sistemde hiç saklanmıyordu, 4+ yerde tekrar hesaplanıyordu
  durum: 'yeni' | 'hazirlaniyor' | 'teslim_edildi' | 'iptal',
  odemeSekli: 'veresiye' | 'nakit',   // KESİNLEŞTİ (2026-09-15) — sipariş oluşturulurken seçilir, otomatik veresiye entegrasyonunu yönlendirir, bkz. §6.1
  odemeDurumu: 'odenmedi' | 'odendi', // sipariş modülünün kendi ödeme takibi; 'odendi' olursa ve odemeSekli='veresiye' ise bağlı veresiye kaydı da 'odendi' olur (bkz. §6.1)
  veresiyeKayitIdler: string[],       // bu siparişten otomatik oluşturulan veresiye_kayitlar doküman ID'leri (items[] ile 1-1, düzenleme/iptalde bunlar üzerinden geri alınır)
  silindi: boolean,                  // soft delete
  silinmeTarihi: Timestamp | null,
  olusturanUid: string,
  olusturanAd: string,
  olusturmaTarihi: Timestamp,
  guncellenmeTarihi: Timestamp
}
```

- Eski sistemdeki `durum` (hiç okunmayan ölü alan) + `odendi`/`gizli`/`silindi` (3 bağımsız boolean, tutarsız kombinasyon riski) karmaşası tek anlamlı `durum` enum'u + ayrı `odemeDurumu` + `silindi` olarak sadeleştirildi. **`gizli` alanı tamamen kaldırıldı** (KESİNLEŞTİ 2026-09-15 — kullanım amacı belirsizdi, v1 kapsamı dışında, gerekirse sonra eklenir).
- **Gerekli composite index:** `(silindi ASC, teslimatTarihi ASC)`, `(musteriId ASC, teslimatTarihi DESC)`, `(olusturanUid ASC, teslimatTarihi DESC)` (yetkisiz kullanıcı yalnızca kendi siparişlerini görürken).

### 6.1 Sipariş → Veresiye Otomatik Entegrasyonu (KESİNLEŞTİ 2026-09-15)

Kullanıcı kararı: **her sipariş otomatik olarak müşterinin cari/veresiye hesabına yansır.**

- Sipariş oluşturulurken kullanıcı `odemeSekli` seçer (varsayılan `'veresiye'`).
- Sipariş kaydedilirken tek bir `writeBatch` içinde: (1) `siparis_orders` dokümanı yazılır, (2) `items[]` içindeki **her satır için ayrı bir `veresiye_kayitlar` dokümanı** oluşturulur (`girisYontemi:'siparis'`, `kaynakSiparisId:<siparişId>`, `durum: odemeSekli==='nakit' ? 'nakit' : 'veresiye'`), (3) `odemeSekli==='veresiye'` ise `musteriler.veresiyeBakiye` toplam tutar kadar `increment()` edilir. Oluşan kayıt ID'leri `siparis_orders.veresiyeKayitIdler`'a yazılır.
- Sipariş **düzenlenirse** (items/tutar/musteri değişirse): eski bağlı `veresiye_kayitlar` dokümanları `runTransaction` içinde silinip bakiye etkisi geri alınır, yeni items için yeniden oluşturulur — tam bir "sil ve yeniden yaz" senkronizasyonu (kısmi/diff güncelleme yapılmaz, basitlik ve tutarlılık için).
- Sipariş **`odemeDurumu:'odendi'` olarak işaretlenirse** ve `odemeSekli==='veresiye'` ise, bağlı tüm `veresiye_kayitlar` dokümanlarının `durum`'u `'odendi'`ye çevrilir (bakiyeden düşülür) — sipariş ve veresiye tarafı hep senkron kalır.
- Sipariş **iptal edilir/silinirse** (`durum:'iptal'` veya `silindi:true`): bağlı `veresiye_kayitlar` dokümanları silinir, bakiye etkisi geri alınır; `siparis_orders` dokümanının kendisi denetim izi için saklanır (soft delete/iptal durumu).
- Bu senkronizasyon mantığı tek bir paylaşılan fonksiyonda (`syncSiparisToVeresiye`) toplanır, hem oluşturma hem düzenleme hem iptal akışından çağrılır — kod tekrarını ve senkron kaymasını önler.

### `siparis_recurring_templates/{id}` (auto-id) — "Şablonlar"

```
{
  musteriId: string,
  musteriAdi: string,
  adres: string,
  not: string,
  items: [{ productId: string, adet: number }],   // fiyat kayıt anında products'tan taze çekilir
  gunler: number[],                   // 0=Pazar..6=Cumartesi
  bitisTarihi: string | null,
  aktif: boolean,
  sonOlusturulan: string | null,       // YYYY-MM-DD, aynı gün tekrar üretilmesin diye
  olusturmaTarihi: Timestamp
}
```

---

## 7. Veresiye & Cari modülü (`veresiye_*`)

Bu modül, kullanıcının verdiği detaylı arayüz spesifikasyonuna göre **4 ana sekme** üzerinden çalışır: **Özet, Günlük Giriş, Un Hesaplı Giriş, Giriş Şablonu.** Hepsi aşağıdaki koleksiyonlar üzerinde çalışır.

### `veresiye_kayitlar/{id}` (auto-id) — teslimat/borç satırları (tablodaki ana veri kaynağı)

```
{
  musteriId: string,                 // → musteriler/{id}
  musteriAdi: string,                // snapshot
  productId: string,                 // → products/{id}
  urunAdi: string,                   // snapshot (TÜR sütunu)
  adet: number,
  birimFiyat: number,                // kayıt anındaki fiyat, donmuş
  tutar: number,                     // adet * birimFiyat — SAKLANIR
  tarih: string,                     // YYYY-MM-DD
  durum: 'veresiye' | 'odendi' | 'nakit',   // bkz. not — KESİNLEŞTİ 2026-09-15
  girisYontemi: 'manuel' | 'un_hesabi' | 'siparis',   // bu satır Günlük Giriş'ten mi, Un Hesaplı Giriş'ten mi, yoksa Sipariş modülünden mi otomatik oluştu
  kaynakSiparisId: string | null,     // girisYontemi='siparis' ise → siparis_orders/{id}, bkz. §6.1
  olusturanUid: string,
  olusturmaTarihi: Timestamp,
  guncellenmeTarihi: Timestamp
}
```

> **`durum` alanının bakiyeye etkisi (KESİNLEŞTİ 2026-09-15):**
> - `veresiye`: ödenmedi, **bakiyeye + olarak işler**.
> - `nakit`: teslimat anında peşin tahsil edildi, bakiyeye hiç girmez (yalnızca rapor/denetim amaçlı satır).
> - `odendi`: başta `veresiye` girildi, sonradan bu spesifik satır ödendi olarak işaretlendi — bakiyeden düşülür (pratikte `nakit` ile aynı bakiye etkisi, raporlama amacıyla ayrı tutuluyor: "sonradan tahsil edilen" vs "hiç borçlanmayan").
> - Durum değişikliği (`veresiye`→`odendi` veya tutar/adet düzenleme) **her zaman `runTransaction` ile** eski tutarın bakiye etkisini geri alıp yenisini uygular (eski sistemin doğru çalışan CRUD deseni korunuyor).

### `veresiye_odemeler/{id}` (auto-id) — tahsilatlar (Özet sekmesindeki "Ödemeler" listesi)

```
{
  musteriId: string,
  musteriAdi: string,
  tutar: number,
  tarih: string,
  not: string,
  olusturanUid: string,
  olusturmaTarihi: Timestamp
}
```

### `veresiye_sablonlar/{id}` (auto-id) — "Giriş Şablonu" sekmesi

Tekrarlanan sabit müşteri siparişlerinin tek tıkla Günlük Giriş ekranına yüklenmesi için.

```
{
  musteriId: string,
  musteriAdi: string,
  kalemler: [{ productId: string, urunAdi: string, adet: number }],
  aktif: boolean,
  olusturmaTarihi: Timestamp
}
```

### `veresiye_unGirisleri/{id}` (auto-id) — "Un Hesaplı Giriş" sekmesindeki ham girişler

Her giriş, o günkü un/hammadde miktarını kaydeder; `musteriler/{id}.unHesabi.birikenGramaj` alanına eklenir. `birikenGramaj >= esikGramaj` olduğunda: kaç eşik aşıldıysa (`floor(birikenGramaj/esikGramaj)`) o kadar `adetPerEsik` ile çarpılıp tek bir `veresiye_kayitlar` satırı (`girisYontemi:'un_hesabi'`, `urunId: unHesabi.urunId`, `adet: kat*adetPerEsik`) oluşturulur, `birikenGramaj` kalan (mod) değere düşürülür.

```
{
  musteriId: string,
  musteriAdi: string,
  tarih: string,
  cuvalSayisi: number | null,
  gramaj: number,                    // cuvalSayisi * gramajPerCuval, ya da doğrudan gramaj girilebilir
  olusturanUid: string,
  olusturmaTarihi: Timestamp
}
```

- **Gerekli composite index (tüm veresiye koleksiyonları için ortak desen):** `(musteriId ASC, tarih DESC)` ve `(tarih ASC)` — eski sistemin "tüm koleksiyonu filtresiz çek" hatası burada tekrarlanmayacak; Özet sekmesindeki dönem filtresi (Bugün/Yarın/Bu Hafta/Bu Ay/Özel Aralık) ve müşteri filtresi Firestore sorgusuna (`where`+`orderBy`) yansıtılacak, client-side sadece son biçimlendirme yapılacak.

---

## 8. Okul modülü (`okul_*`)

### `okul_schools/{id}` (auto-id — eski slug-ID deseni terk edildi)

```
{
  ad: string,
  firmaId: string | null,            // → okul_firmalar/{id}
  musteriId: string | null,          // → musteriler/{id}, okulun bağımsız veresiye hesabı varsa
  lines: [
    { id: string, productId: string, urunAdi: string, adet: number, aktif: boolean, faturaHedefiId: string | null }
    // faturaHedefiId: null = doğrudan okula fatura, dolu ise o firmaId'ye fatura (eski hardcoded 'yeniceri'|'dogrudan' enum'u genelleştirildi)
  ],
  olusturmaTarihi: Timestamp,
  guncellenmeTarihi: Timestamp
}
```

- **Eski `gunler: number[]` (haftalık program) alanı kaldırıldı** — kodda hiç kullanılmayan ölü alandı, v1 kapsamı dışı.
- `lines[].id`: `crypto.randomUUID()` (eski `{schoolId}_l{index}_{timestamp36}` deseni yerine, gerçek benzersiz ID).

### `okul_firmalar/{id}` (auto-id)

```
{ ad: string, musteriId: string | null, olusturmaTarihi: Timestamp }
```

### `okul_orders/{id}` (auto-id — eski `{tarih}_{lineId}` deterministik ID deseni terk edildi)

Sadece **üretim planı**, mali kayıt değil. Eski tasarımın "aynı gün aynı hattın 2. teslimatı" belirsizliğini auto-id + composite index çözüyor.

```
{
  tarih: string,
  schoolId: string,
  lineId: string,
  productId: string,
  adet: number,
  kapandiMi: boolean
}
```

**Composite index:** `(tarih ASC, lineId ASC)` (miktar güncellerken tekil satırı bulmak için) ve `(tarih ASC, kapandiMi ASC)` (gün sonu kapanışında kapanmamış satırları çekmek için). Okul/firma bazlı gruplama, o tarihteki tüm siparişler tek sorguyla çekilip client-side yapılıyor.

### `okul_teslimatlar/{id}` (auto-id) — kapanışta donmuş, DEĞİŞMEZ mali kayıt

```
{
  tarih: string,
  schoolId: string,
  lineId: string,
  productId: string,
  urunAdi: string,                   // snapshot
  adet: number,
  birimFiyat: number,
  tutar: number,
  faturaHedefiId: string | null,     // kapanış anındaki donmuş kopya
  kapanisZamani: Timestamp,
  kapatanUid: string
}
```

**Composite index:** `(schoolId ASC, tarih DESC)`, `(tarih ASC)`.

> **Gün sonu kapanışı mantığı eski sistemden AYNEN korunuyor** (kullanıcının 2026-09-14 tarihli kararı, iyi tasarlanmış bir desen): `okul_orders` gün içinde serbestçe düzenlenebilir, tutar içermez. `closeDay(tarih, uid)` tek bir `writeBatch` ile o güne ait tüm siparişleri `okul_teslimatlar`'a donmuş kopya yazar ve `okul_orders` dokümanlarını `kapandiMi:true` ile kilitler. Ekstre/bakiye **yalnızca `okul_teslimatlar`'ı** sayar; kapanmamış günler "beklemede/tahmini" ayrı gösterilir.

### `okul_kapanislar/{tarih}` (doküman ID = tarih, gerçekten günde-1 olduğu için deterministik ID burada güvenli)

```
{ tarih: string, kapandi: boolean, kapanisZamani: Timestamp, kapatanUid: string, satirSayisi: number }
```

### `okul_payments/{id}` (auto-id)

```
{ hedefTipi: 'firma' | 'okul', hedefId: string, tutar: number, tarih: string, not: string, olusturanUid: string, olusturmaTarihi: Timestamp }
```

---

## 8.1 Günlük Veresiye modülü (`gunluk_*`) — 2026-10-23

Kasadan veresiye alan müşteriler için ana Veresiye'den **tamamen ayrı** defter. Ana Veresiye bakiyesine, Özet'ine ve Rapor'una hiç yansımaz. Ürünler ortak `products` katalogundan gelir (`modules` içinde `'gunluk'`). Erişim için `users.modules.gunluk` gerekir (admin her zaman erişir).

```
gunluk_musteriler/{id}: { ad, telefon, not, aktif, acilisBakiyesi, bakiye, portalSifre, olusturmaTarihi, guncellenmeTarihi }
  // bakiye = acilisBakiyesi + Σ(durum='veresiye' kayıt tutarı) − Σ(ödeme), increment() ile canlı tutulur
gunluk_kayitlar/{id}:   { musteriId, musteriAdi, productId, urunAdi, adet, birimFiyat, tutar, tarih, durum: 'veresiye'|'odendi', olusturanUid, olusturmaTarihi, guncellenmeTarihi }
gunluk_odemeler/{id}:   { musteriId, musteriAdi, tutar, tarih, not, olusturanUid, olusturmaTarihi }
```

- **Fiyat:** `products.gunlukFiyat` (isteğe bağlı) — Günlük Veresiye'de bu fiyat önerilir; boşsa `fiyat` kullanılır.
- **Portal:** müşteri `portal.html?kod={id}&tur=gunluk` + 6 haneli `portalSifre` ile kendi hareketlerini görür (`portalGiris` fonksiyonu `tur:'gunluk'` ile gunluk_* koleksiyonlarından okur).

**Gerekli composite index:** `gunluk_kayitlar (musteriId ASC, tarih DESC)`, `gunluk_odemeler (musteriId ASC, tarih DESC)`.

---

## 9. v1 Kapsamı Dışı Bırakılanlar (eski sistemde "tasarlandı ama hiç kodlanmadı")

- **`veresiye_portal` / `okul_portal`** (müşteri/okul kendi kendine parola ile ekstre görüntüleme): eski sistemde şema var ama hiçbir yazma/okuma kodu yok, kullanıcının yeni spesifikasyonunda da istenmiyor. **v1'de hiç yok.** İleride istenirse ayrı bir faz olarak (gerçek kimlik doğrulama ile, düz metin parola değil) eklenir.
- **`odendi` peşin-borç ile `veresiye_odemeler` arasındaki eski çakışma**: yeni `durum` enum'u (§7) ile tek modelde birleştirildi.

---

## 10. Firestore Security Rules — yaklaşım özeti

(Detaylı `firestore.rules` kodlama fazında yazılacak; burada ilkeler onaya sunuluyor.)

1. `request.auth != null` şartı her koleksiyon için taban kural — herkese açık okuma/yazma yok (§9 kararıyla `*_portal` da yok, tüm veri kimlik doğrulamalı).
2. `isAdmin()` her şeye tam erişir; `personel` erişimi `users/{uid}.modules` + `permissions` alanlarına göre taneli kontrol edilir (eski desen korunuyor).
3. Personel kendi `users/{uid}` dokümanını **yazamaz**.
4. **Alan bazlı sunucu-taraflı validasyon eklenir** (eski sistemde YOKTU — bilinen açık): `adet > 0`, `tutar >= 0`, `birimFiyat >= 0`, zorunlu string alanların boş olmaması, `durum`/`rol` gibi alanların yalnızca tanımlı enum değerlerini alması `request.resource.data` üzerinden `rules` içinde denetlenir.
5. `okul_teslimatlar`, `okul_kapanislar`, `veresiye_kayitlar`/`veresiye_odemeler` üzerinde `kapandiMi:true` sonrası veya finansal kapanış sonrası doğrudan istemci düzenlemesi engellenir (yalnızca admin, yalnızca `closeDay`/düzeltme akışı üzerinden).

---

## 11. Kesinleşen Kararlar (2026-09-15 onay turu)

Aşağıdaki noktalar kullanıcıyla netleştirildi, bu şemaya işlendi:

1. **Un Hesaplı Giriş dönüşüm mantığı** — çuval/gramaj birikimi → eşik aşılınca otomatik ekmek borcu tasarımı (§2, §7) onaylandı.
2. **`durum` (Veresiye/Ödendi/Nakit) alanının bakiyeye etkisi** (§7) onaylandı: yalnızca `veresiye` durumu bakiyeye borç olarak işler.
3. **Sipariş → Veresiye otomatik entegrasyonu** (§6.1) onaylandı: her sipariş otomatik cari hesaba yansır, `odemeSekli` alanıyla nakit/veresiye ayrımı yapılır.
4. **`gizli` alanının kaldırılması** (sipariş modülü) onaylandı — v1'de yok.
5. **Proje/dil kararları:** TypeScript kullanılacak; Firebase proje adı **`basakyeniyonetim`**.

Sipariş `durum` enum değerleri (`yeni/hazirlaniyor/teslim_edildi/iptal`) makul bir varsayılan olarak bu şemaya işlendi — kodlama sırasında fırın operasyonuna uymadığı görülürse kolayca değiştirilebilir (henüz veri yok, düşük maliyetli bir değişiklik).
