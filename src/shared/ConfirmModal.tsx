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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-2 text-base font-semibold text-bakery-coffee-900">{baslik}</h3>
        <p className="mb-5 text-sm text-bakery-coffee-600">{mesaj}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onVazgec}
            className="rounded-lg px-3 py-2 text-sm font-medium text-bakery-coffee-600 hover:bg-bakery-cream-100"
          >
            {vazgecEtiketi}
          </button>
          <button
            onClick={onOnayla}
            className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${
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
