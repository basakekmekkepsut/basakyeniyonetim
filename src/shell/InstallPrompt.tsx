import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const GIZLENDI_ANAHTARI = 'basak-install-prompt-gizlendi'

export default function InstallPrompt() {
  const [ertelenenOlay, setErtelenenOlay] = useState<BeforeInstallPromptEvent | null>(null)
  const [gizli, setGizli] = useState(true)

  useEffect(() => {
    let kaliciGizli = false
    try {
      kaliciGizli = sessionStorage.getItem(GIZLENDI_ANAHTARI) === '1'
    } catch {
      // sessionStorage erişilemiyor olabilir (gizli sekme vb.) — sorun değil, banner gösterilir.
    }
    if (kaliciGizli) return

    function handler(e: Event) {
      e.preventDefault()
      setErtelenenOlay(e as BeforeInstallPromptEvent)
      setGizli(false)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function kapat() {
    setGizli(true)
    try {
      sessionStorage.setItem(GIZLENDI_ANAHTARI, '1')
    } catch {
      // yoksayılır
    }
  }

  async function yukle() {
    if (!ertelenenOlay) return
    await ertelenenOlay.prompt()
    await ertelenenOlay.userChoice
    setErtelenenOlay(null)
    kapat()
  }

  if (gizli || !ertelenenOlay) return null

  return (
    <div className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-sm items-center gap-3 rounded-xl bg-bakery-coffee-800 px-4 py-3 text-white shadow-lg md:bottom-6">
      <div className="flex-1 text-sm">
        <p className="font-medium">Uygulamayı Yükle</p>
        <p className="text-bakery-cream-100/80">Ana ekranınıza ekleyip uygulama gibi kullanın.</p>
      </div>
      <button
        onClick={yukle}
        className="flex items-center gap-1.5 rounded-lg bg-bakery-amber-500 px-3 py-2 text-sm font-medium hover:bg-bakery-amber-400"
      >
        <Download size={14} />
        Yükle
      </button>
      <button onClick={kapat} className="rounded-full p-1 text-white/70 hover:bg-white/10" aria-label="Kapat">
        <X size={16} />
      </button>
    </div>
  )
}
