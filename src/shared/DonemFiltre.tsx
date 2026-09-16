import { CalendarDays } from 'lucide-react'
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'

export type DonemAnahtari = 'yaklasan' | 'bugun' | 'yarin' | 'bu_hafta' | 'bu_ay' | 'ozel' | 'tumu'

export interface DonemAraligi {
  baslangic: string | null
  bitis: string | null
}

const gunStr = (d: Date) => format(d, 'yyyy-MM-dd')

export function donemAraligiHesapla(donem: DonemAnahtari, ozelBaslangic?: string, ozelBitis?: string): DonemAraligi {
  const bugun = new Date()
  switch (donem) {
    // Bugünden itibaren, üst sınır olmadan — hiçbir gelecek tarihli aktif sipariş
    // filtre yüzünden gizlenmesin diye varsayılan görünüm budur (bkz. SiparislerPage).
    case 'yaklasan':
      return { baslangic: gunStr(bugun), bitis: null }
    case 'bugun':
      return { baslangic: gunStr(bugun), bitis: gunStr(bugun) }
    case 'yarin': {
      const yarin = new Date(bugun)
      yarin.setDate(yarin.getDate() + 1)
      return { baslangic: gunStr(yarin), bitis: gunStr(yarin) }
    }
    case 'bu_hafta':
      return {
        baslangic: gunStr(startOfWeek(bugun, { weekStartsOn: 1 })),
        bitis: gunStr(endOfWeek(bugun, { weekStartsOn: 1 }))
      }
    case 'bu_ay':
      return { baslangic: gunStr(startOfMonth(bugun)), bitis: gunStr(endOfMonth(bugun)) }
    case 'ozel':
      return { baslangic: ozelBaslangic || null, bitis: ozelBitis || null }
    case 'tumu':
    default:
      return { baslangic: null, bitis: null }
  }
}

const SECENEKLER: { key: DonemAnahtari; etiket: string }[] = [
  { key: 'yaklasan', etiket: 'Yaklaşan' },
  { key: 'bugun', etiket: 'Bugün' },
  { key: 'yarin', etiket: 'Yarın' },
  { key: 'bu_hafta', etiket: 'Bu Hafta' },
  { key: 'bu_ay', etiket: 'Bu Ay' },
  { key: 'ozel', etiket: 'Özel Aralık' }
]

interface Props {
  secili: DonemAnahtari
  onSeciliDegis: (donem: DonemAnahtari) => void
  ozelBaslangic: string
  ozelBitis: string
  onOzelBaslangicDegis: (deger: string) => void
  onOzelBitisDegis: (deger: string) => void
  tumunuGoster?: boolean
  // true ise pillerin yanına, tek bir güne hızlıca atlamak için ayrı bir tarih
  // seçici eklenir (seçilen gün "Özel Aralık" moduna baslangic=bitis olarak yazılır).
  tekTarihSecici?: boolean
}

export default function DonemFiltre({
  secili,
  onSeciliDegis,
  ozelBaslangic,
  ozelBitis,
  onOzelBaslangicDegis,
  onOzelBitisDegis,
  tumunuGoster = false,
  tekTarihSecici = false
}: Props) {
  const secenekler = tumunuGoster ? [...SECENEKLER, { key: 'tumu' as const, etiket: 'Tüm Tarihler' }] : SECENEKLER
  const tekTarihDegeri = secili === 'ozel' && ozelBaslangic && ozelBaslangic === ozelBitis ? ozelBaslangic : ''

  function tekTarihSec(tarih: string) {
    if (!tarih) return
    onOzelBaslangicDegis(tarih)
    onOzelBitisDegis(tarih)
    onSeciliDegis('ozel')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg bg-bakery-cream-100 p-1">
        {secenekler.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSeciliDegis(s.key)}
            className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
              secili === s.key ? 'bg-bakery-surface text-bakery-ink-900 shadow-sm' : 'text-bakery-ink-500 hover:text-bakery-ink-700'
            }`}
          >
            {s.etiket}
          </button>
        ))}
      </div>

      {tekTarihSecici && (
        <label className="flex items-center gap-1.5 rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5">
          <CalendarDays size={15} className="shrink-0 text-bakery-ink-400" />
          {!tekTarihDegeri && <span className="whitespace-nowrap text-sm text-bakery-ink-400">Güne git</span>}
          <input
            type="date"
            value={tekTarihDegeri}
            onChange={(e) => tekTarihSec(e.target.value)}
            aria-label="Belirli bir tarihe git"
            className="w-full min-w-0 bg-transparent text-sm text-bakery-ink-800 outline-none"
          />
        </label>
      )}

      {secili === 'ozel' && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={ozelBaslangic}
            onChange={(e) => onOzelBaslangicDegis(e.target.value)}
            className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5 text-sm outline-none focus:border-bakery-amber-500"
          />
          <span className="text-bakery-ink-400">–</span>
          <input
            type="date"
            value={ozelBitis}
            onChange={(e) => onOzelBitisDegis(e.target.value)}
            className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5 text-sm outline-none focus:border-bakery-amber-500"
          />
        </div>
      )}
    </div>
  )
}
