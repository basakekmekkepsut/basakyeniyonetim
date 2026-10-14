import { useState, type FormEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import MusteriSecici from '../../shared/MusteriSecici'
import { useUrunler } from '../urunler/data'
import { yeniHatId } from './data'
import type { OkulHat, OkulSchool, OkulSchoolFormVerisi } from '../../lib/types'

// Date.getDay() ile aynı sırayla (0=Pazar) ama ekranda Pazartesi'den başlayan,
// bakery haftasına daha uygun bir sırayla gösterilir.
const GUN_SECENEKLERI: { gun: number; etiket: string }[] = [
  { gun: 1, etiket: 'Pzt' },
  { gun: 2, etiket: 'Sal' },
  { gun: 3, etiket: 'Çar' },
  { gun: 4, etiket: 'Per' },
  { gun: 5, etiket: 'Cum' },
  { gun: 6, etiket: 'Cmt' },
  { gun: 0, etiket: 'Paz' }
]
const TUM_GUNLER = GUN_SECENEKLERI.map((g) => g.gun)

interface Props {
  mevcut?: OkulSchool
  onKaydet: (veri: OkulSchoolFormVerisi) => Promise<void>
  onKapat: () => void
}

export default function OkulFormModal({ mevcut, onKaydet, onKapat }: Props) {
  const { urunler } = useUrunler()
  const [ad, setAd] = useState(mevcut?.ad ?? '')
  const [musteriId, setMusteriId] = useState(mevcut?.musteriId ?? null as string | null)
  const [lines, setLines] = useState<OkulHat[]>(mevcut?.lines ?? [])
  const [acikGunler, setAcikGunler] = useState<number[]>(mevcut?.acikGunler ?? TUM_GUNLER)
  const [okulDegil, setOkulDegil] = useState(mevcut?.okulDegil ?? false)
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  function gunDegistir(gun: number) {
    setAcikGunler((prev) => (prev.includes(gun) ? prev.filter((g) => g !== gun) : [...prev, gun]))
  }

  const okulUrunleri = urunler.filter((u) => u.aktif && u.modules.includes('okul'))

  function hatEkle() {
    setLines((prev) => [...prev, { id: yeniHatId(), productId: '', urunAdi: '', adet: 1, aktif: true, gunler: TUM_GUNLER }])
  }

  function hatGuncelle(id: string, degisiklik: Partial<OkulHat>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...degisiklik } : l)))
  }

  function hatGunDegistir(id: string, gun: number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const mevcutGunler = l.gunler ?? TUM_GUNLER
        const yeniGunler = mevcutGunler.includes(gun) ? mevcutGunler.filter((g) => g !== gun) : [...mevcutGunler, gun]
        return { ...l, gunler: yeniGunler }
      })
    )
  }

  // "Dönen gün": haftada yalnızca bir gün verilen ama bu günün listede her
  // hafta bir sonrakine kaydığı hatlar için (ör. haftada 1 gün simit — bu
  // hafta Cuma, gelecek hafta Salı, ...). Açıldığında statik gunler'in yerine
  // geçer (bkz. orderData.ts hatDonenGunuHesapla).
  function hatDonguModuDegistir(id: string, acik: boolean) {
    hatGuncelle(id, acik ? { donguGunleri: [], donguReferansTarihi: '' } : { donguGunleri: undefined, donguReferansTarihi: undefined })
  }

  function hatDonguGunDegistir(id: string, gun: number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const mevcut = l.donguGunleri ?? []
        const yeni = mevcut.includes(gun) ? mevcut.filter((g) => g !== gun) : [...mevcut, gun]
        yeni.sort((a, b) => TUM_GUNLER.indexOf(a) - TUM_GUNLER.indexOf(b))
        return { ...l, donguGunleri: yeni }
      })
    )
  }

  function hatSil(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function urunSec(id: string, productId: string) {
    const urun = urunler.find((u) => u.id === productId)
    hatGuncelle(id, { productId, urunAdi: urun?.ad ?? '' })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ad.trim()) return setHata('Okul adı zorunludur.')
    const gecerliHatlar = lines.filter((l) => l.productId)
    for (const l of gecerliHatlar) {
      if (!l.donguGunleri || l.donguGunleri.length === 0) continue
      if (!l.donguReferansTarihi) return setHata(`"${l.urunAdi || 'Hat'}" için dönen gün referans tarihi seçilmeli.`)
      const referansGun = new Date(l.donguReferansTarihi).getDay()
      if (!l.donguGunleri.includes(referansGun)) {
        return setHata(`"${l.urunAdi || 'Hat'}" referans tarihi, işaretlediğiniz günlerden birine denk gelmeli.`)
      }
    }
    setHata(null)
    setGonderiliyor(true)
    try {
      await onKaydet({
        ad: ad.trim(),
        musteriId,
        lines: gecerliHatlar,
        acikGunler,
        okulDegil
      })
      onKapat()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <form onSubmit={handleSubmit} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-bakery-surface p-5 shadow-xl md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-ink-900">{mevcut ? 'Okulu Düzenle' : 'Yeni Okul'}</h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-ink-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Okul Adı *</label>
            <input
              type="text"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              required
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
            <label className="mt-1.5 flex items-center gap-1.5 text-sm text-bakery-ink-600">
              <input type="checkbox" checked={okulDegil} onChange={(e) => setOkulDegil(e.target.checked)} />
              Bu aslında bir okul değil — günlük sabit siparişi olan normal bir müşteri (ör. aşevi, fabrika)
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Veresiye Hesabı</label>
            <MusteriSecici
              modul="veresiye"
              seciliMusteriId={musteriId}
              hepsiSecenegi
              onHepsiSec={() => setMusteriId(null)}
              placeholder="Yok"
              onSec={(m) => setMusteriId(m.id)}
            />
            <p className="mt-1 text-xs text-bakery-ink-500">
              Günü Kapat'ta bu okulun teslimat tutarı, seçilen müşterinin Veresiye hesabına otomatik yansır. Birden
              fazla okul aynı kurum tarafından ödeniyorsa hepsine aynı müşteriyi seçin — hepsi tek hesapta toplanır.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800">Açık Günler</label>
            <div className="flex flex-wrap gap-1.5">
              {GUN_SECENEKLERI.map(({ gun, etiket }) => (
                <button
                  type="button"
                  key={gun}
                  onClick={() => gunDegistir(gun)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    acikGunler.includes(gun)
                      ? 'bg-bakery-amber-600 text-white'
                      : 'bg-bakery-cream-100 text-bakery-ink-400 hover:bg-bakery-cream-200'
                  }`}
                >
                  {etiket}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-bakery-ink-500">
              Kapalı günlerde sipariş adedi otomatik olarak 0 gelir, açık günlerde hattın standart adedi doldurulur.
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-bakery-ink-800">Hatlar (ürün + günlük adet — 0 = sadece sipariş gelince elle girilir)</label>
              <button type="button" onClick={hatEkle} className="flex items-center gap-1 text-sm font-medium text-bakery-amber-600 hover:text-bakery-amber-500">
                <Plus size={14} />
                Hat Ekle
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="rounded-lg bg-bakery-cream-50 px-3 py-3 text-sm text-bakery-ink-400">Henüz hat eklenmedi.</p>
            ) : (
              <div className="space-y-2">
                {lines.map((l) => (
                  <div key={l.id} className="rounded-lg bg-bakery-cream-50 p-2.5">
                    <div className="mb-2 flex items-center gap-2">
                      <select
                        value={l.productId}
                        onChange={(e) => urunSec(l.id, e.target.value)}
                        className="flex-1 rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5 text-sm outline-none focus:border-bakery-amber-500"
                      >
                        <option value="">Ürün seçin…</option>
                        {okulUrunleri.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.ad}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={l.adet}
                        onChange={(e) => hatGuncelle(l.id, { adet: Number(e.target.value) })}
                        className="w-16 rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5 text-center text-sm outline-none focus:border-bakery-amber-500"
                      />
                      <button type="button" onClick={() => hatSil(l.id)} className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-bakery-ink-600">
                        <input type="checkbox" checked={l.aktif} onChange={(e) => hatGuncelle(l.id, { aktif: e.target.checked })} />
                        Aktif
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-bakery-ink-600">
                        <input
                          type="checkbox"
                          checked={Boolean(l.donguGunleri)}
                          onChange={(e) => hatDonguModuDegistir(l.id, e.target.checked)}
                        />
                        Dönen gün (haftadan haftaya kayan tek gün)
                      </label>
                    </div>

                    {l.donguGunleri ? (
                      <div className="mt-1.5 space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {GUN_SECENEKLERI.map(({ gun, etiket }) => (
                            <button
                              type="button"
                              key={gun}
                              onClick={() => hatDonguGunDegistir(l.id, gun)}
                              className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium transition ${
                                l.donguGunleri!.includes(gun)
                                  ? 'bg-bakery-amber-500/20 text-bakery-amber-700'
                                  : 'bg-bakery-cream-100 text-bakery-ink-400'
                              }`}
                            >
                              {etiket}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <label className="text-[11px] text-bakery-ink-500">Referans tarih:</label>
                          <input
                            type="date"
                            value={l.donguReferansTarihi ?? ''}
                            onChange={(e) => hatGuncelle(l.id, { donguReferansTarihi: e.target.value })}
                            className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1 text-xs outline-none focus:border-bakery-amber-500"
                          />
                        </div>
                        <p className="text-[11px] text-bakery-ink-500">
                          Yukarıdaki günler arasında SIRAYLA haftadan haftaya kayar. Referans tarih, seçili günlerden
                          birine denk gelen, GERÇEKTEN o gün verilmiş/verilecek bir tarih olmalı — sistem oradan
                          geçmiş/gelecek haftaların hangi güne denk geldiğini otomatik hesaplar.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {GUN_SECENEKLERI.map(({ gun, etiket }) => (
                            <button
                              type="button"
                              key={gun}
                              onClick={() => hatGunDegistir(l.id, gun)}
                              className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium transition ${
                                (l.gunler ?? TUM_GUNLER).includes(gun)
                                  ? 'bg-bakery-amber-500/20 text-bakery-amber-700'
                                  : 'bg-bakery-cream-100 text-bakery-ink-400'
                              }`}
                            >
                              {etiket}
                            </button>
                          ))}
                        </div>
                        {(l.gunler ?? TUM_GUNLER).length < 7 && (
                          <p className="mt-1 text-[11px] text-bakery-ink-500">
                            Bu ürün yalnızca işaretli günlerde gider — diğer günlerde otomatik 0 gelir (okul kapalıysa zaten geçerli).
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

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
