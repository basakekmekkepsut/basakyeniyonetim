import { useMemo, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useOkullar } from './data'
import { useOkulOrders } from './orderData'
import BosDurum from '../../shared/BosDurum'
import TelegramGonderButonu from '../../shared/TelegramGonderButonu'
import type { OkulOrder, OkulSchool } from '../../lib/types'

function yarinStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

function tarihBaslikGoster(tarihStr: string): string {
  const [y, m, d] = tarihStr.split('-').map(Number)
  const tarih = new Date(y, m - 1, d)
  return `${d} ${AY_ADLARI[m - 1]} ${GUN_ADLARI[tarih.getDay()]}`
}

function okulMesajOlustur(tarih: string, okullar: OkulSchool[], orders: OkulOrder[]): string {
  if (orders.length === 0) return ''

  const satirlar: string[] = []
  const urunToplamlari = new Map<string, number>()

  for (const okul of okullar) {
    for (const o of orders.filter((x) => x.schoolId === okul.id)) {
      if (o.adet <= 0) continue
      const hat = okul.lines.find((l) => l.id === o.lineId)
      const urunAdi = hat?.urunAdi ?? '—'
      satirlar.push(`${okul.ad}: ${o.adet} adet (${urunAdi})`)
      urunToplamlari.set(urunAdi, (urunToplamlari.get(urunAdi) ?? 0) + o.adet)
    }
  }

  if (satirlar.length === 0) return ''

  const toplamSatirlari = [...urunToplamlari.entries()].map(([urun, adet]) => `${urun}: ${adet} adet`)

  return [
    `Ekmek Siparişi — ${tarihBaslikGoster(tarih)}`,
    '',
    ...satirlar,
    '',
    'Ürün bazında toplam:',
    ...toplamSatirlari
  ].join('\n')
}

function waAc(mesaj: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(mesaj)}`, '_blank')
}

export default function MesajPage() {
  const { okullar } = useOkullar()
  const [tarih, setTarih] = useState(yarinStr())
  const { orders, yukleniyor } = useOkulOrders(tarih)

  const mesajMetni = useMemo(() => okulMesajOlustur(tarih, okullar, orders), [tarih, okullar, orders])
  const waLink = `https://wa.me/?text=${encodeURIComponent(mesajMetni)}`

  // Seçili tarih zaten varsayılan olarak yarın ama personel önizleme için başka
  // bir tarihe bakıyor olabilir — bu buton tarih seçiciyi hiç değiştirmeden,
  // doğrudan yarının listesini WhatsApp'ta açar.
  const yarin = yarinStr()
  const { orders: yarinOrders, yukleniyor: yarinYukleniyor } = useOkulOrders(yarin)
  const yarinMesaj = useMemo(() => okulMesajOlustur(yarin, okullar, yarinOrders), [yarin, okullar, yarinOrders])

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

      <button
        onClick={() => waAc(yarinMesaj)}
        disabled={yarinYukleniyor || !yarinMesaj}
        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        title={!yarinYukleniyor && !yarinMesaj ? 'Yarın için sipariş yok' : undefined}
      >
        <MessageCircle size={16} />
        Yarını Gönder
      </button>

      {yukleniyor ? (
        <p className="text-sm text-bakery-coffee-500">Yükleniyor…</p>
      ) : !mesajMetni ? (
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
