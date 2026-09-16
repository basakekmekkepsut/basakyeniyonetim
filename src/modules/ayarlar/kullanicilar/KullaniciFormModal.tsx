import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { KullaniciProfili, Rol } from '../../../lib/types'
import { BOS_PROFIL, type KullaniciSatiri } from './data'
import { useMusteriler } from '../../musteriler/data'

interface Props {
  mevcut?: KullaniciSatiri
  onKaydet: (uid: string, profil: KullaniciProfili) => Promise<void>
  onKapat: () => void
}

export default function KullaniciFormModal({ mevcut, onKaydet, onKapat }: Props) {
  const { musteriler } = useMusteriler()
  const [uid, setUid] = useState(mevcut?.uid ?? '')
  const [profil, setProfil] = useState<KullaniciProfili>(() =>
    mevcut ? { ...mevcut, bildirimler: mevcut.bildirimler ?? BOS_PROFIL.bildirimler } : BOS_PROFIL
  )
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const veresiyeMusterileri = musteriler.filter((m) => m.aktif && m.moduller.includes('veresiye'))
  const atanmisMusteriler = profil.permissions.veresiye.gorebilecegiMusteriler

  function alanGuncelle<K extends keyof KullaniciProfili>(alan: K, deger: KullaniciProfili[K]) {
    setProfil((p) => ({ ...p, [alan]: deger }))
  }

  function musteriAtamaDegistir(musteriId: string) {
    if (atanmisMusteriler === 'all') return
    const yeni = atanmisMusteriler.includes(musteriId)
      ? atanmisMusteriler.filter((id) => id !== musteriId)
      : [...atanmisMusteriler, musteriId]
    alanGuncelle('permissions', { ...profil.permissions, veresiye: { gorebilecegiMusteriler: yeni } })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!mevcut && !uid.trim()) {
      setHata('Firebase Authentication\'da oluşturduğunuz kullanıcının UID değerini girin.')
      return
    }
    if (!profil.ad.trim()) {
      setHata('Ad zorunludur.')
      return
    }
    setHata(null)
    setGonderiliyor(true)
    try {
      await onKaydet(mevcut ? mevcut.uid : uid.trim(), profil)
      onKapat()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-bakery-surface p-5 shadow-xl md:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-ink-900">
            {mevcut ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Profili'}
          </h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-ink-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        {!mevcut && (
          <p className="mb-4 rounded-lg bg-bakery-cream-50 px-3 py-2 text-xs text-bakery-ink-600">
            Önce Firebase Console → Authentication'dan e-posta/şifre ile kullanıcıyı oluşturun, oradaki
            UID'yi aşağıya yapıştırın. Bu form yalnızca yetki profilini (bu <code>users</code> dokümanını)
            oluşturur.
          </p>
        )}

        <div className="space-y-4">
          {!mevcut && (
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Firebase Auth UID *</label>
              <input
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 font-mono text-sm outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Ad Soyad *</label>
              <input
                type="text"
                value={profil.ad}
                onChange={(e) => alanGuncelle('ad', e.target.value)}
                required
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">E-posta</label>
              <input
                type="email"
                value={profil.eposta}
                onChange={(e) => alanGuncelle('eposta', e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Rol</label>
            <select
              value={profil.rol}
              onChange={(e) => alanGuncelle('rol', e.target.value as Rol)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
            >
              <option value="personel">Personel</option>
              <option value="admin">Yönetici</option>
            </select>
          </div>

          {profil.rol === 'personel' && (
            <div className="space-y-3 rounded-lg bg-bakery-cream-50 p-3">
              <div>
                <p className="mb-1.5 text-sm font-medium text-bakery-ink-800">Görebileceği modüller</p>
                <div className="flex flex-wrap gap-2">
                  {(['siparis', 'veresiye', 'okul'] as const).map((m) => (
                    <label key={m} className="flex items-center gap-1.5 rounded-full bg-bakery-surface px-3 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={profil.modules[m]}
                        onChange={(e) => alanGuncelle('modules', { ...profil.modules, [m]: e.target.checked })}
                      />
                      {m === 'siparis' ? 'Sipariş' : m === 'veresiye' ? 'Veresiye' : 'Okul'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-bakery-ink-800">Sipariş yetkileri</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['orderAdd', 'Sipariş ekleyebilir'],
                      ['orderViewAll', 'Tüm siparişleri görebilir'],
                      ['products', 'Ürünleri yönetebilir']
                    ] as const
                  ).map(([key, etiket]) => (
                    <label key={key} className="flex items-center gap-1.5 rounded-full bg-bakery-surface px-3 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={profil.permissions.siparis[key]}
                        onChange={(e) =>
                          alanGuncelle('permissions', {
                            ...profil.permissions,
                            siparis: { ...profil.permissions.siparis, [key]: e.target.checked }
                          })
                        }
                      />
                      {etiket}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-bakery-ink-800">Veresiye görünürlüğü</p>
                <label className="flex items-center gap-1.5 rounded-full bg-bakery-surface px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={profil.permissions.veresiye.gorebilecegiMusteriler === 'all'}
                    onChange={(e) =>
                      alanGuncelle('permissions', {
                        ...profil.permissions,
                        veresiye: { gorebilecegiMusteriler: e.target.checked ? 'all' : [] }
                      })
                    }
                  />
                  Tüm müşterileri görebilir
                </label>

                {atanmisMusteriler !== 'all' && (
                  <div className="mt-2">
                    <p className="mb-1.5 text-xs text-bakery-ink-500">
                      Kapalıysa yalnızca aşağıda işaretlediğiniz müşterileri görebilir/işlem yapabilir
                      ({atanmisMusteriler.length} seçili):
                    </p>
                    {veresiyeMusterileri.length === 0 ? (
                      <p className="text-xs text-bakery-ink-400">Henüz Veresiye modülünde müşteri yok.</p>
                    ) : (
                      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg bg-bakery-surface p-2">
                        {veresiyeMusterileri.map((m) => (
                          <button
                            type="button"
                            key={m.id}
                            onClick={() => musteriAtamaDegistir(m.id)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                              atanmisMusteriler.includes(m.id)
                                ? 'bg-bakery-amber-600 text-white'
                                : 'bg-bakery-cream-100 text-bakery-ink-600 hover:bg-bakery-cream-200'
                            }`}
                          >
                            {m.ad}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-bakery-ink-800">Okul yetkileri</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['siparis', 'Sipariş girebilir'],
                      ['okullar', 'Okulları yönetebilir'],
                      ['urunler', 'Ürünleri yönetebilir'],
                      ['ekstre', 'Ekstre görebilir'],
                      ['mesaj', 'Mesaj gönderebilir']
                    ] as const
                  ).map(([key, etiket]) => (
                    <label key={key} className="flex items-center gap-1.5 rounded-full bg-bakery-surface px-3 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={profil.permissions.okul[key]}
                        onChange={(e) =>
                          alanGuncelle('permissions', {
                            ...profil.permissions,
                            okul: { ...profil.permissions.okul, [key]: e.target.checked }
                          })
                        }
                      />
                      {etiket}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-lg bg-bakery-cream-50 p-3">
            <p className="text-sm font-medium text-bakery-ink-800">Push Bildirimleri</p>
            <p className="text-xs text-bakery-ink-500">
              Bildirimin gerçekten telefona düşmesi için kişinin kendisinin uygulamada "Bildirimleri Aç"a basmış olması gerekir.
            </p>
            <label className="flex items-center gap-1.5 rounded-full bg-bakery-surface px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={profil.bildirimler.yeniSiparis}
                onChange={(e) => alanGuncelle('bildirimler', { ...profil.bildirimler, yeniSiparis: e.target.checked })}
              />
              Yeni sipariş girildiğinde anlık bildirim al
            </label>
            <label className="flex items-center gap-1.5 rounded-full bg-bakery-surface px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                checked={profil.bildirimler.gunlukHatirlatma}
                onChange={(e) => alanGuncelle('bildirimler', { ...profil.bildirimler, gunlukHatirlatma: e.target.checked })}
              />
              Her sabah "yarın için sipariş var" hatırlatması al
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-bakery-ink-800">
            <input type="checkbox" checked={profil.aktif} onChange={(e) => alanGuncelle('aktif', e.target.checked)} />
            Aktif (giriş yapabilir)
          </label>

          {hata && <p className="rounded-lg bg-bakery-danger/10 px-3 py-2 text-sm text-bakery-danger">{hata}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onKapat} className="rounded-lg px-4 py-2 text-sm font-medium text-bakery-ink-600 hover:bg-bakery-cream-100">
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={gonderiliyor}
            className="rounded-lg bg-bakery-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-bakery-amber-500 disabled:opacity-60"
          >
            {gonderiliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
