import { useCallback, useEffect, useState } from 'react'

const KONTROL_ARALIGI_MS = 10 * 60 * 1000

/**
 * Yeni bir sürüm yayınlandığında bunu fark edip üst menüdeki Güncelle
 * butonunu vurgulamak için. Service worker (src/sw.ts) kendini hemen aktif
 * ediyor (skipWaiting + clientsClaim), ama açık sayfa hâlâ eski JS'i
 * çalıştırıyor — sayfa yenilenene kadar yeni sürüm görünmez. Bu hook yeni
 * service worker'ın devraldığını yakalar; butona basınca sayfa yenilenir.
 */
export function useGuncelleme() {
  const [guncellemeVar, setGuncellemeVar] = useState(false)
  const [kontrolEdiliyor, setKontrolEdiliyor] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const sw = navigator.serviceWorker
    // İlk kurulumda da controllerchange tetiklenir — o bir "güncelleme" değil.
    let oncedenKontrolVardi = !!sw.controller

    const kontrolDegisti = () => {
      if (oncedenKontrolVardi) setGuncellemeVar(true)
      oncedenKontrolVardi = true
    }
    sw.addEventListener('controllerchange', kontrolDegisti)

    const kontrolEt = () => {
      sw.getRegistration().then((r) => r?.update()).catch(() => {})
    }
    const gorunurOldu = () => {
      if (document.visibilityState === 'visible') kontrolEt()
    }
    document.addEventListener('visibilitychange', gorunurOldu)
    const zamanlayici = window.setInterval(kontrolEt, KONTROL_ARALIGI_MS)
    kontrolEt()

    return () => {
      sw.removeEventListener('controllerchange', kontrolDegisti)
      document.removeEventListener('visibilitychange', gorunurOldu)
      window.clearInterval(zamanlayici)
    }
  }, [])

  /** Güncelleme hazırsa sayfayı yeniler; değilse sunucuda yeni sürüm var mı
   * diye bakar. Dönen değer: true = yenileniyor, false = zaten güncel. */
  const guncelle = useCallback(async (): Promise<boolean> => {
    if (guncellemeVar) {
      window.location.reload()
      return true
    }
    if (!('serviceWorker' in navigator)) {
      window.location.reload()
      return true
    }
    setKontrolEdiliyor(true)
    try {
      const r = await navigator.serviceWorker.getRegistration()
      await r?.update()
      // Yeni sürüm bulunduysa kurulup devralması birkaç saniye sürer.
      const yeniVar = await new Promise<boolean>((resolve) => {
        if (!r?.installing && !r?.waiting) return resolve(false)
        const sure = window.setTimeout(() => resolve(true), 8000)
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            window.clearTimeout(sure)
            resolve(true)
          },
          { once: true }
        )
      })
      if (yeniVar) {
        window.location.reload()
        return true
      }
      return false
    } catch {
      return false
    } finally {
      setKontrolEdiliyor(false)
    }
  }, [guncellemeVar])

  return { guncellemeVar, kontrolEdiliyor, guncelle }
}
