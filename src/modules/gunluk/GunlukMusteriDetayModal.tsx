import { useMemo, useState } from 'react'
import { Copy, HandCoins, KeyRound, Pencil, Phone, Plus, Share2, X } from 'lucide-react'
import {
  useGunlukKayitlar,
  useGunlukOdemeler,
  gunlukKayitlarEkle,
  gunlukOdemeEkle,
  gunlukPortalSifreYenile,
  type GunlukKayitFormVerisi
} from './data'
import GunlukKayitFormModal from './GunlukKayitFormModal'
import GunlukOdemeFormModal from './GunlukOdemeFormModal'
import { formatTutar } from '../../shared/TutarGoster'
import { gunlukPortalLinki, gunlukPortalMesajOlustur } from '../../shared/musteriYardimci'
import { useSession } from '../../lib/session'
import { useToast } from '../../shared/Toast'
import type { GunlukMusteri, GunlukOdemeFormVerisi } from '../../lib/types'

interface Props {
  musteri: GunlukMusteri
  onDuzenle: () => void
  onKapat: () => void
}

interface Hareket {
  anahtar: string
  tarih: string
  aciklama: string
  borc: number // bakiyeyi artıran (veresiye)
  alacak: number // bakiyeyi azaltan (ödeme)
  odendi: boolean // kasada peşin ödenmiş — bakiyeye etkisiz
}

/** Müşterinin hesap dökümü (yürüyen bakiyeli) + hızlı "Veresiye Ekle" / "Ödeme Al". */
export default function GunlukMusteriDetayModal({ musteri: m, onDuzenle, onKapat }: Props) {
  const session = useSession()
  const toast = useToast()
  const [kayitFormAcik, setKayitFormAcik] = useState(false)
  const [odemeFormAcik, setOdemeFormAcik] = useState(false)
  const [sifreYenileniyor, setSifreYenileniyor] = useState(false)

  const filtre = useMemo(() => ({ baslangic: null, bitis: null, musteriId: m.id }), [m.id])
  const { kayitlar, yukleniyor: kayitYukleniyor } = useGunlukKayitlar(filtre)
  const { odemeler, yukleniyor: odemeYukleniyor } = useGunlukOdemeler(filtre)

  // En eskiden yeniye yürüyen bakiye hesaplanır, sonra yeniden eskiye gösterilir.
  const satirlar = useMemo(() => {
    const hareketler: Hareket[] = [
      ...kayitlar.map((k) => ({
        anahtar: `k_${k.id}`,
        tarih: k.tarih,
        aciklama: `${k.adet}× ${k.urunAdi}`,
        borc: k.durum === 'veresiye' ? k.tutar : 0,
        alacak: 0,
        odendi: k.durum === 'odendi'
      })),
      ...odemeler.map((o) => ({
        anahtar: `o_${o.id}`,
        tarih: o.tarih,
        aciklama: o.not ? `Ödeme · ${o.not}` : 'Ödeme',
        borc: 0,
        alacak: o.tutar,
        odendi: false
      }))
    ].sort((a, b) => a.tarih.localeCompare(b.tarih))

    let bakiye = m.acilisBakiyesi
    const sonuc = hareketler.map((h) => {
      bakiye += h.borc - h.alacak
      return { ...h, bakiye }
    })
    return sonuc.reverse()
  }, [kayitlar, odemeler, m.acilisBakiyesi])

  if (session.status !== 'signed-in') return null
  const kullanici = { uid: session.user.uid }
  const yukleniyor = kayitYukleniyor || odemeYukleniyor

  async function handleKayitKaydet(veri: GunlukKayitFormVerisi) {
    await gunlukKayitlarEkle(veri, kullanici)
    toast.basari('Kayıt eklendi.')
  }

  async function portalSifreYenile() {
    setSifreYenileniyor(true)
    try {
      await gunlukPortalSifreYenile(m.id)
      toast.basari(m.portalSifre ? 'Portal şifresi yenilendi — eski link artık çalışmaz.' : 'Portal şifresi oluşturuldu.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Şifre yenilenemedi.')
    } finally {
      setSifreYenileniyor(false)
    }
  }

  function portalWhatsappGonder() {
    const mesaj = gunlukPortalMesajOlustur(m)
    if (!mesaj) return toast.hata('Bu müşterinin portal şifresi yok.')
    const numara = m.telefon.replace(/\D/g, '')
    window.open(`https://wa.me/${numara}?text=${encodeURIComponent(mesaj)}`, '_blank')
  }

  async function portalKopyala() {
    const mesaj = gunlukPortalMesajOlustur(m)
    if (!mesaj) return toast.hata('Bu müşterinin portal şifresi yok.')
    try {
      await navigator.clipboard.writeText(mesaj)
      toast.basari('Link ve şifre kopyalandı.')
    } catch {
      toast.hata('Kopyalanamadı.')
    }
  }

  async function handleOdemeKaydet(veri: GunlukOdemeFormVerisi) {
    await gunlukOdemeEkle(veri, kullanici)
    toast.basari('Ödeme eklendi.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bakery-coffee-900/40 backdrop-blur-sm animate-fade-in md:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bakery-surface shadow-elevated animate-slide-up md:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-bakery-cream-100 bg-bakery-surface/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-bakery-ink-900">{m.ad}</h3>
              {!m.aktif && (
                <span className="rounded-full bg-bakery-cream-100 px-2 py-0.5 text-xs text-bakery-ink-500">Pasif</span>
              )}
            </div>
            {m.telefon && (
              <a href={`tel:${m.telefon}`} className="mt-0.5 flex items-center gap-1 text-sm text-bakery-ink-500">
                <Phone size={13} />
                {m.telefon}
              </a>
            )}
            {m.not && <p className="mt-0.5 text-sm text-bakery-ink-500">{m.not}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={onDuzenle} className="rounded-full p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100" aria-label="Düzenle">
              <Pencil size={18} />
            </button>
            <button onClick={onKapat} className="rounded-full p-1.5 text-bakery-ink-400 hover:bg-bakery-cream-100" aria-label="Kapat">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center justify-between rounded-xl bg-bakery-cream-50 px-4 py-3">
            <span className="text-sm text-bakery-ink-600">Güncel Bakiye</span>
            <span className={`text-lg font-bold ${m.bakiye > 0 ? 'text-bakery-danger' : 'text-bakery-success'}`}>
              {formatTutar(m.bakiye)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setKayitFormAcik(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500"
            >
              <Plus size={16} />
              Veresiye Ekle
            </button>
            <button
              onClick={() => setOdemeFormAcik(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-bakery-success px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <HandCoins size={16} />
              Ödeme Al
            </button>
          </div>

          <div className="rounded-xl border border-bakery-cream-100 px-4 py-3">
            <p className="text-sm font-medium text-bakery-ink-800">Müşteri Portalı</p>
            <p className="mt-0.5 text-xs text-bakery-ink-500">Müşteri bu link ve şifreyle ne aldığını ve bakiyesini görebilir.</p>
            {m.portalSifre ? (
              <>
                <p className="mt-2 break-all text-xs text-bakery-ink-600">{gunlukPortalLinki(m.id)}</p>
                <p className="mt-1 text-sm text-bakery-ink-800">
                  Şifre: <strong className="font-mono tracking-wider">{m.portalSifre}</strong>
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-bakery-ink-500">Henüz portal şifresi yok.</p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {m.portalSifre && m.telefon && (
                <button
                  onClick={portalWhatsappGonder}
                  className="flex items-center gap-1 rounded-full bg-green-600/10 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-600/20"
                >
                  <Share2 size={12} />
                  WhatsApp’tan Gönder
                </button>
              )}
              {m.portalSifre && (
                <button
                  onClick={portalKopyala}
                  className="flex items-center gap-1 rounded-full bg-bakery-cream-100 px-2.5 py-1 text-xs font-medium text-bakery-ink-700 hover:bg-bakery-cream-200"
                >
                  <Copy size={12} />
                  Kopyala
                </button>
              )}
              <button
                onClick={portalSifreYenile}
                disabled={sifreYenileniyor}
                className="flex items-center gap-1 rounded-full bg-bakery-cream-100 px-2.5 py-1 text-xs font-medium text-bakery-ink-700 hover:bg-bakery-cream-200 disabled:opacity-60"
              >
                <KeyRound size={12} />
                {m.portalSifre ? 'Şifreyi Yenile' : 'Şifre Oluştur'}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-bakery-ink-800">Hesap Dökümü</p>
            {yukleniyor ? (
              <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
            ) : satirlar.length === 0 ? (
              <p className="text-sm text-bakery-ink-500">Henüz hareket yok.</p>
            ) : (
              <div className="divide-y divide-bakery-cream-100 rounded-xl border border-bakery-cream-100">
                {satirlar.map((s) => (
                  <div key={s.anahtar} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-bakery-ink-800">{s.aciklama}</p>
                      <p className="text-xs text-bakery-ink-400">
                        {s.tarih}
                        {s.odendi && ' · peşin ödendi'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-medium ${
                        s.alacak > 0 ? 'text-bakery-success' : s.odendi ? 'text-bakery-ink-400' : 'text-bakery-danger'
                      }`}
                    >
                      {s.alacak > 0 ? `−${formatTutar(s.alacak)}` : s.borc > 0 ? `+${formatTutar(s.borc)}` : '—'}
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs text-bakery-ink-500">{formatTutar(s.bakiye)}</span>
                  </div>
                ))}
                {m.acilisBakiyesi !== 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm">
                    <p className="flex-1 text-bakery-ink-500">Geçmiş bakiye</p>
                    <span className="w-24 shrink-0 text-right text-xs text-bakery-ink-500">{formatTutar(m.acilisBakiyesi)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {kayitFormAcik && (
        <GunlukKayitFormModal
          varsayilanMusteri={{ id: m.id, ad: m.ad }}
          onKaydet={handleKayitKaydet}
          onKapat={() => setKayitFormAcik(false)}
        />
      )}
      {odemeFormAcik && (
        <GunlukOdemeFormModal
          varsayilanMusteri={{ id: m.id, ad: m.ad }}
          onKaydet={handleOdemeKaydet}
          onKapat={() => setOdemeFormAcik(false)}
        />
      )}
    </div>
  )
}
