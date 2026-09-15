import { useMemo, useState } from 'react'
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useOkulFirmalari, firmaEkle, firmaGuncelle, firmaSil } from './data'
import { useOkulTeslimatlar } from './orderData'
import { useOkulPayments, okulOdemeEkle, okulOdemeGuncelle, okulOdemeSil } from './paymentData'
import FirmaFormModal from './FirmaFormModal'
import OkulOdemeFormModal from './OkulOdemeFormModal'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import TutarGoster from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { useSession } from '../../lib/session'
import type { OkulFirma, OkulFirmaFormVerisi, OkulPayment, OkulPaymentFormVerisi } from '../../lib/types'

export default function FirmalarPage() {
  const { firmalar, yukleniyor, hata } = useOkulFirmalari()
  const { teslimatlar } = useOkulTeslimatlar()
  const { payments } = useOkulPayments()
  const session = useSession()
  const toast = useToast()

  const [acikId, setAcikId] = useState<string | null>(null)
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<OkulFirma | undefined>()
  const [silinecek, setSilinecek] = useState<OkulFirma | undefined>()
  const [odemeFormFirma, setOdemeFormFirma] = useState<OkulFirma | undefined>()
  const [duzenlenenOdeme, setDuzenlenenOdeme] = useState<OkulPayment | undefined>()
  const [silinecekOdeme, setSilinecekOdeme] = useState<OkulPayment | undefined>()

  const bakiyeler = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of teslimatlar) {
      if (!t.faturaHedefiId) continue
      map.set(t.faturaHedefiId, (map.get(t.faturaHedefiId) ?? 0) + t.tutar)
    }
    for (const p of payments) {
      if (p.hedefTipi !== 'firma') continue
      map.set(p.hedefId, (map.get(p.hedefId) ?? 0) - p.tutar)
    }
    return map
  }, [teslimatlar, payments])

  if (session.status !== 'signed-in') return null
  const kullanici = { uid: session.user.uid }

  async function handleKaydet(veri: OkulFirmaFormVerisi) {
    if (duzenlenen) {
      await firmaGuncelle(duzenlenen.id, veri)
      toast.basari('Firma güncellendi.')
    } else {
      await firmaEkle(veri)
      toast.basari('Firma eklendi.')
    }
  }

  async function handleSil() {
    if (!silinecek) return
    try {
      await firmaSil(silinecek.id)
      toast.basari('Firma silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setSilinecek(undefined)
    }
  }

  async function handleOdemeKaydet(veri: OkulPaymentFormVerisi) {
    if (duzenlenenOdeme) {
      await okulOdemeGuncelle(duzenlenenOdeme.id, veri)
      toast.basari('Ödeme güncellendi.')
    } else {
      await okulOdemeEkle(veri, kullanici)
      toast.basari('Ödeme eklendi.')
    }
  }

  async function handleOdemeSil() {
    if (!silinecekOdeme) return
    try {
      await okulOdemeSil(silinecekOdeme.id)
      toast.basari('Ödeme silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setSilinecekOdeme(undefined)
    }
  }

  if (hata) return <p className="rounded-lg bg-bakery-danger/10 px-4 py-3 text-sm text-bakery-danger">{hata}</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-bakery-coffee-900">Firmalar</h2>
        <button
          onClick={() => {
            setDuzenlenen(undefined)
            setFormAcik(true)
          }}
          className="flex items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500"
        >
          <Plus size={16} />
          Yeni Firma
        </button>
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>
      ) : firmalar.length === 0 ? (
        <BosDurum baslik="Henüz firma eklenmedi" />
      ) : (
        <div className="space-y-2">
          {firmalar.map((f) => {
            const bakiye = bakiyeler.get(f.id) ?? 0
            const acik = acikId === f.id
            const firmaOdemeleri = payments.filter((p) => p.hedefTipi === 'firma' && p.hedefId === f.id)

            return (
              <div key={f.id} className="rounded-xl bg-white shadow-sm shadow-bakery-coffee-900/5">
                <button onClick={() => setAcikId(acik ? null : f.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                  <p className="font-medium text-bakery-coffee-900">{f.ad}</p>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${bakiye > 0 ? 'text-bakery-danger' : 'text-bakery-success'}`}>
                      <TutarGoster tutar={bakiye} />
                    </span>
                    <ChevronDown size={18} className={`text-bakery-coffee-400 transition ${acik ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {acik && (
                  <div className="border-t border-bakery-cream-100 px-4 py-3">
                    <div className="mb-3 flex justify-end gap-1">
                      <button
                        onClick={() => setOdemeFormFirma(f)}
                        className="rounded-lg bg-bakery-amber-500/10 px-3 py-1.5 text-xs font-medium text-bakery-amber-600 hover:bg-bakery-amber-500/20"
                      >
                        + Ödeme Ekle
                      </button>
                      <button
                        onClick={() => {
                          setDuzenlenen(f)
                          setFormAcik(true)
                        }}
                        className="rounded-lg p-1.5 text-bakery-coffee-500 hover:bg-bakery-cream-100"
                        aria-label="Düzenle"
                      >
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setSilinecek(f)} className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10" aria-label="Sil">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {firmaOdemeleri.length === 0 ? (
                      <p className="text-sm text-bakery-coffee-400">Henüz ödeme yok.</p>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {firmaOdemeleri.map((p) => (
                          <li key={p.id} className="flex items-center justify-between rounded-lg bg-bakery-cream-50 px-3 py-2">
                            <span className="text-bakery-coffee-600">
                              {p.tarih} {p.not && `— ${p.not}`}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-bakery-success">
                                <TutarGoster tutar={p.tutar} />
                              </span>
                              <button onClick={() => setDuzenlenenOdeme(p)} className="text-bakery-coffee-400 hover:text-bakery-coffee-600" aria-label="Düzenle">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setSilinecekOdeme(p)} className="text-bakery-danger hover:text-red-700" aria-label="Sil">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {formAcik && <FirmaFormModal mevcut={duzenlenen} onKaydet={handleKaydet} onKapat={() => setFormAcik(false)} />}
      {silinecek && (
        <ConfirmModal
          baslik="Firmayı sil"
          mesaj={`"${silinecek.ad}" firmasını silmek istediğinize emin misiniz?`}
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleSil}
          onVazgec={() => setSilinecek(undefined)}
        />
      )}

      {(odemeFormFirma || duzenlenenOdeme) && (
        <OkulOdemeFormModal
          hedefTipi="firma"
          hedefId={duzenlenenOdeme?.hedefId ?? odemeFormFirma!.id}
          hedefAdi={firmalar.find((f) => f.id === (duzenlenenOdeme?.hedefId ?? odemeFormFirma?.id))?.ad ?? ''}
          mevcut={duzenlenenOdeme}
          onKaydet={handleOdemeKaydet}
          onKapat={() => {
            setOdemeFormFirma(undefined)
            setDuzenlenenOdeme(undefined)
          }}
        />
      )}
      {silinecekOdeme && (
        <ConfirmModal
          baslik="Ödemeyi sil"
          mesaj="Bu ödemeyi silmek istediğinize emin misiniz?"
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleOdemeSil}
          onVazgec={() => setSilinecekOdeme(undefined)}
        />
      )}
    </div>
  )
}
