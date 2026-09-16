import { useState } from 'react'
import { CalendarPlus, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import {
  useSablonlar,
  sablonEkle,
  sablonGuncelle,
  sablonSil,
  sablonBugunDueMu,
  sablondanSiparisOlustur,
  sablondanTopluPlanOlustur
} from './sablonData'
import { useUrunler } from '../urunler/data'
import SablonFormModal from './SablonFormModal'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import { useToast } from '../../shared/Toast'
import { useSession } from '../../lib/session'
import type { SiparisSablonu, SiparisSablonuFormVerisi } from '../../lib/types'

const GUN_ETIKETLERI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function SablonlarPage() {
  const { sablonlar, yukleniyor, hata } = useSablonlar()
  const { urunler } = useUrunler()
  const session = useSession()
  const toast = useToast()
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<SiparisSablonu | undefined>()
  const [silinecek, setSilinecek] = useState<SiparisSablonu | undefined>()
  const [topluOnay, setTopluOnay] = useState<SiparisSablonu | undefined>()
  const [topluIsleniyor, setTopluIsleniyor] = useState(false)

  const bugun = bugunStr()
  const dueSablonlar = sablonlar.filter((s) => sablonBugunDueMu(s, bugun))

  async function handleKaydet(veri: SiparisSablonuFormVerisi) {
    if (duzenlenen) {
      await sablonGuncelle(duzenlenen.id, veri)
      toast.basari('Şablon güncellendi.')
    } else {
      await sablonEkle(veri)
      toast.basari('Şablon eklendi.')
    }
  }

  async function handleOlustur(sablon: SiparisSablonu) {
    if (session.status !== 'signed-in') return
    try {
      await sablondanSiparisOlustur(sablon, bugun, urunler, { uid: session.user.uid, ad: session.profile.ad })
      toast.basari(`${sablon.musteriAdi} için bugünün siparişi oluşturuldu.`)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Sipariş oluşturulamadı.')
    }
  }

  async function handleTopluOlustur() {
    if (!topluOnay || session.status !== 'signed-in') return
    setTopluIsleniyor(true)
    try {
      const sayi = await sablondanTopluPlanOlustur(topluOnay, urunler, { uid: session.user.uid, ad: session.profile.ad })
      toast.basari(
        sayi > 0
          ? `${sayi} planlanan sipariş oluşturuldu. Teslimat günleri geldikçe otomatik olarak veresiyeye yansıyacak.`
          : 'Zaten güncel — üretilecek yeni tarih kalmamış.'
      )
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Oluşturulamadı.')
    } finally {
      setTopluIsleniyor(false)
      setTopluOnay(undefined)
    }
  }

  async function handleSil() {
    if (!silinecek) return
    try {
      await sablonSil(silinecek.id)
      toast.basari('Şablon silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setSilinecek(undefined)
    }
  }

  if (hata) return <p className="rounded-lg bg-bakery-danger/10 px-4 py-3 text-sm text-bakery-danger">{hata}</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-bakery-ink-900">Şablonlar</h2>
        <button
          onClick={() => {
            setDuzenlenen(undefined)
            setFormAcik(true)
          }}
          className="flex items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500"
        >
          <Plus size={16} />
          Yeni Şablon
        </button>
      </div>

      {dueSablonlar.length > 0 && (
        <div className="rounded-lg bg-bakery-amber-500/10 px-4 py-3">
          <p className="mb-2 text-sm font-medium text-bakery-amber-600">
            Bugün için {dueSablonlar.length} şablonun siparişi henüz oluşturulmadı:
          </p>
          <div className="flex flex-wrap gap-2">
            {dueSablonlar.map((s) => (
              <button
                key={s.id}
                onClick={() => handleOlustur(s)}
                className="flex items-center gap-1.5 rounded-full bg-bakery-surface px-3 py-1.5 text-sm font-medium text-bakery-ink-700 shadow-sm hover:bg-bakery-cream-50"
              >
                <Zap size={14} className="text-bakery-amber-500" />
                {s.musteriAdi}
              </button>
            ))}
          </div>
        </div>
      )}

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : sablonlar.length === 0 ? (
        <BosDurum baslik="Henüz şablon eklenmedi" aciklama="Düzenli sipariş veren müşteriler için şablon oluşturursanız, sipariş girişi tek tıkla yapılabilir." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sablonlar.map((s) => (
            <div key={s.id} className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-medium text-bakery-ink-900">{s.musteriAdi}</p>
                {!s.aktif && <span className="rounded-full bg-bakery-cream-100 px-2 py-0.5 text-xs text-bakery-ink-500">Pasif</span>}
              </div>
              <div className="mb-2 flex flex-wrap gap-1">
                {GUN_ETIKETLERI.map((etiket, g) => (
                  <span
                    key={g}
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      s.gunler.includes(g) ? 'bg-bakery-amber-500/15 text-bakery-amber-600' : 'text-bakery-ink-300'
                    }`}
                  >
                    {etiket}
                  </span>
                ))}
              </div>
              <ul className="mb-3 space-y-0.5 text-sm text-bakery-ink-600">
                {s.items.map((it, i) => {
                  const urun = urunler.find((u) => u.id === it.productId)
                  return (
                    <li key={i}>
                      {it.adet}× {urun?.ad ?? '—'}
                    </li>
                  )
                })}
              </ul>
              {s.bitisTarihi && <p className="mb-1 text-xs text-bakery-ink-400">Bitiş: {s.bitisTarihi}</p>}
              {s.planlananSonTarih && (
                <p className="mb-2 text-xs text-bakery-ink-400">Planlanan siparişler: {s.planlananSonTarih}'e kadar üretildi</p>
              )}
              <div className="flex items-center justify-between border-t border-bakery-cream-100 pt-2">
                <button
                  onClick={() => setTopluOnay(s)}
                  disabled={!s.aktif}
                  className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-500/20 disabled:opacity-50"
                >
                  <CalendarPlus size={13} />
                  İleriye Dönük Oluştur
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setDuzenlenen(s)
                      setFormAcik(true)
                    }}
                    className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                    aria-label="Düzenle"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setSilinecek(s)}
                    className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                    aria-label="Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formAcik && <SablonFormModal mevcut={duzenlenen} onKaydet={handleKaydet} onKapat={() => setFormAcik(false)} />}

      {silinecek && (
        <ConfirmModal
          baslik="Şablonu sil"
          mesaj={`"${silinecek.musteriAdi}" şablonunu silmek istediğinize emin misiniz?`}
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleSil}
          onVazgec={() => setSilinecek(undefined)}
        />
      )}

      {topluOnay && (
        <ConfirmModal
          baslik="İleriye Dönük Oluştur"
          mesaj={`"${topluOnay.musteriAdi}" için ${
            topluOnay.bitisTarihi ? topluOnay.bitisTarihi + ' tarihine' : 'bugünden itibaren 1 yıl ileriye'
          } kadar her hafta tekrarlayan siparişler önceden oluşturulacak. Bu siparişler listede "Planlandı" olarak görünür ama veresiye bakiyesine hemen yansımaz — her biri kendi teslimat günü geldiğinde otomatik olarak veresiyeye işlenir.`}
          onayEtiketi={topluIsleniyor ? 'Oluşturuluyor…' : 'Oluştur'}
          onOnayla={handleTopluOlustur}
          onVazgec={() => setTopluOnay(undefined)}
        />
      )}
    </div>
  )
}
