import { useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { isFirebaseConfigured, requireFunctions } from '../lib/firebase'
import { tarihGunAdiIle } from '../shared/tarih'

interface UretimUrunu {
  urunAdi: string
  adet: number
  not?: string
}

interface UretimOkulSatiri {
  okulAdi: string
  satirlar: UretimUrunu[]
  toplam: number
}

interface UretimSiparisSatiri {
  musteriAdi: string
  satirlar: UretimUrunu[]
}

function yarinStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Ustaların (üretim ekibi) giriş yapmadan bakabileceği, tamamen açık bir
// üretim özeti — Sipariş ve Okul modüllerindeki o günkü siparişleri ürün
// bazında toplayıp gösterir, ayrıca kimin (müşteri/okul) ne sipariş ettiğini
// de listeler (bkz. functions/src/index.ts uretimOzetiGetir). Ürün bazlı
// toplamların hepsini tek bir sayıda toplamıyoruz — farklı ürünleri (ör. roll
// + simit) toplamak anlamlı bir "toplam" üretmez.
export default function UretimApp() {
  const [tarih, setTarih] = useState(yarinStr())
  const [urunler, setUrunler] = useState<UretimUrunu[]>([])
  const [siparisler, setSiparisler] = useState<UretimSiparisSatiri[]>([])
  const [okullar, setOkullar] = useState<UretimOkulSatiri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let iptalEdildi = false
    setYukleniyor(true)
    setHata(null)
    const cagir = httpsCallable<
      { tarih: string },
      { urunler: UretimUrunu[]; siparisler: UretimSiparisSatiri[]; okullar: UretimOkulSatiri[] }
    >(requireFunctions(), 'uretimOzetiGetir')
    cagir({ tarih })
      .then((sonuc) => {
        if (iptalEdildi) return
        setUrunler(sonuc.data.urunler)
        setSiparisler(sonuc.data.siparisler)
        setOkullar(sonuc.data.okullar)
      })
      .catch((err) => {
        if (iptalEdildi) return
        setHata(err instanceof Error ? err.message : 'Yüklenemedi.')
      })
      .finally(() => {
        if (!iptalEdildi) setYukleniyor(false)
      })
    return () => {
      iptalEdildi = true
    }
  }, [tarih])

  if (!isFirebaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bakery-cream-50 px-4">
        <p className="text-sm text-bakery-ink-600">Sistem şu anda yapılandırılmıyor.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-bakery-cream-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <img src="/logo-mark.webp" alt="Başak Ekmek" className="logo-adaptive mx-auto mb-3 h-16 w-44 object-contain object-center" />
          <h1 className="text-xl font-semibold text-bakery-ink-900">Üretim Özeti</h1>
        </div>

        <div className="mb-4 rounded-2xl bg-bakery-surface p-4 shadow-lg shadow-bakery-coffee-900/10">
          <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800">Tarih</label>
          <input
            type="date"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2.5 text-base outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
          />
          <p className="mt-1.5 text-xs text-bakery-ink-500">{tarihGunAdiIle(tarih)}</p>
        </div>

        {yukleniyor ? (
          <p className="text-center text-sm text-bakery-ink-500">Yükleniyor…</p>
        ) : hata ? (
          <div className="rounded-2xl bg-bakery-danger/10 p-4 text-sm text-bakery-danger shadow-lg">{hata}</div>
        ) : urunler.length === 0 ? (
          <div className="rounded-2xl bg-bakery-surface p-6 text-center shadow-lg shadow-bakery-coffee-900/10">
            <p className="text-sm text-bakery-ink-400">Bu tarihte sipariş yok.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {urunler.map((u) => (
                <div
                  key={u.urunAdi}
                  className="flex items-center justify-between rounded-2xl bg-bakery-surface px-4 py-3.5 shadow-lg shadow-bakery-coffee-900/10"
                >
                  <span className="text-base font-medium text-bakery-ink-800">{u.urunAdi}</span>
                  <span className="text-xl font-bold text-bakery-amber-600">{u.adet}</span>
                </div>
              ))}
            </div>

            {siparisler.length > 0 && (
              <div className="mt-5">
                <h2 className="mb-2 text-sm font-semibold text-bakery-ink-700">Sipariş Detayı</h2>
                <div className="space-y-2">
                  {siparisler.map((s, i) => (
                    <div key={i} className="rounded-2xl bg-bakery-surface p-3.5 shadow-lg shadow-bakery-coffee-900/10">
                      <p className="mb-1 font-medium text-bakery-ink-900">{s.musteriAdi}</p>
                      <ul className="pl-1 text-sm text-bakery-ink-600">
                        {s.satirlar.map((u, j) => (
                          <li key={j}>
                            {u.adet}× {u.urunAdi}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {okullar.length > 0 && (
              <div className="mt-5">
                <h2 className="mb-2 text-sm font-semibold text-bakery-ink-700">Okul Bazında Dağılım</h2>
                <div className="space-y-2">
                  {okullar.map((o) => (
                    <div key={o.okulAdi} className="rounded-2xl bg-bakery-surface p-3.5 shadow-lg shadow-bakery-coffee-900/10">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium text-bakery-ink-900">{o.okulAdi}</span>
                        <span className="text-sm font-semibold text-bakery-amber-600">{o.toplam} adet</span>
                      </div>
                      <ul className="pl-1 text-sm text-bakery-ink-600">
                        {o.satirlar.map((s, i) => (
                          <li key={i}>
                            {s.adet}× {s.urunAdi}
                            {s.not && <span className="font-medium text-bakery-amber-600"> — {s.not}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
