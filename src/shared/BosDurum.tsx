import type { ReactNode } from 'react'

export default function BosDurum({ baslik, aciklama, aksiyon }: { baslik: string; aciklama?: string; aksiyon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-bakery-cream-200 bg-bakery-cream-50 px-6 py-12 text-center">
      <p className="font-medium text-bakery-coffee-700">{baslik}</p>
      {aciklama && <p className="mt-1 max-w-sm text-sm text-bakery-coffee-500">{aciklama}</p>}
      {aksiyon && <div className="mt-4">{aksiyon}</div>}
    </div>
  )
}
