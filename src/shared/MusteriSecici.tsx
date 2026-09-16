import { useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useMusteriler } from '../modules/musteriler/data'
import type { Modul, Musteri } from '../lib/types'

interface Props {
  modul: Modul
  seciliMusteriId: string | null
  onSec: (musteri: Musteri) => void
  placeholder?: string
  hepsiSecenegi?: boolean
  onHepsiSec?: () => void
  filtre?: (m: Musteri) => boolean
}

export default function MusteriSecici({
  modul,
  seciliMusteriId,
  onSec,
  placeholder = 'Müşteri seçin…',
  hepsiSecenegi = false,
  onHepsiSec,
  filtre
}: Props) {
  const { musteriler } = useMusteriler()
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')

  const uygunMusteriler = useMemo(
    () => musteriler.filter((m) => m.aktif && m.moduller.includes(modul) && (!filtre || filtre(m))),
    [musteriler, modul, filtre]
  )

  const filtrelenmis = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    if (!q) return uygunMusteriler
    return uygunMusteriler.filter((m) => m.ad.toLocaleLowerCase('tr-TR').includes(q) || m.telefon.includes(q))
  }, [uygunMusteriler, arama])

  const secili = uygunMusteriler.find((m) => m.id === seciliMusteriId)
  const gosterilenMetin = seciliMusteriId === null && hepsiSecenegi ? 'Tüm Müşteriler' : secili ? secili.ad : placeholder

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-3 py-2 text-left outline-none focus:border-bakery-amber-500"
      >
        <span className={secili || (seciliMusteriId === null && hepsiSecenegi) ? 'text-bakery-ink-900' : 'text-bakery-ink-400'}>
          {gosterilenMetin}
        </span>
        <ChevronDown size={16} className="text-bakery-ink-400" />
      </button>

      {acik && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAcik(false)} />
          <div className="absolute z-40 mt-1 w-full rounded-lg border border-bakery-cream-200 bg-bakery-surface shadow-lg">
            <input
              type="text"
              autoFocus
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Ad veya telefon ara…"
              className="w-full border-b border-bakery-cream-100 px-3 py-2 text-sm outline-none"
            />
            <div className="max-h-56 overflow-y-auto">
              {hepsiSecenegi && (
                <button
                  type="button"
                  onClick={() => {
                    onHepsiSec?.()
                    setArama('')
                    setAcik(false)
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-bakery-cream-50"
                >
                  Tüm Müşteriler
                  {seciliMusteriId === null && <Check size={14} className="text-bakery-amber-600" />}
                </button>
              )}
              {filtrelenmis.length === 0 ? (
                <p className="px-3 py-3 text-sm text-bakery-ink-400">Müşteri bulunamadı.</p>
              ) : (
                filtrelenmis.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSec(m)
                      setArama('')
                      setAcik(false)
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-bakery-cream-50"
                  >
                    <span>
                      {m.ad}
                      {m.telefon && <span className="ml-1.5 text-bakery-ink-400">{m.telefon}</span>}
                    </span>
                    {m.id === seciliMusteriId && <Check size={14} className="text-bakery-amber-600" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
