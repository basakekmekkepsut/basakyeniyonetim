import { useMemo, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useOkullar } from './data'
import { useOkulOrders } from './orderData'
import BosDurum from '../../shared/BosDurum'
import TelegramGonderButonu from '../../shared/TelegramGonderButonu'

function yarinStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function MesajPage() {
  const { okullar } = useOkullar()
  const [tarih, setTarih] = useState(yarinStr())
  const { orders, yukleniyor } = useOkulOrders(tarih)

  const mesajMetni = useMemo(() => {
    if (orders.length === 0) return ''
    const okulSatirlari = okullar
      .map((okul) => {
        const satirlar = orders
          .filter((o) => o.schoolId === okul.id)
          .map((o) => {
            const hat = okul.lines.find((l) => l.id === o.lineId)
            return `${o.adet}x ${hat?.urunAdi ?? '—'}`
          })
        return satirlar.length > 0 ? `• ${okul.ad}: ${satirlar.join(', ')}` : null
      })
      .filter((x): x is string => x !== null)

    return `📋 ${tarih} Okul Sipariş Listesi\n\n${okulSatirlari.join('\n')}`
  }, [orders, okullar, tarih])

  const waLink = `https://wa.me/?text=${encodeURIComponent(mesajMetni)}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-bakery-coffee-900">Mesaj</h2>
        <input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="rounded-lg border border-bakery-cream-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
        />
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>
      ) : orders.length === 0 ? (
        <BosDurum baslik="Bu tarihte sipariş yok" />
      ) : (
        <div className="rounded-xl bg-white p-4 shadow-sm shadow-bakery-coffee-900/5">
          <pre className="mb-4 whitespace-pre-wrap rounded-lg bg-bakery-cream-50 p-3 font-sans text-sm text-bakery-coffee-800">
            {mesajMetni}
          </pre>
          <div className="flex flex-wrap gap-2">
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
            >
              <MessageCircle size={16} />
              WhatsApp'ta Paylaş
            </a>
            <TelegramGonderButonu modul="okul" mesaj={mesajMetni} />
          </div>
        </div>
      )}
    </div>
  )
}
