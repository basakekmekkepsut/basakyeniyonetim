import { CalendarDays } from 'lucide-react'
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns'

export type DonemAnahtari =
  | 'yaklasan'
  | 'bugun'
  | 'yarin'
  | 'dun'
  | 'bu_hafta'
  | 'gecen_hafta'
  | 'bu_ay'
  | 'gecen_ay'
  | 'ozel'
  | 'tumu'

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
    case 'dun': {
      const dun = new Date(bugun)
      dun.setDate(dun.getDate() - 1)
      return { baslangic: gunStr(dun), bitis: gunStr(dun) }
    }
    case 'bu_hafta':
      return {
        baslangic: gunStr(startOfWeek(bugun, { weekStartsOn: 1 })),
        bitis: gunStr(endOfWeek(bugun, { weekStartsOn: 1 }))
      }
    case 'gecen_hafta': {
      const gecenHafta = subWeeks(bugun, 1)
      return {
        baslangic: gunStr(startOfWeek(gecenHafta, { weekStartsOn: 1 })),
        bitis: gunStr(endOfWeek(gecenHafta, { weekStartsOn: 1 }))
      }
    }
    case 'bu_ay':
      return { baslangic: gunStr(startOfMonth(bugun)), bitis: gunStr(endOfMonth(bugun)) }
    case 'gecen_ay': {
      const gecenAy = subMonths(bugun, 1)
      return { baslangic: gunStr(startOfMonth(gecenAy)), bitis: gunStr(endOfMonth(gecenAy)) }
    }
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

// Veresiye Özet gibi geriye dönük (geçmiş kayıtları inceleme) sayfalarda "Yarın"
// anlamsız — onun yerine "Dün" gösterilir. Sipariş/Okul'un ileri tarihli
// kullanımı (SECENEKLER) etkilenmez.
const SECENEKLER_GECMIS_ODAKLI: { key: DonemAnahtari; etiket: string }[] = [
  { key: 'yaklasan', etiket: 'Yaklaşan' },
  { key: 'bugun', etiket: 'Bugün' },
  { key: 'dun', etiket: 'Dün' },
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
  // true ise "Yarın" yerine "Dün" gösterilir — Veresiye Özet gibi geçmişe dönük
  // sayfalar için.
  gecmisOdakli?: boolean
}

export default function DonemFiltre({
  secili,
  onSeciliDegis,
  ozelBaslangic,
  ozelBitis,
  onOzelBaslangicDegis,
  onOzelBitisDegis,
  tumunuGoster = false,
  gecmisOdakli = false
}: Props) {
  const temelSecenekler = gecmisOdakli ? SECENEKLER_GECMIS_ODAKLI : SECENEKLER
  const secenekler = tumunuGoster ? [...temelSecenekler, { key: 'tumu' as const, etiket: 'Tüm Tarihler' }] : temelSecenekler

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

interface GuneGitProps {
  secili: DonemAnahtari
  onSeciliDegis: (donem: DonemAnahtari) => void
  ozelBaslangic: string
  ozelBitis: string
  onOzelBaslangicDegis: (deger: string) => void
  onOzelBitisDegis: (deger: string) => void
}

/** Tek bir güne hızlıca atlamak için ayrı bir tarih seçici — seçilen gün
 * "Özel Aralık" moduna baslangic=bitis olarak yazılır. DonemFiltre'nin
 * pillerinden bağımsız, ayrı bir satırda (örn. bir eylem butonuyla yan yana)
 * konumlandırılabilsin diye kendi başına dışa aktarılır. */
export function GuneGit({ secili, onSeciliDegis, ozelBaslangic, ozelBitis, onOzelBaslangicDegis, onOzelBitisDegis }: GuneGitProps) {
  const tekTarihDegeri = secili === 'ozel' && ozelBaslangic && ozelBaslangic === ozelBitis ? ozelBaslangic : ''

  function tekTarihSec(tarih: string) {
    if (!tarih) return
    onOzelBaslangicDegis(tarih)
    onOzelBitisDegis(tarih)
    onSeciliDegis('ozel')
  }

  return (
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
  )
}
