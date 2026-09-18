import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useMusteriler } from '../musteriler/data'
import { useUrunler } from '../urunler/data'
import { useOkullar } from '../okul/data'
import { useVeresiyeSablonlar } from './sablonData'
import { gunlukGirisKaydet, type GunlukGirisSatiri } from './data'
import { unOdemesiEkle } from './unHesabiData'
import BosDurum from '../../shared/BosDurum'
import { formatTutar } from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { useSession } from '../../lib/session'
import { unHesabiAktifMi } from '../../shared/unHesabi'
import { veresiyeBildirimGonder } from '../../shared/veresiyeBildirim'
import { tarihGunAdiIle } from '../../shared/tarih'
import type { Musteri } from '../../lib/types'

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

/** "Tümünü Kaydet" başarılı olduktan SONRA çağrılır. */
async function bildirimGonder(
  gonderilecek: GunlukGirisSatiri[],
  cuvalSatirlari: { musteriAdi: string; cuvalSayisi: number }[],
  tarih: string
) {
  const satirlar: string[] = []
  let toplam = 0
  for (const s of gonderilecek) {
    for (const k of s.kalemler) {
      const tutar = k.adet * k.birimFiyat
      toplam += tutar
      satirlar.push(`${s.musteriAdi} — ${k.urunAdi} × ${k.adet} = ${formatTutar(tutar)}`)
    }
  }
  for (const c of cuvalSatirlari) {
    satirlar.push(`${c.musteriAdi} — ${c.cuvalSayisi} çuval`)
  }
  if (satirlar.length === 0) return

  const baslik = '📝 Günlük Giriş Kaydedildi'
  const ozet = `${tarihGunAdiIle(tarih)} — ${satirlar.length} satır, toplam ${formatTutar(toplam)}`
  await veresiyeBildirimGonder(baslik, ozet, satirlar)
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
  const { okullar } = useOkullar()

  const [tarih, setTarih] = useState(bugunStr())
  const [satirlar, setSatirlar] = useState<Record<string, SatirState>>({})
  const [cuvalGirisleri, setCuvalGirisleri] = useState<Record<string, number>>({})
  const [ekstraUrunler, setEkstraUrunler] = useState<Record<string, string[]>>({})
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // Enter tuşuyla bir sonraki miktar kutusuna geçiş için — render sırasına göre
  // doldurulan düz bir referans listesi (bkz. girisRefineEkle / entereGec).
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

  // Eski kayıtlarda kalem başına "aktif" alanı olmayabilir — belirtilmemişse
  // açık kabul edilir (bkz. sablonData.ts sablonSatirlariniCikar).
  function musterininAktifKalemleri(musteriId: string) {
    return sablonlar.find((s) => s.musteriId === musteriId)?.kalemler.filter((k) => k.aktif !== false) ?? []
  }

  // Giriş Şablonu'nda bir müşterinin TÜM kalemleri bilerek pasif yapılmışsa
  // (ör. artık Okul modülü üzerinden otomatik yansıyan bir müşteri), bunu
  // "şablonu yok, tüm ürünleri göster"le KARIŞTIRMAYIP müşteriyi Günlük
  // Giriş'ten tamamen çıkarıyoruz — aksi halde Ayarlar > Müşteriler'deki "sık
  // ürünler" ayarına düşüp yine de kart olarak görünmeye devam ediyordu.
  function tumKalemleriPasif(musteriId: string): boolean {
    const sablon = sablonlar.find((s) => s.musteriId === musteriId)
    return Boolean(sablon && sablon.kalemler.length > 0 && musterininAktifKalemleri(musteriId).length === 0)
  }

  // Bir okulun veresiye hesabı olarak bağlanmış müşteriler (musteriId) —
  // bunların veresiye kayıtları YALNIZCA Okul modülünün "Günü Kapat" akışından
  // gelir; manuel Günlük Giriş'te görünmeleri "hiç şablon eklemedim ama tüm
  // ürünlerle otomatik çıktı" şaşkınlığına yol açıyordu, o yüzden tamamen hariç
  // tutuluyorlar (bkz. okul/orderData.ts gunuKapat).
  const okulMusteriIdleri = useMemo(() => new Set(okullar.map((o) => o.musteriId).filter((id): id is string => Boolean(id))), [okullar])

  const veresiyeMusterileri = useMemo(() => {
    const siraGetir = (m: Musteri) => {
      const kalemler = musterininAktifKalemleri(m.id)
      if (kalemler.length === 0) return undefined
      return Math.min(...kalemler.map((k) => k.sira ?? 0))
    }
    return musteriler
      .filter(
        (m) => m.aktif && m.moduller.includes('veresiye') && !tumKalemleriPasif(m.id) && !okulMusteriIdleri.has(m.id)
      )
      .sort((a, b) => {
        const sa = siraGetir(a)
        const sb = siraGetir(b)
        if (sa != null && sb != null) return sa - sb
        if (sa != null) return -1
        if (sb != null) return 1
        return a.ad.localeCompare(b.ad, 'tr-TR')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musteriler, sablonlar, okulMusteriIdleri])
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

  // Öncelik: müşterinin aktif Giriş Şablonu satırlarındaki ürünler. Şablon yoksa
  // müşteri kartındaki "sık ürünler" seçimi, o da yoksa tüm veresiye ürünleri gösterilir.
  function gorunurUrunler(m: Musteri) {
    const aktifKalemler = musterininAktifKalemleri(m.id)
    const tabanIdler = aktifKalemler.length > 0 ? aktifKalemler.map((k) => k.productId) : m.sikUrunler?.length ? m.sikUrunler : null
    const taban = tabanIdler ? veresiyeUrunleri.filter((u) => tabanIdler.includes(u.id)) : veresiyeUrunleri
    const ekstraIdler = ekstraUrunler[m.id] ?? []
    const ekstra = veresiyeUrunleri.filter((u) => ekstraIdler.includes(u.id) && !taban.some((t) => t.id === u.id))
    return [...taban, ...ekstra]
  }

  function urunEkle(musteriId: string, productId: string) {
    if (!productId) return
    setEkstraUrunler((prev) => ({ ...prev, [musteriId]: [...(prev[musteriId] ?? []), productId] }))
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
      bildirimGonder(gonderilecek, cuvalSatirlari, tarih)
      setSatirlar({})
      setCuvalGirisleri({})
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
        <h2 className="text-lg font-semibold text-bakery-ink-900">Günlük Giriş</h2>
        <input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
        />
      </div>

      {veresiyeMusterileri.length === 0 ? (
        <BosDurum baslik="Veresiye müşterisi yok" aciklama="Ayarlar > Müşteriler'den bir müşteriyi Veresiye modülüne ekleyin." />
      ) : veresiyeUrunleri.length === 0 ? (
        <BosDurum baslik="Veresiye ürünü yok" aciklama="Ayarlar > Ürünler'den bir ürünü Veresiye modülüne ekleyin." />
      ) : (
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2 lg:grid-cols-5 xl:grid-cols-6">
          {veresiyeMusterileri.map((m) => {
            const satir = satirGetir(m.id)
            const gosterilenUrunler = gorunurUrunler(m)
            const eklenebilirUrunler = veresiyeUrunleri.filter((u) => !gosterilenUrunler.some((g) => g.id === u.id))
            const toplam = Object.entries(satir.miktarlar).reduce((s, [productId, adet]) => {
              if (!adet) return s
              const urun = veresiyeUrunleri.find((u) => u.id === productId)
              return s + adet * (m.ozelFiyatlar[productId] ?? urun?.fiyat ?? 0)
            }, 0)
            const unMusterisi = unHesabiAktifMi(m)

            return (
              <div key={m.id} className="rounded-lg bg-bakery-surface p-1.5 shadow-sm shadow-bakery-coffee-900/5">
                <div className="mb-1 flex items-center gap-1">
                  <p className="truncate text-[11px] font-medium leading-tight text-bakery-ink-900">{m.ad}</p>
                  {unMusterisi && <span className="shrink-0 text-[9px] font-medium text-blue-600">Un</span>}
                </div>

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

                  {unMusterisi && m.unHesabi?.adetPerCuval && (
                    <div className="border-t border-dashed border-bakery-cream-200 pt-1">
                      <p className="truncate text-[9px] leading-tight text-bakery-ink-500">Çuval</p>
                      <input
                        ref={girisRefineEkle}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step="0.1"
                        aria-label={`${m.ad} çuval`}
                        value={cuvalGirisleri[m.id] ?? 0}
                        onChange={(e) => setCuvalGirisleri((prev) => ({ ...prev, [m.id]: Math.max(0, Number(e.target.value) || 0) }))}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={entereGec}
                        className="w-full rounded border border-bakery-cream-200 bg-bakery-cream-50 px-0 py-0.5 text-center text-[11px] font-medium text-bakery-ink-900 outline-none focus:border-bakery-amber-500 focus:ring-1 focus:ring-bakery-amber-500/30"
                      />
                    </div>
                  )}
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
                  {unMusterisi ? (
                    <span className="text-[8px] leading-tight text-bakery-ink-500">Ücretsiz</span>
                  ) : (
                    <input
                      type="checkbox"
                      title="Ödendi"
                      checked={satir.odendi}
                      onChange={(e) => odendiDegistir(m.id, e.target.checked)}
                      className="h-3 w-3 shrink-0"
                    />
                  )}
                  <span className="truncate text-[10px] font-semibold text-bakery-ink-900">
                    {unMusterisi ? '' : formatTutar(toplam)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {veresiyeMusterileri.length > 0 && veresiyeUrunleri.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-10 border-t border-bakery-cream-200 bg-bakery-surface/95 px-4 py-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <span className="text-sm text-bakery-ink-600">
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
