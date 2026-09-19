import { useState } from 'react'
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useOkullar, okulEkle, okulGuncelle, okulSil, okullariGrupla } from './data'
import { useMusteriler } from '../musteriler/data'
import OkulFormModal from './OkulFormModal'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import { useToast } from '../../shared/Toast'
import type { OkulSchool, OkulSchoolFormVerisi } from '../../lib/types'

const GUN_ETIKETLERI: Record<number, string> = { 1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt', 0: 'Paz' }
const GUN_SIRASI = [1, 2, 3, 4, 5, 6, 0]

function gunlerEtiketi(gunler: number[]): string {
  return GUN_SIRASI.filter((g) => gunler.includes(g))
    .map((g) => GUN_ETIKETLERI[g])
    .join(', ')
}

export default function OkullarPage() {
  const { okullar, yukleniyor, hata } = useOkullar()
  const { musteriler } = useMusteriler()
  const toast = useToast()
  const gruplar = okullariGrupla(okullar, musteriler)
  const [acikId, setAcikId] = useState<string | null>(null)
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<OkulSchool | undefined>()
  const [silinecek, setSilinecek] = useState<OkulSchool | undefined>()

  async function handleKaydet(veri: OkulSchoolFormVerisi) {
    if (duzenlenen) {
      await okulGuncelle(duzenlenen.id, veri)
      toast.basari('Okul güncellendi.')
    } else {
      await okulEkle(veri)
      toast.basari('Okul eklendi.')
    }
  }

  async function handleSil() {
    if (!silinecek) return
    try {
      await okulSil(silinecek.id)
      toast.basari('Okul silindi.')
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
        <h2 className="text-lg font-semibold text-bakery-ink-900">Okullar</h2>
        <button
          onClick={() => {
            setDuzenlenen(undefined)
            setFormAcik(true)
          }}
          className="flex items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500"
        >
          <Plus size={16} />
          Yeni Okul
        </button>
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : okullar.length === 0 ? (
        <BosDurum baslik="Henüz okul eklenmedi" aciklama="İlk okulu eklemek için yukarıdaki butonu kullanın." />
      ) : (
        <div className="space-y-5">
          {gruplar.map((grup) => (
            <div key={grup.anahtar}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-bakery-ink-500">{grup.baslik}</h3>
              <div className="space-y-2">
                {grup.okullar.map((o) => {
                  const musteri = musteriler.find((m) => m.id === o.musteriId)
                  const acik = acikId === o.id
                  return (
                    <div key={o.id} className="rounded-xl bg-bakery-surface shadow-sm shadow-bakery-coffee-900/5">
                      <button
                        onClick={() => setAcikId(acik ? null : o.id)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                      >
                        <div>
                          <p className="font-medium text-bakery-ink-900">{o.ad}</p>
                          <p className="text-xs text-bakery-ink-500">
                            {musteri ? musteri.ad : 'Veresiye hesabı bağlı değil'} · {o.lines.length} hat
                          </p>
                        </div>
                        <ChevronDown size={18} className={`text-bakery-ink-400 transition ${acik ? 'rotate-180' : ''}`} />
                      </button>

                      {acik && (
                        <div className="border-t border-bakery-cream-100 px-4 py-3">
                          {o.lines.length === 0 ? (
                            <p className="text-sm text-bakery-ink-400">Hat tanımlı değil.</p>
                          ) : (
                            <ul className="mb-3 space-y-1 text-sm text-bakery-ink-600">
                              {o.lines.map((l) => (
                                <li key={l.id}>
                                  {l.urunAdi} — {l.adet} adet/gün
                                  {l.gunler && l.gunler.length < 7 && (
                                    <span className="text-bakery-ink-400"> ({gunlerEtiketi(l.gunler)})</span>
                                  )}{' '}
                                  {!l.aktif && <em className="text-bakery-ink-400">(pasif)</em>}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => {
                                setDuzenlenen(o)
                                setFormAcik(true)
                              }}
                              className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                              aria-label="Düzenle"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => setSilinecek(o)}
                              className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                              aria-label="Sil"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {formAcik && <OkulFormModal mevcut={duzenlenen} onKaydet={handleKaydet} onKapat={() => setFormAcik(false)} />}

      {silinecek && (
        <ConfirmModal
          baslik="Okulu sil"
          mesaj={`"${silinecek.ad}" okulunu silmek istediğinize emin misiniz?`}
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleSil}
          onVazgec={() => setSilinecek(undefined)}
        />
      )}
    </div>
  )
}
