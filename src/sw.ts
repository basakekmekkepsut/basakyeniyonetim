/// <reference lib="webworker" />
// Bu dosya, tsconfig.json'da bilerek dışlanmıştır (DOM ile WebWorker tipleri
// aynı anda tsc kontrolünden geçirilemez) — Vite kendi esbuild derleyicisiyle
// bu dosyayı ayrı bağlamda (service worker) derler.

import { clientsClaim } from 'workbox-core'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

// Ana uygulama tek sayfa (SPA) olduğu için eşleşmeyen tüm gezinmeler index.html'e
// düşer — ANCAK portal.html ve uretim.html kendi başlarına ayrı statik dosyalar
// olduğu için bu fallback'ten HARİÇ tutulur (aksi halde müşteri portalı/üretim
// özeti personel giriş ekranına yönlendirilir).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/portal\.html/, /^\/uretim\.html/]
  })
)
