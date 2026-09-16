import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export default function BosDurum({ baslik, aciklama, aksiyon }: { baslik: string; aciklama?: string; aksiyon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-bakery-cream-200 bg-white/60 px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-bakery-amber-500/10 text-bakery-amber-600">
        <Inbox size={22} />
      </div>
      <p className="font-medium text-bakery-coffee-800">{baslik}</p>
      {aciklama && <p className="mt-1 max-w-sm text-sm text-bakery-coffee-500">{aciklama}</p>}
      {aksiyon && <div className="mt-4">{aksiyon}</div>}
    </div>
  )
}
