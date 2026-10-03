import { useMemo, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useVeresiyeKayitlar } from '../veresiye/data'
import { useVeresiyeOdemeler } from '../veresiye/odemeData'
import { donemAraligiHesapla, type DonemAnahtari } from '../../shared/DonemFiltre'
import { bakiyeMesajOlustur, type DonemOzeti } from '../../shared/musteriYardimci'
import type { Musteri } from '../../lib/types'

type Secim = 'guncel' | DonemAnahtari

const SECENEKLER: { key: Secim; etiket: string }[] = [
  { key: 'guncel', etiket: 'Sadece Bakiye' },
  { key: 'bugun', etiket: 'Bugün' },
  { key: 'dun', etiket: 'Dün' },
  { key: 'bu_hafta', etiket: 'Bu Hafta' },
  { key: 'gecen_hafta', etiket: 'Geçen Hafta' },
  { key: 'bu_ay', etiket: 'Bu Ay' },
  { key: 'gecen_ay', etiket: 'Geçen Ay' },
  { key: 'ozel', etiket: 'İki Tarih Arası' },
  { key: 'tumu', etiket: 'Tüm Zamanlar' }
]

function bugunStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Props {
  musteri: Musteri
  onKapat: () => void
}

/** Müşteriye yalnızca bakiye bilgisini (isteğe bağlı bir dönem özetiyle)
 * WhatsApp'tan göndermek için — kalem kalem döküm ya da portal linki içermez. */
export default function BakiyeGonderModal({ musteri, onKapat }: Props) {
  const [secim, setSecim] = useState<Secim>('guncel')
  const [ozelBaslangic, setOzelBaslangic] = useState('')
  const [ozelBitis, setOzelBitis] = useState('')

  // Dönem sonu bakiyesi, güncel bakiyeden dönem SONRASI hareketler geri
  // alınarak bulunduğu için müşterinin tüm hareketleri gerekir.
  const filtre = useMemo(() => ({ musteriId: musteri.id, baslangic: null, bitis: null }), [musteri.id])
  const { kayitlar, yukleniyor: kYukleniyor } = useVeresiyeKayitlar(filtre)
  const { odemeler, yukleniyor: oYukleniyor } = useVeresiyeOdemeler(filtre)

  const donem = useMemo<DonemOzeti | undefined>(() => {
    if (secim === 'guncel') return undefined
    const aralik = donemAraligiHesapla(secim, ozelBaslangic, ozelBitis)
    if (secim === 'ozel' && (!aralik.baslangic || !aralik.bitis)) return undefined
    const bugun = bugunStr()
    const bitis = aralik.bitis && aralik.bitis < bugun ? aralik.bitis : bugun
    const baslangic = aralik.baslangic

    let alis = 0
    let odeme = 0
    let sonrakiEtki = 0 // bitiş tarihinden SONRAKİ hareketlerin bakiyeye net etkisi
    for (const k of kayitlar) {
      if (k.durum !== 'veresiye') continue // nakit/ödendi/un ödemeli ₺ bakiyesini etkilemez
      if (k.tarih > bitis) sonrakiEtki += k.tutar
      else if (!baslangic || k.tarih >= baslangic) alis += k.tutar
    }
    for (const o of odemeler) {
      if (o.tarih > bitis) sonrakiEtki -= o.tutar
      else if (!baslangic || o.tarih >= baslangic) odeme += o.tutar
    }
    const donemSonu = musteri.veresiyeBakiye - sonrakiEtki
    return { baslangic, bitis, devreden: donemSonu - alis + odeme, alis, odeme, donemSonu }
  }, [secim, ozelBaslangic, ozelBitis, kayitlar, odemeler, musteri.veresiyeBakiye])

  const yukleniyor = secim !== 'guncel' && (kYukleniyor || oYukleniyor)
  const ozelEksik = secim === 'ozel' && (!ozelBaslangic || !ozelBitis)
  const mesaj = bakiyeMesajOlustur(musteri, donem)
  const numara = musteri.telefon.replace(/\D/g, '')

  function gonder() {
    window.open(`https://wa.me/${numara}?text=${encodeURIComponent(mesaj)}`, '_blank')
    onKapat()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-bakery-coffee-900/40 backdrop-blur-sm md:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bakery-surface p-5 shadow-elevated md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-bakery-ink-900">Bakiye Gönder — {musteri.ad}</h3>
          <button onClick={onKapat} className="rounded-full p-1 text-bakery-ink-400 hover:bg-bakery-cream-100" aria-label="Kapat">
            <X size={20} />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {SECENEKLER.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSecim(s.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                secim === s.key ? 'bg-bakery-amber-600 text-white' : 'bg-bakery-cream-100 text-bakery-ink-600 hover:bg-bakery-cream-200'
              }`}
            >
              {s.etiket}
            </button>
          ))}
        </div>

        {secim === 'ozel' && (
          <div className="mb-3 flex items-center gap-1.5">
            <input
              type="date"
              value={ozelBaslangic}
              onChange={(e) => setOzelBaslangic(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-1.5 text-sm outline-none focus:border-bakery-amber-500"
            />
            <span className="text-bakery-ink-400">–</span>
            <input
              type="date"
              value={ozelBitis}
              onChange={(e) => setOzelBitis(e.target.value)}
              className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-1.5 text-sm outline-none focus:border-bakery-amber-500"
            />
          </div>
        )}

        <pre className="mb-4 whitespace-pre-wrap rounded-xl bg-bakery-cream-50 p-3 font-sans text-sm text-bakery-ink-800">
          {ozelEksik ? 'Başlangıç ve bitiş tarihini seçin.' : yukleniyor ? 'Hesaplanıyor…' : mesaj}
        </pre>

        <div className="flex justify-end gap-2">
          <button onClick={onKapat} className="rounded-lg px-4 py-2 text-sm font-medium text-bakery-ink-600 hover:bg-bakery-cream-100">
            Vazgeç
          </button>
          <button
            onClick={gonder}
            disabled={!numara || yukleniyor || ozelEksik}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            <MessageCircle size={16} />
            WhatsApp'tan Gönder
          </button>
        </div>
        {!numara && <p className="mt-2 text-right text-xs text-bakery-danger">Bu müşterinin telefon numarası kayıtlı değil.</p>}
      </div>
    </div>
  )
}
