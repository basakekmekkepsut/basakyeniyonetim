import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Minus, Plus, Search } from 'lucide-react'
import { useUrunler } from '../urunler/data'
import { useGunlukMusteriler, gunlukTopluKaydet, type GunlukTopluSatir } from './data'
import BosDurum from '../../shared/BosDurum'
import { formatTutar } from '../../shared/TutarGoster'
import { gunlukFiyati } from '../../shared/gunlukFiyat'
import { useToast } from '../../shared/Toast'
import { useSession } from '../../lib/session'
import type { GunlukMusteri } from '../../lib/types'

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

interface SatirState {
  odendi: boolean
  miktarlar: Record<string, number>
}

/**
 * Günlük Veresiye için kart kart hızlı giriş — veresiye/GunlukGirisPage'in
 * karşılığı (şablon/un hesabı yok). Kartta müşterinin "sık aldığı ürünler"i,
 * seçilmemişse tüm "Günlük" ürünleri görünür; "+ Ürün" ile o güne eklenir.
 */
export default function GunlukGirisListesiPage() {
  const session = useSession()
  const toast = useToast()
  const { musteriler, yukleniyor: musteriYukleniyor } = useGunlukMusteriler()
  const { urunler } = useUrunler()

  const [tarih, setTarih] = useState(bugunStr())
  const [arama, setArama] = useState('')
  const [satirlar, setSatirlar] = useState<Record<string, SatirState>>({})
  const [ekstraUrunler, setEkstraUrunler] = useState<Record<string, string[]>>({})
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // Enter ile bir sonraki adet kutusuna geçiş (bkz. veresiye/GunlukGirisPage).
  const girisRefleri = useRef<HTMLInputElement[]>([])
  girisRefleri.current = []
  function girisRefineEkle(el: HTMLInputElement | null) {
    if (el) girisRefleri.current.push(el)
  }
  function entereGec(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const index = girisRefleri.current.indexOf(e.currentTarget)
    const sonraki = girisRefleri.current[index + 1]
    if (sonraki) {
      sonraki.focus()
      sonraki.select()
    } else {
      e.currentTarget.blur()
    }
  }

  const aktifMusteriler = useMemo(() => musteriler.filter((m) => m.aktif), [musteriler])
  const gosterilenMusteriler = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    if (!q) return aktifMusteriler
    return aktifMusteriler.filter((m) => m.ad.toLocaleLowerCase('tr-TR').includes(q))
  }, [aktifMusteriler, arama])
  const gunlukUrunleri = useMemo(() => urunler.filter((u) => u.aktif && u.modules.includes('gunluk')), [urunler])

  function satirGetir(musteriId: string): SatirState {
    return satirlar[musteriId] ?? { odendi: false, miktarlar: {} }
  }

  function miktarAyarla(musteriId: string, productId: string, deger: number) {
    setSatirlar((prev) => {
      const satir = prev[musteriId] ?? { odendi: false, miktarlar: {} }
      return { ...prev, [musteriId]: { ...satir, miktarlar: { ...satir.miktarlar, [productId]: Math.max(0, deger) } } }
    })
  }

  function miktarDegistir(musteriId: string, productId: string, delta: number) {
    miktarAyarla(musteriId, productId, (satirGetir(musteriId).miktarlar[productId] ?? 0) + delta)
  }

  function odendiDegistir(musteriId: string, deger: boolean) {
    setSatirlar((prev) => ({ ...prev, [musteriId]: { ...(prev[musteriId] ?? { odendi: false, miktarlar: {} }), odendi: deger } }))
  }

  function gorunurUrunler(m: GunlukMusteri) {
    const sik = m.sikUrunler ?? []
    const taban = sik.length > 0 ? gunlukUrunleri.filter((u) => sik.includes(u.id)) : gunlukUrunleri
    const ekstraIdler = ekstraUrunler[m.id] ?? []
    const ekstra = gunlukUrunleri.filter((u) => ekstraIdler.includes(u.id) && !taban.some((t) => t.id === u.id))
    return [...taban, ...ekstra]
  }

  function urunEkle(musteriId: string, productId: string) {
    if (!productId) return
    setEkstraUrunler((prev) => ({ ...prev, [musteriId]: [...(prev[musteriId] ?? []), productId] }))
  }

  function kartToplami(musteriId: string) {
    return Object.entries(satirGetir(musteriId).miktarlar).reduce((t, [productId, adet]) => {
      if (!adet) return t
      const urun = gunlukUrunleri.find((u) => u.id === productId)
      return t + adet * (urun ? gunlukFiyati(urun) : 0)
    }, 0)
  }

  const doluMusteriler = aktifMusteriler.filter((m) => Object.values(satirGetir(m.id).miktarlar).some((a) => a > 0))
  const genelToplam = doluMusteriler.reduce((t, m) => t + kartToplami(m.id), 0)

  async function handleTumunuKaydet() {
    if (session.status !== 'signed-in') return
    const gonderilecek = doluMusteriler.map((m): GunlukTopluSatir => {
      const satir = satirGetir(m.id)
      const kalemler = Object.entries(satir.miktarlar)
        .filter(([, adet]) => adet > 0)
        .map(([productId, adet]) => {
          const urun = gunlukUrunleri.find((u) => u.id === productId)
          return { productId, urunAdi: urun?.ad ?? '', adet, birimFiyat: urun ? gunlukFiyati(urun) : 0 }
        })
      return { musteriId: m.id, musteriAdi: m.ad, durum: satir.odendi ? 'odendi' : 'veresiye', kalemler }
    })
    if (gonderilecek.length === 0) {
      toast.hata('Kaydedilecek bir miktar girmediniz.')
      return
    }

    setKaydediliyor(true)
    try {
      const sayisi = await gunlukTopluKaydet(gonderilecek, tarih, { uid: session.user.uid })
      toast.basari(`${gonderilecek.length} müşteri için ${sayisi} kayıt oluşturuldu.`)
      setSatirlar({})
      setEkstraUrunler({})
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setKaydediliyor(false)
    }
  }

  if (musteriYukleniyor) return <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-bakery-ink-400" />
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Müşteri ara…"
            className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-surface py-2 pl-8 pr-3 text-sm outline-none focus:border-bakery-amber-500"
          />
        </div>
        <input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
        />
      </div>

      {aktifMusteriler.length === 0 ? (
        <BosDurum baslik="Günlük müşteri yok" aciklama="Günlük Veresiye > Müşteriler’den müşteri ekleyin." />
      ) : gunlukUrunleri.length === 0 ? (
        <BosDurum baslik="Günlük ürünü yok" aciklama="Günlük Veresiye > Ürünler’den bir ürünü “Günlük Veresiye” olarak işaretleyin." />
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5 xl:grid-cols-6">
          {gosterilenMusteriler.map((m) => {
            const satir = satirGetir(m.id)
            const gosterilenUrunler = gorunurUrunler(m)
            const eklenebilirUrunler = gunlukUrunleri.filter((u) => !gosterilenUrunler.some((g) => g.id === u.id))
            const toplam = kartToplami(m.id)

            return (
              <div
                key={m.id}
                className={`rounded-lg bg-bakery-surface p-1.5 shadow-sm shadow-bakery-coffee-900/5 ${
                  toplam > 0 ? 'ring-1 ring-bakery-amber-500/60' : ''
                }`}
              >
                <p className="mb-1 truncate text-[11px] font-medium leading-tight text-bakery-ink-900">{m.ad}</p>

                <div className="space-y-1">
                  {gosterilenUrunler.map((u) => (
                    <div key={u.id}>
                      <p className="truncate text-[9px] leading-tight text-bakery-ink-500">{u.ad}</p>
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={`${m.ad} ${u.ad} azalt`}
                          onClick={() => miktarDegistir(m.id, u.id, -1)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bakery-cream-100 text-bakery-ink-600 hover:bg-bakery-cream-200"
                        >
                          <Minus size={10} />
                        </button>
                        <input
                          ref={girisRefineEkle}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          aria-label={`${m.ad} ${u.ad} adet`}
                          value={satir.miktarlar[u.id] ?? 0}
                          onChange={(e) => miktarAyarla(m.id, u.id, Math.round(Number(e.target.value)) || 0)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={entereGec}
                          className="w-6 min-w-0 rounded border border-bakery-cream-200 bg-bakery-cream-50 px-0 py-0.5 text-center text-[11px] font-medium text-bakery-ink-900 outline-none focus:border-bakery-amber-500 focus:ring-1 focus:ring-bakery-amber-500/30"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={`${m.ad} ${u.ad} artır`}
                          onClick={() => miktarDegistir(m.id, u.id, 1)}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bakery-amber-500/15 text-bakery-amber-600 hover:bg-bakery-amber-500/25"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {eklenebilirUrunler.length > 0 && (
                  <select
                    value=""
                    tabIndex={-1}
                    onChange={(e) => urunEkle(m.id, e.target.value)}
                    className="mt-1 w-full rounded border border-dashed border-bakery-cream-300 bg-transparent px-0.5 py-0.5 text-[8px] text-bakery-ink-500 outline-none focus:border-bakery-amber-500"
                  >
                    <option value="">+ Ürün</option>
                    {eklenebilirUrunler.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.ad}
                      </option>
                    ))}
                  </select>
                )}

                <div className="mt-1 flex items-center justify-between gap-0.5 border-t border-bakery-cream-100 pt-1">
                  <label className="flex items-center gap-0.5 text-[8px] text-bakery-ink-500" title="Peşin ödendi (bakiyeye yazılmaz)">
                    <input
                      type="checkbox"
                      checked={satir.odendi}
                      onChange={(e) => odendiDegistir(m.id, e.target.checked)}
                      className="h-3 w-3 shrink-0"
                    />
                    Ödendi
                  </label>
                  <span className="truncate text-[10px] font-semibold text-bakery-ink-900">{formatTutar(toplam)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {aktifMusteriler.length > 0 && gunlukUrunleri.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-10 border-t border-bakery-cream-200 bg-bakery-surface/95 px-4 py-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
            <span className="text-sm text-bakery-ink-600">
              {doluMusteriler.length > 0
                ? `${doluMusteriler.length} müşteri · ${formatTutar(genelToplam)}`
                : 'Henüz miktar girilmedi'}
            </span>
            <button
              onClick={handleTumunuKaydet}
              disabled={kaydediliyor || doluMusteriler.length === 0}
              className="rounded-lg bg-bakery-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-bakery-amber-500 disabled:opacity-50"
            >
              {kaydediliyor ? 'Kaydediliyor…' : 'Tümünü Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
