/// <reference lib="webworker" />
// Bu dosya, tsconfig.json'da bilerek dışlanmıştır (DOM ile WebWorker tipleri
// aynı anda tsc kontrolünden geçirilemez) — Vite kendi esbuild derleyicisiyle
// bu dosyayı ayrı bağlamda (service worker) derler.

import { clientsClaim } from 'workbox-core'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

// Ana uygulama tek sayfa (SPA) olduğu için eşleşmeyen tüm gezinmeler index.html'e
// düşer — ANCAK portal.html kendi başına ayrı bir statik dosya olduğu için bu
// fallback'ten HARİÇ tutulur (aksi halde müşteri portalı personel giriş ekranına
// yönlendirilir, bkz. vite.config.ts'deki önceki generateSW yapılandırmasının
// tarihi ve bu satırların eklenme nedeni).
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/portal\.html/]
  })
)

// --- Push bildirimleri (FCM) — uygulama/sekme kapalıyken de bildirim gösterir ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

if (firebaseConfig.apiKey) {
  const app = initializeApp(firebaseConfig)
  const messaging = getMessaging(app)
  onBackgroundMessage(messaging, (payload) => {
    const baslik = payload.notification?.title ?? 'Başak Ekmek'
    self.registration.showNotification(baslik, {
      body: payload.notification?.body ?? '',
      icon: '/logo.webp',
      badge: '/logo.webp',
      data: payload.fcmOptions?.link ?? payload.data?.link ?? '/'
    })
  })

  self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const hedefUrl = (event.notification.data as string) || '/'
    event.waitUntil(self.clients.openWindow(hedefUrl))
  })
}
