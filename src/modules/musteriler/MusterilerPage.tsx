import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { useMusteriler, musteriEkle, musteriGuncelle, musteriSil, musteriAktifDurumDegistir } from './data'
import MusteriFormModal from './MusteriFormModal'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import TutarGoster from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { unHesabiAktifMi, cuvalGoster } from '../../shared/unHesabi'
import type { Musteri, MusteriGirisi } from '../../lib/types'

const MODUL_ETIKETI: Record<string, string> = { siparis: 'Sipariş', veresiye: 'Veresiye', okul: 'Okul' }

export default function MusterilerPage() {
  const { musteriler, yukleniyor, hata } = useMusteriler()
  const toast = useToast()
  const [arama, setArama] = useState('')
  const [geciciGoster, setGeciciGoster] = useState(false)
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<Musteri | undefined>()
  const [silinecek, setSilinecek] = useState<Musteri | undefined>()

  const geciciSayisi = musteriler.filter((m) => m.gecici).length

  const filtrelenmis = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    return musteriler.filter((m) => {
      if (!geciciGoster && m.gecici) return false
      if (!q) return true
      return m.ad.toLocaleLowerCase('tr-TR').includes(q) || m.telefon.includes(q)
    })
  }, [musteriler, arama, geciciGoster])

  async function handleKaydet(girisi: MusteriGirisi) {
    if (duzenlenen) {
      await musteriGuncelle(duzenlenen.id, girisi)
      toast.basari('Müşteri güncellendi.')
    } else {
      await musteriEkle(girisi)
      toast.basari('Müşteri eklendi.')
    }
  }

  async function handleSil() {
    if (!silinecek) return
    try {
      await musteriSil(silinecek)
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
        <h2 className="text-lg font-semibold text-bakery-coffee-900">Müşteriler</h2>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bakery-coffee-400" />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Ad veya telefon ara…"
              className="w-full rounded-lg border border-bakery-cream-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
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
      </div>

      {geciciSayisi > 0 && (
        <label className="flex w-fit items-center gap-2 text-sm text-bakery-coffee-600">
          <input type="checkbox" checked={geciciGoster} onChange={(e) => setGeciciGoster(e.target.checked)} />
          Geçici / Düğün müşterilerini de göster ({geciciSayisi})
        </label>
      )}

      {yukleniyor ? (
        <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>
      ) : filtrelenmis.length === 0 ? (
        <BosDurum
          baslik={musteriler.length === 0 ? 'Henüz müşteri eklenmedi' : 'Aramanızla eşleşen müşteri yok'}
          aciklama={musteriler.length === 0 ? 'İlk müşteriyi eklemek için yukarıdaki butonu kullanın.' : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrelenmis.map((m) => (
            <div key={m.id} className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-bakery-coffee-900">{m.ad}</p>
                  {m.telefon && <p className="text-sm text-bakery-coffee-500">{m.telefon}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {!m.aktif && (
                    <span className="rounded-full bg-bakery-cream-100 px-2 py-0.5 text-xs font-medium text-bakery-coffee-500">
                      Pasif
                    </span>
                  )}
                  {m.gecici && (
                    <span className="rounded-full bg-bakery-amber-500/10 px-2 py-0.5 text-xs font-medium text-bakery-amber-600">
                      Geçici
                    </span>
                  )}
                </div>
              </div>

              {m.adres && <p className="mb-2 text-sm text-bakery-coffee-500">{m.adres}</p>}

              <div className="mb-3 flex flex-wrap gap-1">
                {m.moduller.map((mod) => (
                  <span key={mod} className="rounded-full bg-bakery-cream-100 px-2 py-0.5 text-xs text-bakery-coffee-600">
                    {MODUL_ETIKETI[mod] ?? mod}
                  </span>
                ))}
                {unHesabiAktifMi(m) && (
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600">Un Hesabı</span>
                )}
              </div>

              {m.moduller.includes('veresiye') && unHesabiAktifMi(m) && (
                <p className="mb-3 text-sm text-bakery-coffee-600">
                  Un bakiyesi: <strong>{cuvalGoster(m.unHesabi!.birikenEsdegerAdet, m.unHesabi!.adetPerCuval)}</strong>
                </p>
              )}
              {m.moduller.includes('veresiye') && !unHesabiAktifMi(m) && (
                <p className="mb-3 text-sm">
                  Bakiye:{' '}
                  <TutarGoster
                    tutar={m.veresiyeBakiye}
                    className={m.veresiyeBakiye > 0 ? 'font-semibold text-bakery-danger' : 'font-semibold text-bakery-success'}
                  />
                </p>
              )}

              <div className="flex items-center justify-between border-t border-bakery-cream-100 pt-3">
                <button
                  onClick={() => musteriAktifDurumDegistir(m.id, !m.aktif)}
                  className="text-xs font-medium text-bakery-coffee-500 hover:text-bakery-coffee-700"
                >
                  {m.aktif ? 'Pasif yap' : 'Aktif yap'}
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setDuzenlenen(m)
                      setFormAcik(true)
                    }}
                    className="rounded-lg p-1.5 text-bakery-coffee-500 hover:bg-bakery-cream-100"
                    aria-label="Düzenle"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setSilinecek(m)}
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

      {formAcik && (
        <MusteriFormModal
          mevcut={duzenlenen}
          onKaydet={handleKaydet}
          onKapat={() => setFormAcik(false)}
        />
      )}

      {silinecek && (
        <ConfirmModal
          baslik="Müşteriyi sil"
          mesaj={`"${silinecek.ad}" adlı müşteriyi kalıcı olarak silmek istediğinize emin misiniz?`}
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleSil}
          onVazgec={() => setSilinecek(undefined)}
        />
      )}
    </div>
  )
}

export const MusterilerIcon = Users
