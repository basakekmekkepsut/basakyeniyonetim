import { useCallback, useEffect, useState } from 'react'

const KONTROL_ARALIGI_MS = 10 * 60 * 1000

/** Sunucuda yayında olan sürüm (build sırasında yazılan /version.json). Okunamazsa null. */
async function sunucuSurumu(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const veri = (await r.json()) as { version?: string }
    return veri.version ?? null
  } catch {
    return null
  }
}

/**
 * Service worker'ı ve tüm önbellekleri silip sayfayı yeniden yükler — telefonda
 * eski sürümde takılı kalmış bir service worker olsa bile yeni sürüm doğrudan
 * sunucudan gelir (sonraki açılışta service worker yeniden kurulur).
 */
async function zorlaYenile(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const kayitlar = await navigator.serviceWorker.getRegistrations()
      await Promise.all(kayitlar.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const anahtarlar = await caches.keys()
      await Promise.all(anahtarlar.map((k) => caches.delete(k)))
    }
  } catch {
    // temizlik başarısız olsa da yenilemeyi dene
  }
  window.location.reload()
}

/**
 * Yeni sürüm yayınlandığında üst menüdeki Güncelle butonunu vurgular ve
 * basınca yeni sürümü yükler. Karar service worker'a değil, sunucudaki
 * /version.json ile çalışan sürümün (__APP_VERSION__) karşılaştırılmasına
 * dayanır — service worker güncellemesi telefonda takılsa bile çalışır.
 */
export function useGuncelleme() {
  const [guncellemeVar, setGuncellemeVar] = useState(false)
  const [kontrolEdiliyor, setKontrolEdiliyor] = useState(false)

  useEffect(() => {
    const kontrolEt = async () => {
      // Service worker'a da yeni sürümü kurmasını söyle (arka planda hazırlansın).
      navigator.serviceWorker
        ?.getRegistration()
        .then((r) => r?.update())
        .catch(() => {})
      const surum = await sunucuSurumu()
      if (surum && surum !== __APP_VERSION__) setGuncellemeVar(true)
    }
    const gorunurOldu = () => {
      if (document.visibilityState === 'visible') kontrolEt()
    }
    document.addEventListener('visibilitychange', gorunurOldu)
    const zamanlayici = window.setInterval(kontrolEt, KONTROL_ARALIGI_MS)
    kontrolEt()

    return () => {
      document.removeEventListener('visibilitychange', gorunurOldu)
      window.clearInterval(zamanlayici)
    }
  }, [])

  /** Dönen değer: true = yenileniyor, false = zaten güncel, null = sunucuya ulaşılamadı. */
  const guncelle = useCallback(async (): Promise<boolean | null> => {
    setKontrolEdiliyor(true)
    try {
      const surum = await sunucuSurumu()
      if (surum === null) return null
      if (surum !== __APP_VERSION__) {
        await zorlaYenile()
        return true
      }
      return false
    } finally {
      setKontrolEdiliyor(false)
    }
  }, [])

  return { guncellemeVar, kontrolEdiliyor, guncelle }
}
