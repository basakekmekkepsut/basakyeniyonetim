import { useState, type FormEvent } from 'react'
import { httpsCallable } from 'firebase/functions'
import { isFirebaseConfigured, requireFunctions } from '../lib/firebase'
import { formatTutar } from '../shared/TutarGoster'
import { cuvalGoster } from '../shared/unHesabi'

interface PortalHareket {
  tarih: string
  tur: 'teslimat' | 'odeme'
  aciklama: string
  tutar: number
  durum: string
}

interface PortalSonuc {
  ad: string
  adSoyad: string
  hitapSekli: 'bay' | 'hanim' | null
  veresiyeBakiye: number
  unHesabi: { aktif: boolean; birikenEsdegerAdet: number; adetPerCuval: number | null } | null
  hareketler: PortalHareket[]
}

function hitapGoster(ad: string, adSoyad: string, hitapSekli: PortalSonuc['hitapSekli']) {
  const isim = adSoyad || ad
  if (hitapSekli === 'bay') return `${isim} Bey`
  if (hitapSekli === 'hanim') return `${isim} Hanım`
  return isim
}

export default function PortalApp() {
  const kod = new URLSearchParams(window.location.search).get('kod') ?? ''
  const [sifre, setSifre] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [veri, setVeri] = useState<PortalSonuc | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!kod) {
      setHata('Geçersiz bağlantı — kod bulunamadı.')
      return
    }
    setHata(null)
    setYukleniyor(true)
    try {
      const cagir = httpsCallable<{ musteriId: string; sifre: string }, PortalSonuc>(requireFunctions(), 'portalGiris')
      const sonuc = await cagir({ musteriId: kod, sifre })
      setVeri(sonuc.data)
    } catch (err) {
      setHata(err instanceof Error ? err.message.replace(/^\w+\/[\w-]+:\s*/, '') : 'Giriş yapılamadı.')
    } finally {
      setYukleniyor(false)
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bakery-cream-50 px-4">
        <p className="text-sm text-bakery-coffee-600">Sistem şu anda yapılandırılmıyor.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bakery-cream-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/logo.webp" alt="Başak Ekmek" className="mx-auto mb-3 h-16 w-44 rounded-lg object-cover object-center" />
          <h1 className="text-xl font-semibold text-bakery-coffee-900">Başak Ekmek</h1>
          <p className="mt-1 text-sm text-bakery-coffee-600">Hesap Ekstresi</p>
        </div>

        {!veri ? (
          <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-lg shadow-bakery-coffee-900/10">
            <label className="mb-1.5 block text-sm font-medium text-bakery-coffee-800" htmlFor="sifre">
              6 Haneli Şifreniz
            </label>
            <input
              id="sifre"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={sifre}
              onChange={(e) => setSifre(e.target.value.replace(/\D/g, ''))}
              autoFocus
              className="mb-4 w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2.5 text-center text-lg tracking-widest text-bakery-coffee-900 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
            {hata && <p className="mb-4 rounded-lg bg-bakery-danger/10 px-3 py-2 text-sm text-bakery-danger">{hata}</p>}
            <button
              type="submit"
              disabled={yukleniyor || sifre.length !== 6}
              className="w-full rounded-lg bg-bakery-amber-600 py-2.5 font-medium text-white transition hover:bg-bakery-amber-500 disabled:opacity-60"
            >
              {yukleniyor ? 'Kontrol ediliyor…' : 'Görüntüle'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl bg-white p-5 shadow-lg shadow-bakery-coffee-900/10">
              <p className="text-sm text-bakery-coffee-500">Merhaba,</p>
              <p className="mb-3 text-lg font-semibold text-bakery-coffee-900">
                {hitapGoster(veri.ad, veri.adSoyad, veri.hitapSekli)}
              </p>

              {veri.unHesabi?.aktif ? (
                <div>
                  <p className="text-sm text-bakery-coffee-500">Un Bakiyeniz</p>
                  <p className={`text-2xl font-bold ${veri.unHesabi.birikenEsdegerAdet > 0 ? 'text-bakery-danger' : 'text-bakery-success'}`}>
                    {cuvalGoster(veri.unHesabi.birikenEsdegerAdet, veri.unHesabi.adetPerCuval)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-bakery-coffee-500">Güncel Bakiyeniz</p>
                  <p className={`text-2xl font-bold ${veri.veresiyeBakiye > 0 ? 'text-bakery-danger' : 'text-bakery-success'}`}>
                    {formatTutar(veri.veresiyeBakiye)}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-lg shadow-bakery-coffee-900/10">
              <h2 className="mb-3 text-sm font-semibold text-bakery-coffee-800">Son Hareketler</h2>
              {veri.hareketler.length === 0 ? (
                <p className="text-sm text-bakery-coffee-400">Henüz hareket yok.</p>
              ) : (
                <ul className="space-y-2">
                  {veri.hareketler.map((h, i) => (
                    <li key={i} className="flex items-center justify-between border-b border-bakery-cream-100 pb-2 text-sm last:border-0">
                      <div>
                        <p className="text-bakery-coffee-800">{h.aciklama}</p>
                        <p className="text-xs text-bakery-coffee-400">{h.tarih}</p>
                      </div>
                      <span className={h.tur === 'odeme' ? 'font-medium text-bakery-success' : 'font-medium text-bakery-coffee-900'}>
                        {h.tur === 'odeme' ? '+ ' : ''}
                        {formatTutar(h.tutar)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={() => {
                setVeri(null)
                setSifre('')
              }}
              className="w-full text-center text-sm text-bakery-coffee-500 hover:text-bakery-coffee-700"
            >
              Çıkış
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
