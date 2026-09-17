import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import MusteriSecici from '../../shared/MusteriSecici'
import { useUrunler } from '../urunler/data'
import { useMusteriler } from '../musteriler/data'
import { unHesabiAktifMi } from '../../shared/unHesabi'
import type { VeresiyeDurumu, VeresiyeKaydi } from '../../lib/types'
import type { VeresiyeKaydiFormVerisi } from './data'

interface Props {
  mevcut?: VeresiyeKaydi
  onKaydet: (veri: VeresiyeKaydiFormVerisi) => Promise<void>
  onKapat: () => void
}

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function VeresiyeKayitFormModal({ mevcut, onKaydet, onKapat }: Props) {
  const { urunler } = useUrunler()
  const { musteriler } = useMusteriler()
  const [musteriId, setMusteriId] = useState(mevcut?.musteriId ?? '')
  const [musteriAdi, setMusteriAdi] = useState(mevcut?.musteriAdi ?? '')
  const [productId, setProductId] = useState(mevcut?.productId ?? '')
  const [urunAdi, setUrunAdi] = useState(mevcut?.urunAdi ?? '')
  const [adet, setAdet] = useState(mevcut ? String(mevcut.adet) : '')
  const [birimFiyat, setBirimFiyat] = useState(mevcut?.birimFiyat ?? 0)
  const [tarih, setTarih] = useState(mevcut?.tarih ?? bugunStr())
  const [durum, setDurum] = useState<VeresiyeDurumu>(mevcut?.durum ?? 'veresiye')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const veresiyeUrunleri = urunler.filter((u) => u.aktif && u.modules.includes('veresiye'))
  const seciliMusteri = musteriler.find((m) => m.id === musteriId)
  const unMusterisi = unHesabiAktifMi(seciliMusteri)

  function urunSec(id: string) {
    const urun = urunler.find((u) => u.id === id)
    setProductId(id)
    setUrunAdi(urun?.ad ?? '')
    setBirimFiyat(seciliMusteri?.ozelFiyatlar[id] ?? urun?.fiyat ?? 0)
  }

  // Yeni kayıtların büyük çoğunluğu "Baston" ürünü olduğu için, ürünler
  // yüklendiğinde (ve henüz bir seçim yapılmamışsa) formu bu ürün seçiliyken
  // açıyoruz — personel/admin çoğu zaman değiştirmeden ilerleyebilir.
  useEffect(() => {
    if (mevcut || productId || veresiyeUrunleri.length === 0) return
    const baston = veresiyeUrunleri.find((u) => u.ad.toLocaleLowerCase('tr-TR').includes('baston'))
    if (baston) urunSec(baston.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veresiyeUrunleri])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const adetSayi = Number(adet)
    if (!musteriId) return setHata('Müşteri seçmelisiniz.')
    if (!productId) return setHata('Ürün seçmelisiniz.')
    if (!adet || adetSayi <= 0) return setHata('Adet 0’dan büyük olmalı.')
    setHata(null)
    setGonderiliyor(true)
    try {
      await onKaydet({ musteriId, musteriAdi, productId, urunAdi, adet: adetSayi, birimFiyat, tarih, durum })
      onKapat()
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md overflow-y-auto rounded-t-2xl bg-bakery-surface p-5 shadow-xl md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-ink-900">{mevcut ? 'Kaydı Düzenle' : 'Yeni Kayıt'}</h3>
          <button type="button" onClick={onKapat} className="rounded-full p-1 text-bakery-ink-400 hover:bg-bakery-cream-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Müşteri *</label>
            <MusteriSecici
              modul="veresiye"
              seciliMusteriId={musteriId || null}
              onSec={(m) => {
                setMusteriId(m.id)
                setMusteriAdi(m.ad)
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Ürün (Tür) *</label>
              <select
                value={productId}
                onChange={(e) => urunSec(e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-2 text-sm outline-none focus:border-bakery-amber-500"
              >
                <option value="">Seçin…</option>
                {veresiyeUrunleri.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ad}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Tarih *</label>
              <input
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 text-sm outline-none focus:border-bakery-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Adet *</label>
              <input
                type="number"
                min={1}
                value={adet}
                onChange={(e) => setAdet(e.target.value)}
                placeholder="Adet"
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-bakery-ink-800">Birim Fiyat (₺)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={birimFiyat}
                onChange={(e) => setBirimFiyat(Number(e.target.value))}
                className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
              />
            </div>
          </div>

          {unMusterisi ? (
            <p className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm text-blue-700">
              Bu müşteri Un Hesabı ile takip ediliyor — bu teslimat ücretsiz sayılıp otomatik olarak un hesabına eklenecek.
            </p>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-bakery-ink-800">Durum</label>
              <div className="flex gap-2">
                {(
                  [
                    ['veresiye', 'Veresiye'],
                    ['nakit', 'Nakit'],
                    ['odendi', 'Ödendi']
                  ] as const
                ).map(([key, etiket]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setDurum(key)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      durum === key ? 'bg-bakery-amber-600 text-white' : 'bg-bakery-cream-100 text-bakery-ink-600 hover:bg-bakery-cream-200'
                    }`}
                  >
                    {etiket}
                  </button>
                ))}
              </div>
            </div>
          )}

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
