import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ToastItem {
  id: number
  mesaj: string
  tip: 'basari' | 'hata'
}

interface ToastApi {
  basari: (mesaj: string) => void
  hata: (mesaj: string) => void
}

const ToastContext = createContext<ToastApi>({ basari: () => {}, hata: () => {} })

let sayac = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const goster = useCallback((mesaj: string, tip: ToastItem['tip']) => {
    const id = ++sayac
    setToasts((t) => [...t, { id, mesaj, tip }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const api: ToastApi = {
    basari: (mesaj) => goster(mesaj, 'basari'),
    hata: (mesaj) => goster(mesaj, 'hata')
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-elevated animate-slide-up ${
              t.tip === 'basari' ? 'bg-bakery-success' : 'bg-bakery-danger'
            }`}
          >
            {t.tip === 'basari' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {t.mesaj}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
