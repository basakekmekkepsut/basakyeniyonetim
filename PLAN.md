# Başak Ekmek Yönetim — PLAN.md

Sıfırdan yazılacak, tek ekrandan Sipariş + Veresiye/Cari + Okul modüllerini yöneten, mobil-öncelikli PWA yönetim uygulaması.

Bu doküman kod yazılmadan önce onaylanması istenen genel mimariyi tanımlar. Veri modeli için bkz. **FIRESTORE_SCHEMA.md** (aynı onay turunda incelenmeli — özellikle dosya sonundaki "Açık Kararlar" bölümü).

---

## 1. Genel Hedefler

- **Sıfır hata** önceliği: her modül bittiğinde tarayıcıda + mobil genişlikte (375–414px) manuel test edilip onaylandıktan sonra bir sonraki modüle geçilecek.
- **Tam entegrasyon:** Sipariş, Veresiye/Cari ve Okul modülleri ortak `musteriler` ve `products` koleksiyonlarını paylaşır; bir modülde girilen veri diğerlerinde tutarsızlık yaratmaz (bkz. §8).
- **Debug/placeholder veri UI'da asla görünmez** — boş durumlar (`0 kayıt`, `henüz sipariş yok` vb.) gerçek boş-state bileşenleriyle gösterilir, sahte/mock veri hiçbir ekrana sızmaz.
- **Sıfırdan kod:** Eski `basak-yonetim` projesi yalnızca iş mantığı/veri yapısı referansı olarak incelendi (4 ayrı analiz raporu + mevcut `FIRESTORE_SCHEMA.md`/`FRONTEND_ARCHITECTURE.md` dokümanları). Hiçbir dosya kopyalanmadı; bu plan o incelemenin sonucudur.
- **Yeni, ayrı Firebase projesi** — eski `basak-yonetim` projesiyle hiçbir kaynak paylaşılmaz (ayrı Auth kullanıcıları, ayrı Firestore, ayrı API anahtarları).

---

## 2. Teknoloji Yığını

| Katman | Seçim | Gerekçe |
|---|---|---|
| Framework | **React 18** | Eski sistem framework'süzdü (manuel `innerHTML` render + event rebind), bu XSS riski ve DOM sızıntısı (flatpickr instance temizlenmemesi) yaratıyordu (araştırma raporu §6). React'in otomatik escape + deklaratif render'ı bu bug sınıfını yapısal olarak ortadan kaldırır. |
| Build tool | **Vite 5+** | Eski sistemde zaten kanıtlanmış, hızlı, PWA plugin desteği iyi. |
| Stil | **Tailwind CSS** | Fırın temalı (kahve/krem/turuncu) tutarlı bir tasarım sistemini hızlı kurmak + mobil breakpoint'leri (`sm/md/lg`) doğrudan yönetmek için. |
| Backend | **Firebase v10+ (modüler SDK)** — Auth (email/şifre) + Firestore + Cloud Functions (Telegram bildirimi + kritik sunucu-taraflı işlemler için) | Eski sistemin auth modeli (custom claims yok, yetki `users/{uid}` dokümanında) iyi çalışıyordu, korunuyor. |
| Routing | **react-router-dom** (browser history, hash değil) | Eski sistemde route hiç yoktu, sonradan basit hash router eklenmişti; baştan düzgün routing = deep-link + sayfa yenileme dayanıklılığı. |
| Durum yönetimi | React Context + custom hooks (`useMusteriler`, `useVeresiyeKayitlar` vb.), her biri `onSnapshot` sarmalayan | Redux gibi ağır bir kütüphaneye gerek yok; Firestore zaten gerçek zamanlı senkron sağlıyor. |
| İkonlar | `lucide-react` | Hafif, tree-shakeable, kalem/çöp kutusu/+/- gibi tüm ikonlar mevcut. |
| Grafik | `recharts` | "Grafiksel Özet" kısayolu için (Özet sekmesi). |
| Tarih | `date-fns` (+ TR locale) | Hafif, dönem hesaplamaları (Bu Hafta/Bu Ay vb.) için yeterli; ayrı bir takvim popup kütüphanesi (native `<input type="date">` + Tailwind stilli özel range picker) kullanılacak. |
| PWA | `vite-plugin-pwa` (manifest + service worker) | Eski sistemde PWA iddiası vardı ama manifest/service worker hiç yazılmamıştı (araştırma raporu §6 madde 8) — bu sefer **en baştan** kuruluyor, sona bırakılmıyor. |
| Hosting | **Firebase Hosting** | Yeni proje Firebase'e taşınıyor; eski sistemin Netlify+Firebase hibrit kurulumu yerine tek platform tercih edildi (Cloud Functions zaten aynı projede, Hosting rewrite ile birlikte yönetimi sadeleştiriyor). |
| Ortam ayrımı | Vite `.env` (`VITE_FIREBASE_*`) + `.env.example` | Eski sistemde Firebase config kaynak kodda hardcoded'dı (dev/staging/prod ayrımı yoktu) — düzeltiliyor. |

---

## 3. Proje Klasör Yapısı

```
basakyeniyonetim/
  PLAN.md
  FIRESTORE_SCHEMA.md
  firestore.rules
  firestore.indexes.json
  functions/                      # Cloud Functions (telegram-notify, gerekirse validasyon triggerları)
  public/
    manifest.json, icons/, ...
  src/
    main.tsx, App.tsx
    lib/
      firebase.ts                 # env-var tabanlı config
      auth.ts, session.ts (useSession hook)
    theme/                        # tailwind renk paleti, ortak UI bileşenleri (Button, Card, Modal, BottomNav, TopNav)
    shared/
      hooks/                      # useMusteriler, useProducts, useActivityLog
      components/                 # MusteriSecici, UrunSecici, TarihAraligiSecici, DonemFiltre, DurumRozeti
    modules/
      siparis/
      veresiye/
        Ozet.tsx, GunlukGiris.tsx, UnHesapliGiris.tsx, GirisSablonu.tsx, data.ts, hooks.ts
      okul/
    App.routes.tsx
  package.json, vite.config.ts, tailwind.config.js, tsconfig.json
```

**KESİNLEŞTİ:** TypeScript kullanılacak — Firestore doküman tipleri `FIRESTORE_SCHEMA.md`'den doğrudan tip olarak tanımlanır, "sıfır hata" hedefine katkı sağlar.

---

## 4. Firebase Kurulumu

1. Yeni Firebase projesi oluşturulur — proje adı/ID: **`basakyeniyonetim`** (KESİNLEŞTİ).
2. Authentication → Email/Password etkinleştirilir.
3. Firestore → production modda, önce **kilitli** (deny-all) kurallarla başlanır, `firestore.rules` yazıldıkça açılır.
4. İlk admin kullanıcı, Firebase Console'dan manuel oluşturulur + karşılık gelen `users/{uid}` dokümanı admin script/console ile eklenir (uygulama içinde "ilk kullanıcı kaydı" akışı yok — güvenlik için admin her zaman elle açılır, eski sistemle aynı prensip).
5. Cloud Functions: `telegram-notify` (HTTPS callable, `TELEGRAM_BOT_TOKEN` ortam değişkeni) — eski sistemin doğru yaptığı "token istemciye asla gitmez" prensibi korunur.
6. Firebase Hosting bağlanır, `firebase.json` içinde SPA rewrite (`"rewrites": [{"source":"**","destination":"/index.html"}]`) tanımlanır.

---

## 5. Ortak Altyapı (tüm modüllerden önce kurulur)

### 5.1 Kimlik Doğrulama & Yetki
- Giriş ekranı: e-posta + şifre (eski sistemin sadeleştirilmiş, tek-yöntemli modeli korunuyor).
- `useSession()` hook: `onAuthStateChanged` + `users/{uid}` canlı dinleme, durum makinesi `loading | signed-out | signed-in | no-profile | error`.
- `hasModule(modul)`, `isAdmin()`, `canSeeMusteri(id)` yardımcıları — hem UI gating hem `firestore.rules` ile birebir aynı mantık (kod tekrarını azaltmak için mümkün olduğunca tek bir "yetki şeması" dosyasından iki tarafa da referans verilecek şekilde belgelenecek).
- Şifre değiştirme: düzgün bir modal (eski sistemdeki çıplak `window.prompt()` kaldırılıyor).

### 5.2 Tema — "Sıcak Fırın" Paleti
- Ana renkler: kahve tonları (koyu kahverengi header/nav), krem (arka plan/kart yüzeyleri), turuncu/amber (aksiyon butonları, aktif sekme, rozetler).
- Tailwind `tailwind.config.js` içinde `bakery` renk paleti tanımlanır (örn. `bakery-coffee-900/700/500`, `bakery-cream-50/100`, `bakery-amber-500/600`).
- Durum rozetleri: Veresiye=turuncu/kırmızımsı, Ödendi=yeşil, Nakit=mavi/gri — tek bir `<DurumRozeti>` bileşeninde merkezi tanımlanır.

### 5.3 Layout — Masaüstü/Mobil
- **Masaüstü/tablet:** üst yatay navigasyon (Sipariş / Veresiye / Okul + sağda kullanıcı menüsü).
- **Mobil (< 768px):** üst kısımda kompakt başlık, **alt sabit navigasyon çubuğu** (BottomNav) — 3 modül + gerekiyorsa "Hesabım". `env(safe-area-inset-bottom)` ile notch/gesture-bar güvenli alanı hesaba katılır.
- Her modül içindeki alt-sekmeler (örn. Veresiye'nin Özet/Günlük Giriş/Un Hesaplı Giriş/Giriş Şablonu) yatay kaydırılabilir bir sekme çubuğu olarak, mobilde de tek satırda dar aralıklarla sığacak şekilde tasarlanır (gerekirse yatay scroll).

### 5.4 Ortak Bileşenler
- `MusteriSecici`: arama+autocomplete, `musteriler` koleksiyonundan `moduller` alanına göre filtrelenmiş liste (eski sistemin "serbest metin" hatası tekrarlanmaz — her yerde gerçek `musteriId` seçilir).
- `UrunSecici`, `DonemFiltre` (Bugün/Yarın/Bu Hafta/Bu Ay/Özel Aralık — Veresiye Özet sekmesinde ve Sipariş Rapor'da ortak kullanılır), `TarihAraligiSecici`.
- `DurumRozeti`, `TutarGoster` (₺ formatlı), `BosDurum` (gerçek boş-state, "henüz kayıt yok" gibi — asla sahte veri değil).
- `ConfirmModal` (eski `window.confirm()` yerine), `Toast` (eski `window.alert()` yerine).

### 5.5 Ürün Modülü (paylaşılan)
- Tek CRUD ekranı (`shared/components/UrunlerView`), Sipariş/Veresiye/Okul ayarlarından erişilir — eski sistemin "products-view.js iki modülde ortak" iyi kararı korunuyor, üçüncü modül (veresiye) de dahil ediliyor.

### 5.6 Müşteri/Cari Modülü (yeni — eski sistemde eksikti)
- Eski sistemde müşteri CRUD'unun nerede yaşadığı belirsizdi (araştırma raporu). Yeni sistemde **birinci sınıf bir modül**: müşteri ekleme/düzenleme formu, `moduller[]` çoklu-seçim (bu müşteri hangi panellerde görünsün), veresiye/un hesabı alanları yalnızca `moduller` içinde 'veresiye' varsa gösterilir.

### 5.7 Aktivite Logu & Ayarlar
- Tek `activity_log` koleksiyonu, modül bazlı filtrelenmiş görünüm (bkz. FIRESTORE_SCHEMA.md §5).
- Ayarlar (admin-only): Telegram chat-id'leri, kullanıcı yönetimi (rol/izin), ürün yönetimi kısayolu.

---

## 6. Modül Planları

### 6.1 Sipariş Modülü

Ekranlar: **Siparişler** (liste+form), **Şablonlar**, **Rapor**, **Mesaj**, **Ayarlar** (admin).

- Sipariş formu: `MusteriSecici` ile zorunlu müşteri seçimi (adres otomatik dolar, elle değiştirilebilir), teslimat tarihi, dinamik ürün satırları (+ekle/-sil), toplam anlık hesaplanır ve `toplamTutar` olarak kaydedilir. **`odemeSekli` seçimi (Veresiye/Nakit)** — bu, siparişin otomatik olarak müşterinin cari hesabına nasıl yansıyacağını belirler (bkz. §7 madde 4, KESİNLEŞTİ: her sipariş otomatik veresiyeye yansır).
- Liste: tarih aralığı filtresi (varsayılan "Yarın"), müşteri arama, `durum` filtresi, sıralama seçenekleri. Kartlarda hızlı `durum`/`odemeDurumu` değiştirme, düzenle, kopyala (yeni sipariş formunu ön-doldur), sil (soft delete + admin için kalıcı sil). `odemeDurumu:'odendi'` işaretlemek, `odemeSekli:'veresiye'` olan siparişlerde bağlı veresiye kaydını da otomatik `odendi`'ye çevirir.
- Rapor: hazır dönem butonları + özel aralık, ürün bazında toplam adet/tutar dökümü — Firestore sorgusu `where(teslimatTarihi aralığı)` ile sunucu tarafında filtrelenir (eski sistemin "tüm koleksiyonu çek" hatası tekrarlanmaz).
- Şablonlar: haftanın günü checkbox'ları + bitiş tarihi; "bugün due" şablonlar üst banner'da gösterilir, tek tıkla siparişe dönüştürülür.
- Mesaj: seçilen tarihin sipariş özeti → WhatsApp `wa.me` linki veya Telegram (Cloud Function üzerinden) gönderimi.

### 6.2 Veresiye & Cari Modülü (detaylı spesifikasyon)

**Üst navigasyon:** Özet · Günlük Giriş · Un Hesaplı Giriş · Giriş Şablonu.

#### Özet
- Filtre alanı: `DonemFiltre` (Bugün/Yarın/Bu Hafta/Bu Ay/Özel Aralık) + müşteri filtresi (Tüm Müşteriler / spesifik cari).
- İşlem türü toggle: **Teslimatlar** (`veresiye_kayitlar`) ↔ **Ödemeler** (`veresiye_odemeler`) — seçime göre tablo veri kaynağı değişir.
- Tablo sütunları (Teslimatlar görünümünde): TARİH, MÜŞTERİ, TÜR, ADET, TUTAR (₺), DURUM (rozet). Her satırda kalem (düzenle) ve çöp kutusu (sil) ikonları — düzenleme/silme her zaman bakiyeyi `runTransaction` ile doğru şekilde geri alıp uygular.
- Kısayollar: "Yeni Kayıt" (hızlı tek-satır giriş modalı) ve "Grafiksel Özet" (seçili dönem için borç/tahsilat trend grafiği, `recharts`).
- Günlük Giriş, Un Hesaplı Giriş **ve Sipariş modülünden otomatik yansıyan** her kayıt bu tabloda ve ilgili müşterinin `veresiyeBakiye` alanında anında görünür — tek koleksiyon + gerçek zamanlı `onSnapshot`, ayrı bir senkronizasyon adımına gerek yok. Sipariş kaynaklı satırlar `girisYontemi:'siparis'` ile işaretlenir ve TÜR sütununda hangi siparişten geldiği (tıklanınca) görülebilir.

#### Günlük Giriş
- Grid: her `musteriler` (moduller içinde 'veresiye', `aktif:true`) için bir kart.
- Kart içeriği: müşteri adı, aktif ürünler için +/- adet steppers, "Ödendi" checkbox (işaretlenirse o kartın satırları `durum:'nakit'` ile kaydedilir, işaretsizse `durum:'veresiye'`).
- Alt kısımda sabit (sticky) **"Tümünü Kaydet"** butonu — yalnızca adet>0 olan kartlar için tek `writeBatch` ile `veresiye_kayitlar` dokümanları oluşturur + `musteriler.veresiyeBakiye` alanlarını `increment()` ile toplu günceller (eski sistemin "Hızlı Giriş" ekranındaki kanıtlanmış deseni).
- "Giriş Şablonu"ndan yüklenen varsayılan adetler, kart açıldığında ön-dolu gelir (elle değiştirilebilir).

#### Un Hesaplı Giriş
- Müşteri seçimi (yalnızca `unHesabi.aktif:true` olan müşteriler listelenir).
- Form: çuval sayısı veya doğrudan gramaj girişi → `veresiye_unGirisleri` dokümanı oluşturur, `musteriler.unHesabi.birikenGramaj` alanına eklenir.
- Eşik (`esikGramaj`) aşılırsa, aynı işlem içinde otomatik bir `veresiye_kayitlar` satırı (`girisYontemi:'un_hesabi'`, `urunId: unHesabi.urunId`, hesaplanan `adet`) oluşturulur ve `birikenGramaj` düşülür — kullanıcıya "eşik aşıldı, X adet ekmek borcu oluşturuldu" bildirimi gösterilir.
- **Bu ekranın tam iş mantığı FIRESTORE_SCHEMA.md §11 madde 1'de onayınıza sunuluyor** — kodlamaya bu onaydan sonra geçilecek.

#### Giriş Şablonu
- `veresiye_sablonlar` CRUD: müşteri + varsayılan ürün/adet kalemleri.
- Günlük Giriş ekranında "şablonu yükle" aksiyonu, ilgili müşterinin kartındaki adetleri şablon değerleriyle doldurur.

### 6.3 Okul Modülü

Ekranlar: **Üretim** (o günün ürün bazlı toplamı), **Sipariş** (firma bazlı gruplanmış okul-hat girişi), **Okullar** (CRUD, hat yönetimi), **Ürünler** (paylaşılan), **Ekstre** (Beklemede/Kesinleşmiş ayrımı + "Kapat" aksiyonu, admin), **Firmalar** (bakiye özeti + ödeme), **Mesaj**.

- Gün sonu kapanışı iş akışı (`closeDay`) eski sistemden **aynen korunuyor** (FIRESTORE_SCHEMA.md §8) — kanıtlanmış, doğru tasarlanmış bir finansal dondurma deseni.
- `faturaHedefiId` genellemesi sayesinde ikinci/üçüncü bir firma eklendiğinde kod değişikliği gerekmez (eski sistemin hardcoded `'yeniceri'|'dogrudan'` enum sınırlaması kaldırıldı).
- Haftalık program (`gunler`) özelliği v1'de yok (eski sistemde hiç kullanılmayan ölü alandı) — ihtiyaç doğarsa ayrı bir faz olarak eklenir.

---

## 7. Modüller Arası Entegrasyon & Veri Tutarlılığı

1. **Tek `musteriler` koleksiyonu:** Sipariş, Veresiye, Okul aynı müşteri kaydına `musteriId` ile bağlanır. Bir müşterinin adı/telefonu güncellenirse, geçmiş kayıtlardaki *snapshot* alanlar (`musteriAdi`) değişmez (denetim izi korunur) ama yeni kayıtlar güncel bilgiyi kullanır.
2. **Tek `products` koleksiyonu:** Üç modül de aynı ürünü referans eder; fiyat değişikliği yalnızca **yeni** kayıtları etkiler (geçmiş kayıtlar `birimFiyat`/`urunAdi` snapshot'ı sayesinde bozulmaz).
3. **Bakiye tutarlılığı:** `musteriler.veresiyeBakiye`'ye yazan **tek bir paylaşılan fonksiyon** (`shared/veresiye/bakiye.ts`) vardır; hem veresiye modülü (Günlük Giriş, Un Hesaplı Giriş, düzenleme/silme) hem de sipariş modülünün `syncSiparisToVeresiye` akışı (§6.1 FIRESTORE_SCHEMA.md) **bu ortak fonksiyon üzerinden** transaction/`increment()` yapar — hiçbir modül bakiye alanına doğrudan/kendi mantığıyla yazmaz. Okul modülünün kendi bağımsız bakiyesi (`okul_teslimatlar`−`okul_payments`, okul bazında) **ayrı** tutulur ve karıştırılmaz (eski sistemin YİBO özel durumunda kanıtlanan, bilinçli ayrım — bkz. araştırma raporu).
4. **Sipariş → Veresiye otomatik yansıma (KESİNLEŞTİ 2026-09-15):** Her sipariş otomatik olarak müşterinin cari hesabına yansır — sipariş formunda seçilen `odemeSekli` (Veresiye/Nakit) bunun nasıl işleneceğini belirler. Tam mekanik için bkz. FIRESTORE_SCHEMA.md §6.1.

---

## 8. Mobil/Responsive Kurallar

- Tüm ekranlar 375px genişlikten başlayarak test edilir (iPhone SE referans alt sınır).
- Tablolar mobilde yatay scroll konteynerine alınır **veya** kart görünümüne dönüşür (Veresiye tablosu gibi çok sütunlu tablolarda kart-görünüm tercih edilir — TARİH/MÜŞTERİ üstte, ADET/TUTAR/DURUM alt satırda).
- Dokunma hedefleri en az 44×44px (özellikle Günlük Giriş'teki +/- steppers).
- Sabit alt navigasyon + Günlük Giriş'in sabit "Tümünü Kaydet" butonu çakışmayacak şekilde z-index/padding planlanır.

---

## 9. PWA

- `manifest.json`: uygulama adı, fırın temalı ikon seti (192/512px + maskable), `theme_color`/`background_color` kahve/krem tonlarından.
- Service worker (`vite-plugin-pwa`, `injectManifest` veya `generateSW` — kodlama fazında karar verilecek): statik varlıklar için cache-first, Firestore trafiği için ağ öncelikli (zaten Firestore'un kendi `persistentLocalCache`'i offline okumayı sağlıyor).
- Install prompt: tarayıcı native `beforeinstallprompt` olayı yakalanıp uygun bir "Uygulamayı Yükle" butonu gösterilir (eski sistemde bu hiç yoktu).

---

## 10. Güvenlik

- Firestore Rules yaklaşımı FIRESTORE_SCHEMA.md §10'da özetlendi — alan bazlı validasyon eski sistemde eksikti, yeni sistemde ekleniyor.
- Telegram bot token'ı yalnızca Cloud Function ortam değişkeninde.
- Firebase config'teki `apiKey` public olması normaldir (Firestore rules asıl güvenlik katmanı) ama `.env` ile yönetilip repo'ya commit edilmeyecek (dev/prod ayrımı için).

---

## 11. Geliştirme Fazları (her fazın sonunda tarayıcı + mobil genişlik testi + onay)

1. **Faz 0 — İskelet:** Firebase projesi kurulumu, Vite+React+Tailwind+PWA iskeleti, auth ekranı, layout (top/bottom nav), tema paleti. *Test: giriş yapılabiliyor, boş layout mobilde/masaüstünde düzgün.*
2. **Faz 1 — Ortak Altyapı:** Müşteri modülü CRUD, Ürün modülü CRUD, Ayarlar (Telegram, kullanıcı yönetimi). *Test: müşteri/ürün eklenip düzenlenebiliyor, hiç placeholder veri yok.*
3. **Faz 2 — Sipariş Modülü:** tam CRUD + rapor + şablonlar + mesaj + veresiyeye otomatik yansıma (§6.1/§7 madde 4). *Test: gerçek bir sipariş uçtan uca girilip düzenlenip silinebiliyor, veresiye tablosunda ve bakiyede doğru şekilde göründüğü doğrulanıyor.*
4. **Faz 3 — Veresiye & Cari Modülü:** Özet, Günlük Giriş, Un Hesaplı Giriş, Giriş Şablonu. *Test: bakiye her senaryoda (ekle/düzenle/sil/toplu giriş/sipariş kaynaklı) doğru hesaplanıyor.*
5. **Faz 4 — Okul Modülü:** okullar/firmalar, günlük sipariş, gün sonu kapanışı, ekstre, ödemeler. *Test: kapanış sonrası kayıtların kilitlendiği, bakiyenin doğru hesaplandığı doğrulanıyor.*
6. **Faz 5 — Entegrasyon & Cilalama:** modüller arası tutarlılık senaryoları (§7), PWA install akışı, Telegram/WhatsApp mesajlaşma, tüm ekranlarda son mobil/masaüstü taraması. ✅ **Tamamlandı** (2026-09-15):
   - Ürün/müşteri silme artık aktif kullanım kontrolü yapıyor (şablonlar, okul hatları, un hesabı bağlantısı, açık bakiye) — Faz 1'den kalan TODO kapatıldı.
   - `functions/` altında gerçek bir Cloud Function (`telegramNotify`, 2nd-gen `onCall`, `TELEGRAM_BOT_TOKEN` Secret Manager'da) yazıldı ve emülatörde uçtan uca doğrulandı (auth kontrolü → secret okuma → gerçek Telegram API çağrısı → hata mesajının arayüze kadar ulaşması). Sipariş ve Okul modüllerinin Mesaj sekmelerine "Telegram'a Gönder" butonu eklendi.
   - PWA install akışı (`InstallPrompt` bileşeni, `beforeinstallprompt`) eklendi.
   - Route bazlı code-splitting (`React.lazy`) ile ana bundle ~1.2MB'tan ~735KB'a indi (recharts artık yalnızca Veresiye Özet'e gidildiğinde yükleniyor).
   - **Cloud Functions canlıya almak için gerekenler (sizin yapmanız gereken adımlar):** (1) Firebase projesi **Blaze (kullandıkça öde)** planına geçirilmeli — Spark planında Cloud Functions deploy edilemez; (2) `firebase functions:secrets:set TELEGRAM_BOT_TOKEN` ile gerçek bot token'ı girilmeli; (3) `firebase deploy --only functions` ile deploy edilmeli. Deploy edilene kadar "Telegram'a Gönder" butonu tıklandığında bağlantı hatası verir — WhatsApp paylaşımı bundan bağımsız, her zaman çalışır.

---

## 12. Onay Durumu (2026-09-15)

Tüm mimari kararlar kesinleşti (bkz. FIRESTORE_SCHEMA.md §11): Un Hesaplı Giriş mantığı, Veresiye `durum` alanının bakiyeye etkisi, Sipariş→Veresiye otomatik entegrasyonu, `gizli` alanının kaldırılması, TypeScript, Firebase proje adı (`basakyeniyonetim`). Sipariş `durum` enum değerleri makul bir varsayılan olarak belirlendi, kodlama sırasında düşük maliyetle değiştirilebilir.

**Faz 0-5 tamamlandı — uygulama üç modülüyle (Sipariş, Veresiye, Okul) uçtan uca çalışır durumda.**
