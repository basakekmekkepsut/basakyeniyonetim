import { useMemo, useState } from 'react'
import { Minus, Plus, Zap } from 'lucide-react'
import { useMusteriler } from '../musteriler/data'
import { useUrunler } from '../urunler/data'
import { useVeresiyeSablonlar } from './sablonData'
import { gunlukGirisKaydet, type GunlukGirisSatiri } from './data'
import { unOdemesiEkle } from './unHesabiData'
import BosDurum from '../../shared/BosDurum'
import { formatTutar } from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { useSession } from '../../lib/session'
import { unHesabiAktifMi } from '../../shared/unHesabi'
import { useVeresiyeMusteriFiltresi } from '../../shared/veresiyeErisim'
import type { Musteri } from '../../lib/types'

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

interface SatirState {
  odendi: boolean
  miktarlar: Record<string, number>
}

export default function GunlukGirisPage() {
  const session = useSession()
  const toast = useToast()
  const { musteriler, yukleniyor: musteriYukleniyor } = useMusteriler()
  const { urunler } = useUrunler()
  const { sablonlar } = useVeresiyeSablonlar()
  const musteriFiltresi = useVeresiyeMusteriFiltresi()

  const [tarih, setTarih] = useState(bugunStr())
  const [satirlar, setSatirlar] = useState<Record<string, SatirState>>({})
  const [cuvalGirisleri, setCuvalGirisleri] = useState<Record<string, number>>({})
  const [ekstraUrunler, setEkstraUrunler] = useState<Record<string, string[]>>({})
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const veresiyeMusterileri = useMemo(
    () => musteriler.filter((m) => m.aktif && m.moduller.includes('veresiye') && musteriFiltresi(m)),
    [musteriler, musteriFiltresi]
  )
  const veresiyeUrunleri = useMemo(() => urunler.filter((u) => u.aktif && u.modules.includes('veresiye')), [urunler])

  function satirGetir(musteriId: string): SatirState {
    return satirlar[musteriId] ?? { odendi: false, miktarlar: {} }
  }

  function miktarDegistir(musteriId: string, productId: string, delta: number) {
    setSatirlar((prev) => {
      const satir = satirGetir(musteriId)
      const yeniMiktar = Math.max(0, (satir.miktarlar[productId] ?? 0) + delta)
      return { ...prev, [musteriId]: { ...satir, miktarlar: { ...satir.miktarlar, [productId]: yeniMiktar } } }
    })
  }

  function miktarAyarla(musteriId: string, productId: string, deger: number) {
    setSatirlar((prev) => {
      const satir = satirGetir(musteriId)
      return { ...prev, [musteriId]: { ...satir, miktarlar: { ...satir.miktarlar, [productId]: Math.max(0, deger) } } }
    })
  }

  function odendiDegistir(musteriId: string, deger: boolean) {
    setSatirlar((prev) => ({ ...prev, [musteriId]: { ...satirGetir(musteriId), odendi: deger } }))
  }

  function musteriSablonu(musteriId: string) {
    return sablonlar.find((s) => s.musteriId === musteriId && s.aktif)
  }

  // Öncelik: müşterinin aktif Giriş Şablonu'ndaki ürünler. Şablon yoksa müşteri
  // kartındaki "sık ürünler" seçimi, o da yoksa tüm veresiye ürünleri gösterilir.
  function gorunurUrunler(m: Musteri) {
    const sablon = musteriSablonu(m.id)
    const tabanIdler = sablon ? sablon.kalemler.map((k) => k.productId) : m.sikUrunler?.length ? m.sikUrunler : null
    const taban = tabanIdler ? veresiyeUrunleri.filter((u) => tabanIdler.includes(u.id)) : veresiyeUrunleri
    const ekstraIdler = ekstraUrunler[m.id] ?? []
    const ekstra = veresiyeUrunleri.filter((u) => ekstraIdler.includes(u.id) && !taban.some((t) => t.id === u.id))
    return [...taban, ...ekstra]
  }

  function urunEkle(musteriId: string, productId: string) {
    if (!productId) return
    setEkstraUrunler((prev) => ({ ...prev, [musteriId]: [...(prev[musteriId] ?? []), productId] }))
  }

  function sablonYukle(musteriId: string) {
    const sablon = sablonlar.find((s) => s.musteriId === musteriId && s.aktif)
    if (!sablon) return
    setSatirlar((prev) => {
      const satir = satirGetir(musteriId)
      const miktarlar = { ...satir.miktarlar }
      for (const k of sablon.kalemler) miktarlar[k.productId] = k.adet
      return { ...prev, [musteriId]: { ...satir, miktarlar } }
    })
    setEkstraUrunler((prev) => ({
      ...prev,
      [musteriId]: [...new Set([...(prev[musteriId] ?? []), ...sablon.kalemler.map((k) => k.productId)])]
    }))
  }

  const doluSatirSayisi =
    Object.values(satirlar).filter((s) => Object.values(s.miktarlar).some((a) => a > 0)).length +
    Object.values(cuvalGirisleri).filter((c) => c > 0).length

  async function handleTumunuKaydet() {
    if (session.status !== 'signed-in') return
    const gonderilecek: GunlukGirisSatiri[] = veresiyeMusterileri
      .map((m) => {
        const satir = satirGetir(m.id)
        const kalemler = Object.entries(satir.miktarlar)
          .filter(([, adet]) => adet > 0)
          .map(([productId, adet]) => {
            const urun = veresiyeUrunleri.find((u) => u.id === productId)
            const birimFiyat = m.ozelFiyatlar[productId] ?? urun?.fiyat ?? 0
            return { productId, urunAdi: urun?.ad ?? '', adet, birimFiyat }
          })
        return { musteriId: m.id, musteriAdi: m.ad, kalemler, odendi: satir.odendi, tarih }
      })
      .filter((s) => s.kalemler.length > 0)

    const cuvalSatirlari = veresiyeMusterileri
      .filter((m) => unHesabiAktifMi(m) && (cuvalGirisleri[m.id] ?? 0) > 0 && m.unHesabi?.adetPerCuval)
      .map((m) => ({
        musteriId: m.id,
        musteriAdi: m.ad,
        cuvalSayisi: cuvalGirisleri[m.id],
        adetPerCuval: m.unHesabi!.adetPerCuval!
      }))

    if (gonderilecek.length === 0 && cuvalSatirlari.length === 0) {
      toast.hata('Kaydedilecek bir miktar girmediniz.')
      return
    }

    setKaydediliyor(true)
    try {
      const sayisi = gonderilecek.length
        ? await gunlukGirisKaydet(gonderilecek, veresiyeMusterileri, veresiyeUrunleri, { uid: session.user.uid })
        : 0
      for (const c of cuvalSatirlari) {
        await unOdemesiEkle({ musteriId: c.musteriId, musteriAdi: c.musteriAdi, tarih, cuvalSayisi: c.cuvalSayisi, adetPerCuval: c.adetPerCuval }, { uid: session.user.uid })
      }
      const parcalar = [sayisi > 0 ? `${sayisi} kayıt` : null, cuvalSatirlari.length > 0 ? `${cuvalSatirlari.length} un ödemesi` : null].filter(Boolean)
      toast.basari(`${parcalar.join(' ve ')} oluşturuldu ve hesaplara yansıtıldı.`)
      setSatirlar({})
      setCuvalGirisleri({})
      setEkstraUrunler({})
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setKaydediliyor(false)
    }
  }

  if (musteriYukleniyor) return <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-bakery-coffee-900">Günlük Giriş</h2>
        <input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="rounded-lg border border-bakery-cream-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
        />
      </div>

      {veresiyeMusterileri.length === 0 ? (
        <BosDurum baslik="Veresiye müşterisi yok" aciklama="Ayarlar > Müşteriler'den bir müşteriyi Veresiye modülüne ekleyin." />
      ) : veresiyeUrunleri.length === 0 ? (
        <BosDurum baslik="Veresiye ürünü yok" aciklama="Ayarlar > Ürünler'den bir ürünü Veresiye modülüne ekleyin." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {veresiyeMusterileri.map((m) => {
            const satir = satirGetir(m.id)
            const gosterilenUrunler = gorunurUrunler(m)
            const eklenebilirUrunler = veresiyeUrunleri.filter((u) => !gosterilenUrunler.some((g) => g.id === u.id))
            const toplam = Object.entries(satir.miktarlar).reduce((s, [productId, adet]) => {
              if (!adet) return s
              const urun = veresiyeUrunleri.find((u) => u.id === productId)
              return s + adet * (m.ozelFiyatlar[productId] ?? urun?.fiyat ?? 0)
            }, 0)
            const sablonVarMi = !!musteriSablonu(m.id)
            const unMusterisi = unHesabiAktifMi(m)

            return (
              <div key={m.id} className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-bakery-coffee-900">{m.ad}</p>
                    {unMusterisi && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
                        Un Hesabı
                      </span>
                    )}
                  </div>
                  {sablonVarMi && (
                    <button
                      onClick={() => sablonYukle(m.id)}
                      tabIndex={-1}
                      className="flex items-center gap-1 rounded-full bg-bakery-amber-500/10 px-2 py-1 text-xs font-medium text-bakery-amber-600 hover:bg-bakery-amber-500/20"
                    >
                      <Zap size={12} />
                      Şablon
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {gosterilenUrunler.map((u) => (
                    <div key={u.id} className="flex items-center justify-between">
                      <span className="text-sm text-bakery-coffee-600">{u.ad}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={`${m.ad} ${u.ad} azalt`}
                          onClick={() => miktarDegistir(m.id, u.id, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-bakery-cream-100 text-bakery-coffee-600 hover:bg-bakery-cream-200"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          aria-label={`${m.ad} ${u.ad} adet`}
                          value={satir.miktarlar[u.id] ?? 0}
                          onChange={(e) => miktarAyarla(m.id, u.id, Math.round(Number(e.target.value)) || 0)}
                          onFocus={(e) => e.target.select()}
                          className="w-12 rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-1 py-1 text-center text-sm font-medium text-bakery-coffee-900 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={`${m.ad} ${u.ad} artır`}
                          onClick={() => miktarDegistir(m.id, u.id, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-bakery-amber-500/15 text-bakery-amber-600 hover:bg-bakery-amber-500/25"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {unMusterisi && m.unHesabi?.adetPerCuval && (
                    <div className="flex items-center justify-between border-t border-dashed border-bakery-cream-200 pt-2">
                      <span className="text-sm text-bakery-coffee-600">Çuval (un ödemesi)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step="0.1"
                        aria-label={`${m.ad} çuval`}
                        value={cuvalGirisleri[m.id] ?? 0}
                        onChange={(e) => setCuvalGirisleri((prev) => ({ ...prev, [m.id]: Math.max(0, Number(e.target.value) || 0) }))}
                        onFocus={(e) => e.target.select()}
                        className="w-16 rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-1 py-1 text-center text-sm font-medium text-bakery-coffee-900 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
                      />
                    </div>
                  )}
                </div>

                {eklenebilirUrunler.length > 0 && (
                  <select
                    value=""
                    tabIndex={-1}
                    onChange={(e) => urunEkle(m.id, e.target.value)}
                    className="mt-2 w-full rounded-lg border border-dashed border-bakery-cream-300 bg-transparent px-2 py-1 text-xs text-bakery-coffee-500 outline-none focus:border-bakery-amber-500"
                  >
                    <option value="">+ Ürün Ekle</option>
                    {eklenebilirUrunler.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.ad}
                      </option>
                    ))}
                  </select>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-bakery-cream-100 pt-2.5">
                  {unMusterisi ? (
                    <span className="text-xs text-bakery-coffee-500">Ücretsiz — un hesabına eklenecek</span>
                  ) : (
                    <label className="flex items-center gap-1.5 text-sm text-bakery-coffee-600">
                      <input type="checkbox" checked={satir.odendi} onChange={(e) => odendiDegistir(m.id, e.target.checked)} />
                      Ödendi
                    </label>
                  )}
                  <span className="text-sm font-semibold text-bakery-coffee-900">
                    {unMusterisi ? '' : formatTutar(toplam)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {veresiyeMusterileri.length > 0 && veresiyeUrunleri.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-10 border-t border-bakery-cream-200 bg-white/95 px-4 py-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <span className="text-sm text-bakery-coffee-600">
              {doluSatirSayisi > 0 ? `${doluSatirSayisi} müşteri için giriş hazır` : 'Henüz miktar girilmedi'}
            </span>
            <button
              onClick={handleTumunuKaydet}
              disabled={kaydediliyor || doluSatirSayisi === 0}
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
