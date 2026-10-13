import { useMemo, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useOkullar } from './data'
import { useMusteriler } from '../musteriler/data'
import { useOkulOrders } from './orderData'
import BosDurum from '../../shared/BosDurum'
import TelegramGonderButonu from '../../shared/TelegramGonderButonu'
import { tarihGunAdiIle } from '../../shared/tarih'
import type { OkulOrder, OkulSchool } from '../../lib/types'

function yarinStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const trSirala = (a: string, b: string) => a.localeCompare(b, 'tr')
const siraliSatirlar = (satirlar: { hesap: string; okul: string; metin: string }[]) =>
  [...satirlar].sort((a, b) => trSirala(a.hesap, b.hesap) || trSirala(a.okul, b.okul)).map((x) => x.metin)

function okulMesajOlustur(tarih: string, okullar: OkulSchool[], orders: OkulOrder[], musteriAdlari: Map<string, string>): string {
  if (orders.length === 0) return ''

  // Ekmek çeşidine göre gruplu: başlıkta ürün + toplam, altında okullar
  const gruplar = new Map<string, { toplam: number; satirlar: { hesap: string; okul: string; metin: string }[] }>()

  for (const okul of okullar) {
    for (const o of orders.filter((x) => x.schoolId === okul.id)) {
      if (o.adet <= 0) continue
      const hat = okul.lines.find((l) => l.id === o.lineId)
      if (!hat) continue // silinmiş hat — gönderilmez
      const notEki = o.not ? ` — ${o.not}` : ''
      const grup = gruplar.get(hat.urunAdi) ?? { toplam: 0, satirlar: [] }
      grup.toplam += o.adet
      // Sıralama: ekmek türü → veresiye hesabı (bağlı değilse okul adı) → okul adı
      const hesap = (okul.musteriId && musteriAdlari.get(okul.musteriId)) || okul.ad
      grup.satirlar.push({ hesap, okul: okul.ad, metin: `${okul.ad}: ${o.adet} adet${notEki}` })
      gruplar.set(hat.urunAdi, grup)
    }
  }

  if (gruplar.size === 0) return ''

  const bloklar = [...gruplar.entries()].map(([urun, g]) =>
    [`${urun} — ${g.toplam} adet`, ...siraliSatirlar(g.satirlar)].join('\n')
  )
  return [`Ekmek Siparişi — ${tarihGunAdiIle(tarih)}`, '', bloklar.join('\n\n')].join('\n')
}

function waAc(mesaj: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(mesaj)}`, '_blank')
}

export default function MesajPage() {
  const { okullar } = useOkullar()
  const { musteriler } = useMusteriler()
  const musteriAdlari = useMemo(() => new Map(musteriler.map((m) => [m.id, m.ad])), [musteriler])
  const [tarih, setTarih] = useState(yarinStr())
  const { orders, yukleniyor } = useOkulOrders(tarih)

  const mesajMetni = useMemo(() => okulMesajOlustur(tarih, okullar, orders, musteriAdlari), [tarih, okullar, orders, musteriAdlari])
  const waLink = `https://wa.me/?text=${encodeURIComponent(mesajMetni)}`

  // Seçili tarih zaten varsayılan olarak yarın ama personel önizleme için başka
  // bir tarihe bakıyor olabilir — bu buton tarih seçiciyi hiç değiştirmeden,
  // doğrudan yarının listesini WhatsApp'ta açar.
  const yarin = yarinStr()
  const { orders: yarinOrders, yukleniyor: yarinYukleniyor } = useOkulOrders(yarin)
  const yarinMesaj = useMemo(() => okulMesajOlustur(yarin, okullar, yarinOrders, musteriAdlari), [yarin, okullar, yarinOrders, musteriAdlari])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-bakery-ink-900">Mesaj</h2>
        <input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
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
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : !mesajMetni ? (
        <BosDurum baslik="Bu tarihte sipariş yok" />
      ) : (
        <div className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
          <pre className="mb-4 whitespace-pre-wrap rounded-lg bg-bakery-cream-50 p-3 font-sans text-sm text-bakery-ink-800">
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
