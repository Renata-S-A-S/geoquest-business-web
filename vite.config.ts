import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Mobile-first + PWA (issue #11, ADR pendiente — supersede parcial de
 * ADR-047). El Portal B2B pasó de "panel de escritorio" a "todo es
 * mobile-first, también usable desde el navegador" por decisión del
 * founder — ver Confluence, "⚛️ Arquitectura Frontend — Portal B2B".
 *
 * Config espejo de `geoquest-web`, con `name`/`short_name` propios para que
 * ambas PWAs se instalen como apps separadas en el mismo dispositivo.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      injectRegister: null, // el hook de React registra; sin script inline extra
      devOptions: { enabled: false },
      manifest: {
        name: 'GeoQuest Negocios',
        short_name: 'GQ Negocios',
        description: 'Panel de gestión para negocios aliados de GeoQuest.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#10262B',
        background_color: '#10262B',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell únicamente. Sin respuestas de API ni el propio
        // mockServiceWorker.js — precachearlo generaría dos service workers
        // compitiendo por el mismo scope. PNG excluido a propósito: los
        // íconos del manifest se piden al momento de instalar.
        globPatterns: ['**/*.{js,css,html}', 'favicon.svg'],
        globIgnores: ['**/mockServiceWorker.js'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html', // SPA fallback (explícito, coincide con el default)
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
