import type { VeresiyeDurumu } from '../lib/types'

const STIL: Record<VeresiyeDurumu, string> = {
  veresiye: 'bg-bakery-danger/10 text-bakery-danger',
  odendi: 'bg-bakery-success/10 text-bakery-success',
  nakit: 'bg-blue-500/10 text-blue-600',
  un_odemeli: 'bg-purple-500/10 text-purple-600'
}

const ETIKET: Record<VeresiyeDurumu, string> = {
  veresiye: 'Veresiye',
  odendi: 'Ödendi',
  nakit: 'Nakit',
  un_odemeli: 'Un ile Ödendi'
}

export default function DurumRozeti({ durum }: { durum: VeresiyeDurumu }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STIL[durum]}`}>{ETIKET[durum]}</span>
}
