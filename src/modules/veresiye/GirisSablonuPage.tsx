import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import {
  sablonSatirlariniCikar,
  sablonSatiriAktifDegistir,
  sablonSatiriEkle,
  sablonSatiriSil,
  sablonSatiriSiraDegistir,
  useSonrakiSira,
  useVeresiyeSablonlar,
  type SablonSatiri
} from './sablonData'
import { useUrunler } from '../urunler/data'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import MusteriSecici from '../../shared/MusteriSecici'
import { useToast } from '../../shared/Toast'

export default function GirisSablonuPage() {
  const { sablonlar, yukleniyor, hata } = useVeresiyeSablonlar()
  const { urunler } = useUrunler()
  const toast = useToast()

  // NOT: Giriş Şablonu ve Günlük Giriş bilerek kişi bazlı müşteri kısıtlamasına
  // TABİ DEĞİL — personel ekmek girişini hangi müşteri için olursa olsun
  // yapabilmeli. Kısıtlama yalnızca Özet'teki geçmiş/bakiye görünümünde uygulanıyor
  // (bkz. OzetPage.tsx) — "girebilme" ile "bilgiye erişebilme" kasıtlı olarak ayrıldı.
  const satirlar = useMemo(() => sablonSatirlariniCikar(sablonlar), [sablonlar])
  const sonrakiSira = useSonrakiSira(sablonlar)
  const veresiyeUrunleri = useMemo(() => urunler.filter((u) => u.aktif && u.modules.includes('veresiye')), [urunler])

  const [yeniMusteriId, setYeniMusteriId] = useState('')
  const [yeniMusteriAdi, setYeniMusteriAdi] = useState('')
  const [yeniProductId, setYeniProductId] = useState('')
  const [ekleniyor, setEkleniyor] = useState(false)
  const [silinecek, setSilinecek] = useState<SablonSatiri | undefined>()

  async function handleEkle() {
    if (!yeniMusteriId) return toast.hata('Müşteri seçmelisiniz.')
    if (!yeniProductId) return toast.hata('Ekmek türü seçmelisiniz.')
    const urun = veresiyeUrunleri.find((u) => u.id === yeniProductId)
    if (!urun) return
    setEkleniyor(true)
    try {
      await sablonSatiriEkle(sablonlar, yeniMusteriId, yeniMusteriAdi, urun.id, urun.ad, sonrakiSira)
      toast.basari('Satır eklendi.')
      setYeniProductId('')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Eklenemedi.')
    } finally {
      setEkleniyor(false)
    }
  }

  async function handleAktifDegistir(satir: SablonSatiri, aktif: boolean) {
    try {
      await sablonSatiriAktifDegistir(sablonlar, satir.sablonId, satir.kalemIndex, aktif)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Güncellenemedi.')
    }
  }

  async function handleSiraDegistir(index: number, yon: -1 | 1) {
    const digeri = satirlar[index + yon]
    if (!digeri) return
    try {
      await sablonSatiriSiraDegistir(sablonlar, satirlar[index], digeri)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Sıra değiştirilemedi.')
    }
  }

  async function handleSil() {
    if (!silinecek) return
    try {
      await sablonSatiriSil(sablonlar, silinecek.sablonId, silinecek.kalemIndex)
      toast.basari('Satır silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setSilinecek(undefined)
    }
  }

  if (hata) return <p className="rounded-lg bg-bakery-danger/10 px-4 py-3 text-sm text-bakery-danger">{hata}</p>

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-bakery-ink-900">Giriş Şablonu</h2>
        <p className="mt-1 text-sm text-bakery-ink-500">
          Hangi müşterinin hangi ekmeği düzenli aldığını burada bir kere ayarla — Günlük Giriş ekranında her gün sadece adetleri
          gireceksin, müşteri/ürün seçmene gerek kalmayacak. Bir müşteri geçici olarak almıyorsa satırı silmeye gerek yok, tikini
          kaldır (pasif yap), tekrar aldığında tekrar işaretlersin. Bir müşterinin TÜM satırlarını pasif yaparsan, o müşteri
          Günlük Giriş ekranından tamamen kaybolur. Bir okulun veresiye hesabı olarak bağlı müşteriler (Okul &gt; Okullar'da
          seçilenler) zaten otomatik olarak Günlük Giriş'te görünmez — burada şablon eklemenize gerek yok, onların kayıtları
          Okul &gt; Ekstre'deki "Günü Kapat" ile gelir.
        </p>
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : satirlar.length === 0 ? (
        <BosDurum baslik="Henüz giriş şablonu yok" aciklama="Aşağıdaki formdan bir satır ekleyerek başlayın." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-bakery-surface shadow-soft">
          <div className="hidden items-center gap-3 border-b border-bakery-cream-100 px-4 py-2 text-xs font-medium uppercase tracking-wide text-bakery-ink-400 sm:flex">
            <span className="w-14 shrink-0">Durum</span>
            <span className="flex-1">Müşteri</span>
            <span className="flex-1">Ekmek Türü</span>
            <span className="w-24 shrink-0 text-right">İşlem</span>
          </div>
          <div className="divide-y divide-bakery-cream-100">
            {satirlar.map((s, i) => (
              <div key={`${s.sablonId}-${s.kalemIndex}`} className="flex items-center gap-3 px-4 py-2">
                <label className="flex w-14 shrink-0 items-center gap-1.5">
                  <input type="checkbox" checked={s.aktif} onChange={(e) => handleAktifDegistir(s, e.target.checked)} />
                  <span className={`hidden text-xs sm:inline ${s.aktif ? 'text-bakery-success' : 'text-bakery-ink-400'}`}>
                    {s.aktif ? 'Aktif' : 'Pasif'}
                  </span>
                </label>
                <span className={`flex-1 truncate text-sm font-medium ${s.aktif ? 'text-bakery-ink-900' : 'text-bakery-ink-400'}`}>
                  {s.musteriAdi}
                </span>
                <span className={`flex-1 truncate text-sm ${s.aktif ? 'text-bakery-ink-600' : 'text-bakery-ink-300'}`}>
                  {s.urunAdi}
                </span>
                <div className="flex w-24 shrink-0 items-center justify-end gap-0.5">
                  <button
                    onClick={() => handleSiraDegistir(i, -1)}
                    disabled={i === 0}
                    className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100 disabled:opacity-30"
                    aria-label="Yukarı taşı"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => handleSiraDegistir(i, 1)}
                    disabled={i === satirlar.length - 1}
                    className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100 disabled:opacity-30"
                    aria-label="Aşağı taşı"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    onClick={() => setSilinecek(s)}
                    className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                    aria-label="Satırı sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-bakery-surface p-4 shadow-soft">
        <h3 className="mb-3 text-sm font-semibold text-bakery-ink-900">Satır Ekle</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-medium text-bakery-ink-500">Müşteri</label>
            <MusteriSecici
              modul="veresiye"
              seciliMusteriId={yeniMusteriId || null}
              onSec={(m) => {
                setYeniMusteriId(m.id)
                setYeniMusteriAdi(m.ad)
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-bakery-ink-500">Ekmek Türü</label>
            <select
              value={yeniProductId}
              onChange={(e) => setYeniProductId(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 text-sm outline-none focus:border-bakery-amber-500"
            >
              <option value="">Ürün seçin…</option>
              {veresiyeUrunleri.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.ad}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleEkle}
            disabled={ekleniyor}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-bakery-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500 disabled:opacity-60 sm:mt-5"
          >
            <Plus size={16} />
            Ekle
          </button>
        </div>
      </div>

      {silinecek && (
        <ConfirmModal
          baslik="Satırı sil"
          mesaj={`"${silinecek.musteriAdi} — ${silinecek.urunAdi}" satırını silmek istediğinize emin misiniz?`}
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleSil}
          onVazgec={() => setSilinecek(undefined)}
        />
      )}
    </div>
  )
}
