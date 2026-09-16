import { useState } from 'react'
import { Bell, Pencil, Plus } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { useKullanicilar, kullaniciProfiliOlustur, kullaniciProfiliGuncelle, type KullaniciSatiri } from './data'
import KullaniciFormModal from './KullaniciFormModal'
import BosDurum from '../../../shared/BosDurum'
import { useToast } from '../../../shared/Toast'
import { requireFunctions } from '../../../lib/firebase'
import type { KullaniciProfili } from '../../../lib/types'
import { useSession } from '../../../lib/session'

export default function KullanicilarPage() {
  const { kullanicilar, yukleniyor, hata } = useKullanicilar()
  const session = useSession()
  const toast = useToast()
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<KullaniciSatiri | undefined>()

  async function handleTestBildirim(uid: string) {
    try {
      const cagir = httpsCallable<{ hedefTipi: 'personel'; id: string }, { basarili: number; basarisiz: number }>(
        requireFunctions(),
        'pushTestGonder'
      )
      const sonuc = await cagir({ hedefTipi: 'personel', id: uid })
      toast.basari(`Test bildirimi gönderildi (${sonuc.data.basarili} cihaza).`)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Bildirim gönderilemedi.')
    }
  }

  async function handleKaydet(uid: string, profil: KullaniciProfili) {
    if (duzenlenen) {
      await kullaniciProfiliGuncelle(uid, profil)
      toast.basari('Kullanıcı güncellendi.')
    } else {
      await kullaniciProfiliOlustur(uid, profil)
      toast.basari('Kullanıcı profili oluşturuldu.')
    }
  }

  if (hata) {
    return <p className="rounded-lg bg-bakery-danger/10 px-4 py-3 text-sm text-bakery-danger">{hata}</p>
  }

  const benimUid = session.status === 'signed-in' ? session.user.uid : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-bakery-coffee-900">Kullanıcılar</h2>
        <button
          onClick={() => {
            setDuzenlenen(undefined)
            setFormAcik(true)
          }}
          className="flex items-center gap-1.5 rounded-lg bg-bakery-amber-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500"
        >
          <Plus size={16} />
          Yeni Kullanıcı
        </button>
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>
      ) : kullanicilar.length === 0 ? (
        <BosDurum baslik="Henüz kullanıcı profili yok" aciklama="Firebase Authentication'da kullanıcı oluşturduktan sonra buradan yetki profilini ekleyin." />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm shadow-bakery-coffee-900/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bakery-cream-100 text-left text-bakery-coffee-500">
                <th className="px-4 py-3 font-medium">Ad</th>
                <th className="px-4 py-3 font-medium">E-posta</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {kullanicilar.map((k) => (
                <tr key={k.uid} className="border-b border-bakery-cream-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-bakery-coffee-900">
                    {k.ad} {k.uid === benimUid && <span className="text-xs text-bakery-coffee-400">(siz)</span>}
                  </td>
                  <td className="px-4 py-3 text-bakery-coffee-600">{k.eposta}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        k.rol === 'admin' ? 'bg-bakery-amber-500/15 text-bakery-amber-600' : 'bg-bakery-cream-100 text-bakery-coffee-600'
                      }`}
                    >
                      {k.rol === 'admin' ? 'Yönetici' : 'Personel'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${k.aktif ? 'bg-bakery-success/10 text-bakery-success' : 'bg-bakery-cream-100 text-bakery-coffee-500'}`}>
                      {k.aktif ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleTestBildirim(k.uid)}
                      className="rounded-lg p-1.5 text-bakery-coffee-500 hover:bg-bakery-cream-100"
                      aria-label="Test bildirimi gönder"
                      title="Test bildirimi gönder"
                    >
                      <Bell size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setDuzenlenen(k)
                        setFormAcik(true)
                      }}
                      className="rounded-lg p-1.5 text-bakery-coffee-500 hover:bg-bakery-cream-100"
                      aria-label="Düzenle"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formAcik && (
        <KullaniciFormModal mevcut={duzenlenen} onKaydet={handleKaydet} onKapat={() => setFormAcik(false)} />
      )}
    </div>
  )
}
