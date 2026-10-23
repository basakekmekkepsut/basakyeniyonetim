import { useMemo, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useGunlukMusteriler, gunlukMusteriEkle, gunlukMusteriGuncelle, gunlukMusteriSil } from './data'
import GunlukMusteriFormModal from './GunlukMusteriFormModal'
import GunlukMusteriDetayModal from './GunlukMusteriDetayModal'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import { formatTutar } from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { isAdmin, useSession } from '../../lib/session'
import type { GunlukMusteri, GunlukMusteriGirisi } from '../../lib/types'

export default function GunlukMusterilerPage() {
  const session = useSession()
  const toast = useToast()
  const { musteriler, yukleniyor, hata } = useGunlukMusteriler()
  const [arama, setArama] = useState('')
  const [pasifleriGoster, setPasifleriGoster] = useState(false)
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<GunlukMusteri | undefined>()
  const [gosterilenId, setGosterilenId] = useState<string | null>(null)
  const [silinecek, setSilinecek] = useState<GunlukMusteri | undefined>()

  const admin = session.status === 'signed-in' && isAdmin(session.profile)
  // Detay açıkken bakiye canlı güncellensin diye nesne değil id tutulur.
  const gosterilen = musteriler.find((m) => m.id === gosterilenId)

  const filtrelenmis = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    return musteriler.filter((m) => {
      if (!pasifleriGoster && !m.aktif) return false
      if (!q) return true
      return m.ad.toLocaleLowerCase('tr-TR').includes(q) || m.telefon.includes(q)
    })
  }, [musteriler, arama, pasifleriGoster])

  const toplamAcikBakiye = musteriler.reduce((t, m) => t + (m.bakiye > 0 ? m.bakiye : 0), 0)

  async function handleKaydet(girisi: GunlukMusteriGirisi) {
    if (duzenlenen) {
      await gunlukMusteriGuncelle(duzenlenen.id, girisi)
      toast.basari('Müşteri güncellendi.')
    } else {
      await gunlukMusteriEkle(girisi)
      toast.basari('Müşteri eklendi.')
    }
  }

  async function handleSil() {
    if (!silinecek) return
    try {
      await gunlukMusteriSil(silinecek)
      toast.basari('Müşteri silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setSilinecek(undefined)
    }
  }

  if (hata) {
    return <p className="rounded-lg bg-bakery-danger/10 px-4 py-3 text-sm text-bakery-danger">{hata}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bakery-ink-400" />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Ad veya telefon ara…"
              className="w-full rounded-xl border border-bakery-cream-200 bg-bakery-surface py-2 pl-9 pr-3 text-sm shadow-soft outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>
          <button
            onClick={() => {
              setDuzenlenen(undefined)
              setFormAcik(true)
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500"
          >
            <Plus size={16} />
            Yeni Müşteri
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-1.5 text-bakery-ink-600">
            <input type="checkbox" checked={pasifleriGoster} onChange={(e) => setPasifleriGoster(e.target.checked)} />
            Pasifleri göster
          </label>
          <span className="text-bakery-ink-600">
            Toplam açık: <span className="font-semibold text-bakery-danger">{formatTutar(toplamAcikBakiye)}</span>
          </span>
        </div>
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : filtrelenmis.length === 0 ? (
        <BosDurum
          baslik={musteriler.length === 0 ? 'Henüz günlük müşteri yok' : 'Aramanızla eşleşen müşteri yok'}
          aciklama={musteriler.length === 0 ? 'Kasadan veresiye alan ilk müşteriyi yukarıdaki butonla ekleyin.' : undefined}
        />
      ) : (
        <div className="divide-y divide-bakery-cream-100 overflow-hidden rounded-2xl bg-bakery-surface shadow-soft">
          {filtrelenmis.map((m) => (
            <div key={m.id} className="flex items-center gap-1 pr-2 hover:bg-bakery-cream-50">
              <button onClick={() => setGosterilenId(m.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left">
                <span className="min-w-0 flex-1 truncate font-medium text-bakery-ink-900">
                  {m.ad}
                  {!m.aktif && <span className="ml-2 text-xs font-normal text-bakery-ink-400">(pasif)</span>}
                </span>
                <span
                  className={`shrink-0 whitespace-nowrap text-sm font-semibold ${
                    m.bakiye > 0 ? 'text-bakery-danger' : 'text-bakery-success'
                  }`}
                >
                  {formatTutar(m.bakiye)}
                </span>
              </button>
              {admin && (
                <button
                  onClick={() => setSilinecek(m)}
                  className="shrink-0 rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                  aria-label="Sil"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {gosterilen && (
        <GunlukMusteriDetayModal
          musteri={gosterilen}
          onDuzenle={() => {
            setDuzenlenen(gosterilen)
            setGosterilenId(null)
            setFormAcik(true)
          }}
          onKapat={() => setGosterilenId(null)}
        />
      )}

      {formAcik && <GunlukMusteriFormModal mevcut={duzenlenen} onKaydet={handleKaydet} onKapat={() => setFormAcik(false)} />}

      {silinecek && (
        <ConfirmModal
          baslik="Müşteriyi sil"
          mesaj={`"${silinecek.ad}" müşterisini kalıcı olarak silmek istediğinize emin misiniz? (Yalnızca hiç hareketi olmayan müşteri silinebilir.)`}
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleSil}
          onVazgec={() => setSilinecek(undefined)}
        />
      )}
    </div>
  )
}
