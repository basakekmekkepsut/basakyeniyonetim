import { useMemo, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useSiparisler } from './data'
import BosDurum from '../../shared/BosDurum'
import TelegramGonderButonu from '../../shared/TelegramGonderButonu'
import { tarihGunAdiIle } from '../../shared/tarih'
import type { Siparis } from '../../lib/types'

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

function gunEkle(tarihStr: string, gun: number): string {
  const d = new Date(tarihStr)
  d.setDate(d.getDate() + gun)
  return d.toISOString().slice(0, 10)
}

function siparisMesajOlustur(tarih: string, siparisler: Siparis[]): string {
  const gecerliSiparisler = siparisler.filter((s) => s.durum !== 'iptal')
  if (gecerliSiparisler.length === 0) return ''

  const urunToplamlari = new Map<string, number>()
  const satirlar = gecerliSiparisler.map((s) => {
    const urunler = s.items.map((it) => `${it.adet}x ${it.urunAdi}`).join(', ')
    for (const it of s.items) urunToplamlari.set(it.urunAdi, (urunToplamlari.get(it.urunAdi) ?? 0) + it.adet)
    const notEki = s.not?.trim() ? ` — Not: ${s.not.trim()}` : ''
    return `• ${s.musteriAdi} — ${urunler}${notEki}`
  })
  const toplamSatirlari = [...urunToplamlari.entries()].map(([urun, adet]) => `${urun}: ${adet} adet`)
  return [`📋 ${tarihGunAdiIle(tarih)} Sipariş Listesi`, '', ...satirlar, '', 'Ürün bazında toplam:', ...toplamSatirlari].join('\n')
}

function waAc(mesaj: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(mesaj)}`, '_blank')
}

// Seçili tarihten bağımsız, sabit "yarın" ve "öbür gün" için hızlı gönderim —
// tarih seçiciyi değiştirmeden, tek tıkla o günün listesini WhatsApp'ta açar.
function HizliGonderButonu({ etiket, tarih }: { etiket: string; tarih: string }) {
  const { siparisler, yukleniyor } = useSiparisler({ baslangic: tarih, bitis: tarih, silindi: false, sadeceKendi: null })
  const mesaj = useMemo(() => siparisMesajOlustur(tarih, siparisler), [tarih, siparisler])

  return (
    <button
      onClick={() => waAc(mesaj)}
      disabled={yukleniyor || !mesaj}
      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
      title={!yukleniyor && !mesaj ? 'Bu tarihte sipariş yok' : undefined}
    >
      <MessageCircle size={16} />
      {etiket}
    </button>
  )
}

export default function MesajPage() {
  const [tarih, setTarih] = useState(() => gunEkle(bugunStr(), 1))
  const { siparisler, yukleniyor } = useSiparisler({ baslangic: tarih, bitis: tarih, silindi: false, sadeceKendi: null })

  const mesajMetni = useMemo(() => siparisMesajOlustur(tarih, siparisler), [tarih, siparisler])
  const waLink = `https://wa.me/?text=${encodeURIComponent(mesajMetni)}`

  const yarin = gunEkle(bugunStr(), 1)
  const obeurGun = gunEkle(bugunStr(), 2)

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

      <div className="flex flex-wrap gap-2">
        <HizliGonderButonu etiket="Yarını Gönder" tarih={yarin} />
        <HizliGonderButonu etiket="Öbür Günü Gönder" tarih={obeurGun} />
      </div>

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
            <TelegramGonderButonu modul="siparis" mesaj={mesajMetni} />
          </div>
        </div>
      )}
    </div>
  )
}
