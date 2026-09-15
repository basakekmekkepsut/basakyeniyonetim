import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useUrunler, urunEkle, urunGuncelle, urunSil, urunAktifDurumDegistir } from './data'
import UrunFormModal from './UrunFormModal'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import TutarGoster from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import type { Urun, UrunGirisi } from '../../lib/types'

const MODUL_ETIKETI: Record<string, string> = { siparis: 'Sipariş', veresiye: 'Veresiye', okul: 'Okul' }

export default function UrunlerPage() {
  const { urunler, yukleniyor, hata } = useUrunler()
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
        <h2 className="text-lg font-semibold text-bakery-coffee-900">Ürünler</h2>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bakery-coffee-400" />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Ürün ara…"
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
            Yeni Ürün
          </button>
        </div>
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>
      ) : filtrelenmis.length === 0 ? (
        <BosDurum
          baslik={urunler.length === 0 ? 'Henüz ürün eklenmedi' : 'Aramanızla eşleşen ürün yok'}
          aciklama={urunler.length === 0 ? 'İlk ürünü eklemek için yukarıdaki butonu kullanın.' : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm shadow-bakery-coffee-900/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bakery-cream-100 text-left text-bakery-coffee-500">
                <th className="px-4 py-3 font-medium">Ürün</th>
                <th className="px-4 py-3 font-medium">Fiyat</th>
                <th className="px-4 py-3 font-medium">Modüller</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrelenmis.map((u) => (
                <tr key={u.id} className="border-b border-bakery-cream-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-bakery-coffee-900">{u.ad}</td>
                  <td className="px-4 py-3">
                    <TutarGoster tutar={u.fiyat} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.modules.map((m) => (
                        <span key={m} className="rounded-full bg-bakery-cream-100 px-2 py-0.5 text-xs text-bakery-coffee-600">
                          {MODUL_ETIKETI[m] ?? m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => urunAktifDurumDegistir(u.id, !u.aktif)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.aktif ? 'bg-bakery-success/10 text-bakery-success' : 'bg-bakery-cream-100 text-bakery-coffee-500'
                      }`}
                    >
                      {u.aktif ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setDuzenlenen(u)
                          setFormAcik(true)
                        }}
                        className="rounded-lg p-1.5 text-bakery-coffee-500 hover:bg-bakery-cream-100"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formAcik && (
        <UrunFormModal mevcut={duzenlenen} onKaydet={handleKaydet} onKapat={() => setFormAcik(false)} />
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
