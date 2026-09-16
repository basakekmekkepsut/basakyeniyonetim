import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Push bildirimi (FCM) arka planda mesaj almak için kendi service worker
      // kodumuzu yazmamızı gerektiriyor — bu yüzden hazır generateSW yerine
      // injectManifest stratejisi kullanılıyor (bkz. src/sw.ts).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['logo.webp', 'logo-mark.webp', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Başak Ekmek Yönetim',
        short_name: 'Başak Ekmek',
        description: 'Sipariş, Veresiye/Cari ve Okul modüllerini tek ekrandan yöneten Başak Ekmek Fırını yönetim uygulaması.',
        theme_color: '#7c4a2d',
        background_color: '#fdf6ec',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        id: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/logo.webp', sizes: '1092x1092', type: 'image/webp', purpose: 'any' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}']
      }
    })
  ],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        portal: 'portal.html'
      }
    }
  }
})
