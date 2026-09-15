import { useState, type FormEvent } from 'react'
import { useMusteriler } from '../musteriler/data'
import { useUrunler } from '../urunler/data'
import { unOdemesiEkle, useUnGirisleri } from './unHesabiData'
import MusteriSecici from '../../shared/MusteriSecici'
import BosDurum from '../../shared/BosDurum'
import { cuvalGoster } from '../../shared/unHesabi'
import { useToast } from '../../shared/Toast'
import { useSession } from '../../lib/session'
import type { Musteri } from '../../lib/types'

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function UnHesapliGirisPage() {
  const session = useSession()
  const toast = useToast()
  const { musteriler } = useMusteriler()
  const { urunler } = useUrunler()

  const [musteri, setMusteri] = useState<Musteri | null>(null)
  const { girisler } = useUnGirisleri(musteri?.id ?? null)
  const [cuvalSayisi, setCuvalSayisi] = useState(1)
  const [tarih, setTarih] = useState(bugunStr())
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const unMusterisiVarMi = musteriler.some((m) => m.aktif && m.unHesabi?.aktif)
  const referansUrun = musteri?.unHesabi?.referansUrunId
    ? urunler.find((u) => u.id === musteri.unHesabi!.referansUrunId)
    : undefined

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (session.status !== 'signed-in') return
    if (!musteri) return toast.hata('Müşteri seçmelisiniz.')
    if (cuvalSayisi <= 0) return toast.hata('Çuval sayısı 0’dan büyük olmalı.')
    const adetPerCuval = musteri.unHesabi?.adetPerCuval
    if (!adetPerCuval) return toast.hata('Bu müşteride "1 çuval kaç adet eder" oranı tanımlı değil — önce müşteri kartından ayarlayın.')

    setGonderiliyor(true)
    try {
      await unOdemesiEkle({ musteriId: musteri.id, musteriAdi: musteri.ad, tarih, cuvalSayisi, adetPerCuval }, { uid: session.user.uid })
      toast.basari(`${cuvalSayisi} çuval kaydedildi, ${cuvalSayisi * adetPerCuval} adet eşdeğer un bakiyesinden düşüldü.`)
      setCuvalSayisi(1)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setGonderiliyor(false)
    }
  }

  if (!unMusterisiVarMi) {
    return (
      <BosDurum
        baslik="Un Hesabı aktif müşteri yok"
        aciklama="Ayarlar > Müşteriler'den bir müşteride 'Un Hesabı' seçeneğini açın."
      />
    )
  }

  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-lg font-semibold text-bakery-coffee-900">Un Ödemesi</h2>
      <p className="text-sm text-bakery-coffee-500">
        Bu müşterilerde ekmek ücretsizdir — ödeme yalnızca getirdikleri un (çuval) ile yapılır.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
        <div>
          <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Müşteri *</label>
          <MusteriSecici
            modul="veresiye"
            seciliMusteriId={musteri?.id ?? null}
            onSec={(m) => setMusteri(m)}
            filtre={(m) => Boolean(m.unHesabi?.aktif)}
          />
        </div>

        {musteri?.unHesabi && (
          <div className="rounded-lg bg-bakery-cream-50 px-3 py-2.5 text-sm text-bakery-coffee-600">
            <p>
              Referans ürün: <strong>{referansUrun?.ad ?? '—'}</strong> · 1 çuval ={' '}
              <strong>{musteri.unHesabi.adetPerCuval ?? '—'} adet</strong>
            </p>
            <p className="mt-1">
              Güncel un bakiyesi:{' '}
              <strong className={musteri.unHesabi.birikenEsdegerAdet > 0 ? 'text-bakery-danger' : 'text-bakery-success'}>
                {cuvalGoster(musteri.unHesabi.birikenEsdegerAdet, musteri.unHesabi.adetPerCuval)}
              </strong>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Çuval Sayısı *</label>
            <input
              type="number"
              min={0.1}
              step="0.1"
              value={cuvalSayisi}
              onChange={(e) => setCuvalSayisi(Number(e.target.value))}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-bakery-coffee-800">Tarih *</label>
            <input
              type="date"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 outline-none focus:border-bakery-amber-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={gonderiliyor}
          className="w-full rounded-lg bg-bakery-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-bakery-amber-500 disabled:opacity-60"
        >
          {gonderiliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>

      {musteri && girisler.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
          <h3 className="mb-2 text-sm font-semibold text-bakery-coffee-800">Geçmiş Un Ödemeleri</h3>
          <ul className="space-y-1 text-sm text-bakery-coffee-600">
            {girisler.map((g) => (
              <li key={g.id} className="flex justify-between">
                <span>{g.tarih}</span>
                <span>
                  {g.cuvalSayisi} çuval ({g.esdegerAdet} adet eşdeğer)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
