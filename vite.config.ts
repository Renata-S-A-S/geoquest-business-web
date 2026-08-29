import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * A diferencia de `geoquest-web`, este proyecto NO usa `vite-plugin-pwa`.
 * El Portal B2B es un panel de gestión de escritorio, no una PWA de campo
 * — ver "Diferencias deliberadas" en `plan-geoquest-business-web.md`.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
