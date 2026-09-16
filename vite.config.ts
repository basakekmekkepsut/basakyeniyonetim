import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.webp'],
      manifest: {
        name: 'Başak Ekmek Yönetim',
        short_name: 'Başak Ekmek',
        description: 'Sipariş, Veresiye/Cari ve Okul modüllerini tek ekrandan yöneten Başak Ekmek Fırını yönetim uygulaması.',
        theme_color: '#7c4a2d',
        background_color: '#fdf6ec',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/logo.webp', sizes: '1092x1092', type: 'image/webp', purpose: 'any' },
          { src: '/logo.webp', sizes: '1092x1092', type: 'image/webp', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
        // Service worker kaydı hem ana uygulamadan hem de portal.html'den erişilebilen
        // TEK bir origin'i kapsar. Bu denylist olmadan, ana uygulamayı bir kez ziyaret
        // eden herhangi bir cihaz (personel ya da müşteri), sonradan portal.html'e
        // gitmeye çalıştığında da servis çalışanı isteği index.html'e (personel giriş
        // ekranı) yönlendirir — müşteri portalı hiç açılmaz.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/portal\.html/]
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
