import { useMemo, useState } from 'react'
import { useSiparisler } from './data'
import DonemFiltre, { donemAraligiHesapla, type DonemAnahtari } from '../../shared/DonemFiltre'
import TutarGoster from '../../shared/TutarGoster'
import BosDurum from '../../shared/BosDurum'

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function RaporPage() {
  const [donem, setDonem] = useState<DonemAnahtari>('bu_ay')
  const [ozelBaslangic, setOzelBaslangic] = useState(bugunStr())
  const [ozelBitis, setOzelBitis] = useState(bugunStr())

  const { baslangic, bitis } = donemAraligiHesapla(donem, ozelBaslangic, ozelBitis)
  const { siparisler, yukleniyor } = useSiparisler({ baslangic, bitis, silindi: false, sadeceKendi: null })

  const gecerliSiparisler = useMemo(() => siparisler.filter((s) => s.durum !== 'iptal'), [siparisler])

  const ozet = useMemo(() => {
    const toplamTutar = gecerliSiparisler.reduce((s, o) => s + o.toplamTutar, 0)
    const odenenler = gecerliSiparisler.filter((o) => o.odemeSekli === 'nakit' || o.odemeDurumu === 'odendi')
    const odenenTutar = odenenler.reduce((s, o) => s + o.toplamTutar, 0)

    const urunToplamlari = new Map<string, number>()
    for (const s of gecerliSiparisler) {
      for (const it of s.items) {
        urunToplamlari.set(it.urunAdi, (urunToplamlari.get(it.urunAdi) ?? 0) + it.adet)
      }
    }

    return {
      siparisSayisi: gecerliSiparisler.length,
      toplamTutar,
      odenenSayisi: odenenler.length,
      odenenTutar,
      urunToplamlari: [...urunToplamlari.entries()].sort((a, b) => b[1] - a[1])
    }
  }, [gecerliSiparisler])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-bakery-coffee-900">Rapor</h2>
        <DonemFiltre
          secili={donem}
          onSeciliDegis={setDonem}
          ozelBaslangic={ozelBaslangic}
          ozelBitis={ozelBitis}
          onOzelBaslangicDegis={setOzelBaslangic}
          onOzelBitisDegis={setOzelBitis}
          tumunuGoster
        />
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>
      ) : gecerliSiparisler.length === 0 ? (
        <BosDurum baslik="Bu aralıkta sipariş yok" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
              <p className="text-xs text-bakery-coffee-500">Sipariş Sayısı</p>
              <p className="text-xl font-semibold text-bakery-coffee-900">{ozet.siparisSayisi}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
              <p className="text-xs text-bakery-coffee-500">Toplam Tutar</p>
              <p className="text-xl font-semibold text-bakery-coffee-900">
                <TutarGoster tutar={ozet.toplamTutar} />
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
              <p className="text-xs text-bakery-coffee-500">Ödenen Sipariş</p>
              <p className="text-xl font-semibold text-bakery-success">{ozet.odenenSayisi}</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
              <p className="text-xs text-bakery-coffee-500">Ödenen Tutar</p>
              <p className="text-xl font-semibold text-bakery-success">
                <TutarGoster tutar={ozet.odenenTutar} />
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
            <h3 className="mb-3 text-sm font-semibold text-bakery-coffee-800">Ürün Bazında Dağılım</h3>
            <div className="space-y-1.5">
              {ozet.urunToplamlari.map(([ad, adet]) => (
                <div key={ad} className="flex items-center justify-between text-sm">
                  <span className="text-bakery-coffee-700">{ad}</span>
                  <span className="font-medium text-bakery-coffee-900">{adet} adet</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
