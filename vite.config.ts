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
