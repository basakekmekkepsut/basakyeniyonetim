import { AlertTriangle, HelpCircle } from 'lucide-react'

interface ConfirmModalProps {
  baslik: string
  mesaj: string
  onayEtiketi?: string
  vazgecEtiketi?: string
  tehlikeli?: boolean
  onOnayla: () => void
  onVazgec: () => void
}

export default function ConfirmModal({
  baslik,
  mesaj,
  onayEtiketi = 'Onayla',
  vazgecEtiketi = 'Vazgeç',
  tehlikeli = false,
  onOnayla,
  onVazgec
}: ConfirmModalProps) {
  const Icon = tehlikeli ? AlertTriangle : HelpCircle
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bakery-coffee-900/40 px-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl bg-bakery-surface p-5 shadow-elevated animate-pop-in">
        <div
          className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full ${
            tehlikeli ? 'bg-bakery-danger/10 text-bakery-danger' : 'bg-bakery-amber-500/10 text-bakery-amber-600'
          }`}
        >
          <Icon size={20} />
        </div>
        <h3 className="mb-1.5 text-base font-semibold text-bakery-ink-900">{baslik}</h3>
        <p className="mb-5 text-sm leading-relaxed text-bakery-ink-600">{mesaj}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onVazgec}
            className="rounded-xl px-3.5 py-2 text-sm font-medium text-bakery-ink-600 hover:bg-bakery-cream-100"
          >
            {vazgecEtiketi}
          </button>
          <button
            onClick={onOnayla}
            className={`rounded-xl px-3.5 py-2 text-sm font-medium text-white shadow-soft ${
              tehlikeli ? 'bg-bakery-danger hover:bg-red-700' : 'bg-bakery-amber-600 hover:bg-bakery-amber-500'
            }`}
          >
            {onayEtiketi}
          </button>
        </div>
      </div>
    </div>
  )
}
