import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useUrunler, urunEkle, urunGuncelle, urunSil, urunAktifDurumDegistir } from './data'
import UrunFormModal from './UrunFormModal'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import TutarGoster from '../../shared/TutarGoster'
import { gunlukFiyati } from '../../shared/gunlukFiyat'
import { useToast } from '../../shared/Toast'
import { isAdmin, useSession } from '../../lib/session'
import type { Modul, Urun, UrunGirisi } from '../../lib/types'

const MODUL_ETIKETI: Record<string, string> = { siparis: 'Sipariş', veresiye: 'Veresiye', okul: 'Okul', gunluk: 'Günlük' }

interface Props {
  // Verilirse yalnızca bu modüle işaretli ürünler listelenir ve yeni ürün bu
  // modül işaretli açılır (bkz. Günlük Veresiye > Ürünler).
  modul?: Modul
}

export default function UrunlerPage({ modul }: Props = {}) {
  const session = useSession()
  // Ürün yazma kuralı yalnızca admin'e açık (firestore.rules products) — personel salt okunur görür.
  const duzenleyebilir = session.status === 'signed-in' && isAdmin(session.profile)
  const { urunler: tumUrunler, yukleniyor, hata } = useUrunler()
  const urunler = useMemo(() => (modul ? tumUrunler.filter((u) => u.modules.includes(modul)) : tumUrunler), [tumUrunler, modul])
  const toast = useToast()
  const [arama, setArama] = useState('')
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<Urun | undefined>()
  const [silinecek, setSilinecek] = useState<Urun | undefined>()

  const filtrelenmis = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    if (!q) return urunler
    return urunler.filter((u) => u.ad.toLocaleLowerCase('tr-TR').includes(q))
  }, [urunler, arama])

  async function handleKaydet(girisi: UrunGirisi) {
    if (duzenlenen) {
      await urunGuncelle(duzenlenen.id, girisi)
      toast.basari('Ürün güncellendi.')
    } else {
      await urunEkle(girisi)
      toast.basari('Ürün eklendi.')
    }
  }

  async function handleSil() {
    if (!silinecek) return
    try {
      await urunSil(silinecek.id)
      toast.basari('Ürün silindi.')
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
        <h2 className="text-lg font-semibold text-bakery-ink-900">Ürünler</h2>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bakery-ink-400" />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Ürün ara…"
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>
          {duzenleyebilir && (
            <button
              onClick={() => {
                setDuzenlenen(undefined)
                setFormAcik(true)
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500"
            >
              <Plus size={16} />
              Yeni Ürün
            </button>
          )}
        </div>
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : filtrelenmis.length === 0 ? (
        <BosDurum
          baslik={urunler.length === 0 ? 'Henüz ürün eklenmedi' : 'Aramanızla eşleşen ürün yok'}
          aciklama={
            urunler.length === 0
              ? modul && !duzenleyebilir
                ? 'Bu bölüm için henüz ürün tanımlanmadı — yöneticinize danışın.'
                : 'İlk ürünü eklemek için yukarıdaki butonu kullanın.'
              : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-bakery-cream-100 overflow-hidden rounded-xl bg-bakery-surface shadow-sm shadow-bakery-coffee-900/5">
          {filtrelenmis.map((u) => (
            <li key={u.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium text-bakery-ink-900">{u.ad}</p>
                  <span className="shrink-0 text-right text-sm font-semibold text-bakery-ink-900">
                    {/* Günlük Veresiye > Ürünler'de kasa fiyatı öne çıkar, normal fiyat farklıysa altında küçük gösterilir. */}
                    <TutarGoster tutar={modul === 'gunluk' ? gunlukFiyati(u) : u.fiyat} />
                    {modul === 'gunluk' && gunlukFiyati(u) !== u.fiyat && (
                      <span className="block text-xs font-normal text-bakery-ink-400">
                        Normal: <TutarGoster tutar={u.fiyat} />
                      </span>
                    )}
                    {modul !== 'gunluk' && u.gunlukFiyat != null && u.gunlukFiyat !== u.fiyat && (
                      <span className="block text-xs font-normal text-bakery-ink-400">
                        Günlük: <TutarGoster tutar={u.gunlukFiyat} />
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <button
                    onClick={() => duzenleyebilir && urunAktifDurumDegistir(u.id, !u.aktif)}
                    disabled={!duzenleyebilir}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.aktif ? 'bg-bakery-success/10 text-bakery-success' : 'bg-bakery-cream-100 text-bakery-ink-500'
                    }`}
                    title="Aktif/Pasif değiştir"
                  >
                    {u.aktif ? 'Aktif' : 'Pasif'}
                  </button>
                  {u.modules.map((m) => (
                    <span key={m} className="rounded-full bg-bakery-cream-100 px-2 py-0.5 text-xs text-bakery-ink-600">
                      {MODUL_ETIKETI[m] ?? m}
                    </span>
                  ))}
                </div>
              </div>
              {duzenleyebilir && (
                <div className="flex shrink-0 gap-0.5">
                  <button
                    onClick={() => {
                      setDuzenlenen(u)
                      setFormAcik(true)
                    }}
                    className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                    aria-label="Düzenle"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setSilinecek(u)}
                    className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                    aria-label="Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {formAcik && (
        <UrunFormModal
          mevcut={duzenlenen}
          varsayilanModuller={modul ? [modul] : undefined}
          onKaydet={handleKaydet}
          onKapat={() => setFormAcik(false)}
        />
      )}

      {silinecek && (
        <ConfirmModal
          baslik="Ürünü sil"
          mesaj={`"${silinecek.ad}" ürününü kalıcı olarak silmek istediğinize emin misiniz?`}
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleSil}
          onVazgec={() => setSilinecek(undefined)}
        />
      )}
    </div>
  )
}
