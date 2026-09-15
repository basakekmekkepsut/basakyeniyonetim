import { useEffect, useState } from 'react'
import { useOkullar, useOkulFirmalari } from './data'
import { useOkulOrders, useOkulKapanis, okulSiparisMiktariGuncelle, varsayilanSiparisleriHazirla } from './orderData'
import BosDurum from '../../shared/BosDurum'

function yarinStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function SiparisPage() {
  const { okullar, yukleniyor: okulYukleniyor } = useOkullar()
  const { firmalar } = useOkulFirmalari()
  const [tarih, setTarih] = useState(yarinStr())
  const { orders, yukleniyor: ordersYukleniyor } = useOkulOrders(tarih)
  const { kapanis, yukleniyor: kapanisYukleniyor } = useOkulKapanis(tarih)

  const [degerler, setDegerler] = useState<Record<string, number>>({})

  useEffect(() => {
    // Bu tarih için henüz sipariş girilmemiş hatlarda, okulun standart günlük
    // adedini varsayılan olarak gösteriyoruz — her gün sıfırdan girmeye gerek
    // kalmasın, personel sadece istisnaları (kapalı okul, ekstra sipariş) düzeltsin.
    const yeni: Record<string, number> = {}
    for (const okul of okullar) {
      for (const l of okul.lines) {
        if (l.aktif) yeni[l.id] = l.adet
      }
    }
    for (const o of orders) yeni[o.lineId] = o.adet
    setDegerler(yeni)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarih, orders.length, okullar.length])

  useEffect(() => {
    // Ekranda gösterilen varsayılanların gerçekten kaydedilmiş olduğundan emin ol
    // (bkz. varsayilanSiparisleriHazirla yorumu) — kapanmış bir günde asla çalışmaz.
    if (okulYukleniyor || ordersYukleniyor || kapanisYukleniyor || kapanis?.kapandi) return
    varsayilanSiparisleriHazirla(tarih, okullar, orders).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarih, okulYukleniyor, ordersYukleniyor, kapanisYukleniyor, kapanis?.kapandi, okullar.length, orders.length])

  function lineOrder(lineId: string) {
    return orders.find((o) => o.lineId === lineId)
  }

  async function commit(schoolId: string, lineId: string, productId: string, adet: number) {
    await okulSiparisMiktariGuncelle(tarih, schoolId, lineId, productId, adet)
  }

  const aktifOkullar = okullar.filter((o) => o.lines.some((l) => l.aktif))
  const gruplar = new Map<string, typeof aktifOkullar>()
  for (const okul of aktifOkullar) {
    const key = okul.firmaId ?? '__dogrudan__'
    gruplar.set(key, [...(gruplar.get(key) ?? []), okul])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-bakery-coffee-900">Sipariş</h2>
        <input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="rounded-lg border border-bakery-cream-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
        />
      </div>

      {kapanis?.kapandi && (
        <p className="rounded-lg bg-bakery-cream-100 px-4 py-2.5 text-sm font-medium text-bakery-coffee-600">
          Bu tarih kapatılmış — satırlar salt okunur.
        </p>
      )}

      {okulYukleniyor ? (
        <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>
      ) : aktifOkullar.length === 0 ? (
        <BosDurum baslik="Aktif hat tanımlı okul yok" aciklama="Okullar sekmesinden okul ve hat ekleyin." />
      ) : (
        <div className="space-y-4">
          {[...gruplar.entries()].map(([key, okullarGrup]) => {
            const firma = key === '__dogrudan__' ? null : firmalar.find((f) => f.id === key)
            return (
              <div key={key} className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
                <h3 className="mb-3 text-sm font-semibold text-bakery-coffee-700">
                  {firma ? firma.ad : 'Doğrudan Okullar'}
                </h3>
                <div className="space-y-3">
                  {okullarGrup.map((okul) => (
                    <div key={okul.id}>
                      <p className="mb-1.5 text-sm font-medium text-bakery-coffee-900">{okul.ad}</p>
                      <div className="space-y-1.5 pl-2">
                        {okul.lines
                          .filter((l) => l.aktif)
                          .map((l) => {
                            const order = lineOrder(l.id)
                            const kapali = order?.kapandiMi ?? false
                            return (
                              <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-bakery-coffee-600">{l.urunAdi}</span>
                                <div className="flex items-center gap-2">
                                  {kapali && <span className="text-xs text-bakery-coffee-400">Kapandı</span>}
                                  <input
                                    type="number"
                                    min={0}
                                    disabled={kapali}
                                    value={degerler[l.id] ?? ''}
                                    placeholder="0"
                                    onChange={(e) =>
                                      setDegerler((prev) => ({ ...prev, [l.id]: Number(e.target.value) }))
                                    }
                                    onBlur={(e) => commit(okul.id, l.id, l.productId, Number(e.target.value) || 0)}
                                    className="w-20 rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-1.5 text-center outline-none focus:border-bakery-amber-500 disabled:bg-bakery-cream-100 disabled:text-bakery-coffee-400"
                                  />
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
