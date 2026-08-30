import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
}

/**
 * WU1: coverage habilitado, SIN thresholds todavía — no hay código real que
 * medir. El gate bloqueante se agrega en WU6, con el baseline realmente
 * medido sobre el scaffold terminado (mismo criterio que usó geoquest-web:
 * baseline medido, nunca un número inventado ni copiado). Ver
 * plan-geoquest-business-web.md, Paso 4.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/app/routes.tsx',
        'src/shared/lib/i18n.ts',
        'src/test/**',
        'src/**/*.d.ts',
        'src/vite-env.d.ts',
        'src/**/*.test.{ts,tsx}',
      ],
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.dom.test.*'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.dom.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup-dom.ts'],
        },
      },
    ],
  },
})
