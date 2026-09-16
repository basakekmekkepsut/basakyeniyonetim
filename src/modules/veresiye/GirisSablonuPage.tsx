import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useVeresiyeSablonlar, veresiyeSablonEkle, veresiyeSablonGuncelle, veresiyeSablonSil } from './sablonData'
import VeresiyeSablonFormModal from './VeresiyeSablonFormModal'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import { useToast } from '../../shared/Toast'
import { useVeresiyeMusteriFiltresi } from '../../shared/veresiyeErisim'
import type { VeresiyeSablon, VeresiyeSablonFormVerisi } from '../../lib/types'

export default function GirisSablonuPage() {
  const { sablonlar: tumSablonlar, yukleniyor, hata } = useVeresiyeSablonlar()
  const musteriFiltresi = useVeresiyeMusteriFiltresi()
  const sablonlar = useMemo(
    () =>
      tumSablonlar
        .filter((s) => musteriFiltresi({ id: s.musteriId }))
        .sort((a, b) => (a.sira ?? 0) - (b.sira ?? 0)),
    [tumSablonlar, musteriFiltresi]
  )
  const sonrakiSira = useMemo(() => tumSablonlar.reduce((max, s) => Math.max(max, s.sira ?? 0), 0) + 1, [tumSablonlar])
  const toast = useToast()
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<VeresiyeSablon | undefined>()
  const [silinecek, setSilinecek] = useState<VeresiyeSablon | undefined>()

  async function handleKaydet(veri: VeresiyeSablonFormVerisi) {
    if (duzenlenen) {
      await veresiyeSablonGuncelle(duzenlenen.id, veri)
      toast.basari('Şablon güncellendi.')
    } else {
      await veresiyeSablonEkle(veri)
      toast.basari('Şablon eklendi.')
    }
  }

  async function siraDegistir(index: number, yon: -1 | 1) {
    const digeri = sablonlar[index + yon]
    if (!digeri) return
    const bu = sablonlar[index]
    const { id: buId, ...buVeri } = bu
    const { id: digeriId, ...digeriVeri } = digeri
    try {
      await Promise.all([
        veresiyeSablonGuncelle(buId, { ...buVeri, sira: digeri.sira ?? 0 }),
        veresiyeSablonGuncelle(digeriId, { ...digeriVeri, sira: bu.sira ?? 0 })
      ])
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Sıra değiştirilemedi.')
    }
  }

  async function handleSil() {
    if (!silinecek) return
    try {
      await veresiyeSablonSil(silinecek.id)
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
        <h2 className="text-lg font-semibold text-bakery-coffee-900">Giriş Şablonu</h2>
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

      <p className="text-sm text-bakery-coffee-500">
        Buradaki şablonlar, Günlük Giriş ekranındaki müşteri kartlarında "Şablon" butonuyla tek tıkla yüklenir.
      </p>

      {yukleniyor ? (
        <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>
      ) : sablonlar.length === 0 ? (
        <BosDurum baslik="Henüz giriş şablonu yok" aciklama="Düzenli veresiye müşterileri için şablon oluşturursanız Günlük Giriş çok daha hızlanır." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sablonlar.map((s, i) => (
            <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-bakery-cream-100 px-2 py-0.5 text-xs font-medium text-bakery-coffee-500">
                    Sıra {s.sira ?? 0}
                  </span>
                  <p className="font-medium text-bakery-coffee-900">{s.musteriAdi}</p>
                </div>
                {!s.aktif && <span className="rounded-full bg-bakery-cream-100 px-2 py-0.5 text-xs text-bakery-coffee-500">Pasif</span>}
              </div>
              <ul className="mb-3 space-y-0.5 text-sm text-bakery-coffee-600">
                {s.kalemler.map((k, i) => (
                  <li key={i}>
                    {k.adet}× {k.urunAdi}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-bakery-cream-100 pt-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => siraDegistir(i, -1)}
                    disabled={i === 0}
                    className="rounded-lg p-1.5 text-bakery-coffee-500 hover:bg-bakery-cream-100 disabled:opacity-30"
                    aria-label="Yukarı taşı"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => siraDegistir(i, 1)}
                    disabled={i === sablonlar.length - 1}
                    className="rounded-lg p-1.5 text-bakery-coffee-500 hover:bg-bakery-cream-100 disabled:opacity-30"
                    aria-label="Aşağı taşı"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setDuzenlenen(s)
                      setFormAcik(true)
                    }}
                    className="rounded-lg p-1.5 text-bakery-coffee-500 hover:bg-bakery-cream-100"
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

      {formAcik && (
        <VeresiyeSablonFormModal
          mevcut={duzenlenen}
          varsayilanSira={sonrakiSira}
          onKaydet={handleKaydet}
          onKapat={() => setFormAcik(false)}
        />
      )}

      {silinecek && (
        <ConfirmModal
          baslik="Şablonu sil"
          mesaj={`"${silinecek.musteriAdi}" giriş şablonunu silmek istediğinize emin misiniz?`}
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleSil}
          onVazgec={() => setSilinecek(undefined)}
        />
      )}
    </div>
  )
}
