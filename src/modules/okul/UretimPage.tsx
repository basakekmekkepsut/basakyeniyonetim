import { useMemo, useState } from 'react'
import { useOkullar } from './data'
import { useOkulOrders } from './orderData'
import BosDurum from '../../shared/BosDurum'

function yarinStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function UretimPage() {
  const { okullar } = useOkullar()
  const [tarih, setTarih] = useState(yarinStr())
  const { orders, yukleniyor } = useOkulOrders(tarih)

  const urunToplamlari = useMemo(() => {
    const map = new Map<string, { urunAdi: string; adet: number }>()
    for (const o of orders) {
      const okul = okullar.find((s) => s.id === o.schoolId)
      const hat = okul?.lines.find((l) => l.id === o.lineId)
      const urunAdi = hat?.urunAdi ?? '—'
      const g = map.get(o.productId) ?? { urunAdi, adet: 0 }
      g.adet += o.adet
      map.set(o.productId, g)
    }
    return [...map.values()].sort((a, b) => b.adet - a.adet)
  }, [orders, okullar])

  const okulDagilimi = useMemo(() => {
    return okullar
      .map((okul) => {
        const satirlar = orders
          .filter((o) => o.schoolId === okul.id)
          .map((o) => {
            const hat = okul.lines.find((l) => l.id === o.lineId)
            return { urunAdi: hat?.urunAdi ?? '—', adet: o.adet, not: o.not }
          })
        return { okul, satirlar, toplam: satirlar.reduce((s, x) => s + x.adet, 0) }
      })
      .filter((x) => x.satirlar.length > 0)
  }, [orders, okullar])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-bakery-ink-900">Üretim</h2>
        <input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
        />
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : urunToplamlari.length === 0 ? (
        <BosDurum baslik="Bu tarihte sipariş yok" />
      ) : (
        <>
          <div className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
            <h3 className="mb-3 text-sm font-semibold text-bakery-ink-800">Ürün Bazında Toplam</h3>
            <div className="space-y-1.5">
              {urunToplamlari.map((u) => (
                <div key={u.urunAdi} className="flex items-center justify-between text-sm">
                  <span className="text-bakery-ink-700">{u.urunAdi}</span>
                  <span className="font-semibold text-bakery-ink-900">{u.adet} adet</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
            <h3 className="mb-3 text-sm font-semibold text-bakery-ink-800">Okul Bazında Dağılım</h3>
            <div className="space-y-3">
              {okulDagilimi.map(({ okul, satirlar, toplam }) => (
                <div key={okul.id}>
                  <p className="mb-1 text-sm font-medium text-bakery-ink-900">
                    {okul.ad} <span className="text-xs font-normal text-bakery-ink-500">({toplam} adet)</span>
                  </p>
                  <ul className="pl-2 text-sm text-bakery-ink-600">
                    {satirlar.map((s, i) => (
                      <li key={i}>
                        {s.adet}× {s.urunAdi}
                        {s.not && <span className="text-bakery-amber-600"> — {s.not}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
