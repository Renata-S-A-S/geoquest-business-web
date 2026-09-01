import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  // VitePWA no corre bajo Vitest, así que este módulo virtual no tiene
  // resolver acá — el stub mantiene `vi.mock` resoluble en *.dom.test.tsx.
  'virtual:pwa-register/react': fileURLToPath(
    new URL('./src/test/pwa-register-stub.ts', import.meta.url)
  ),
}

/**
 * WU6: gate bloqueante agregado, con el baseline REALMENTE medido al cierre
 * del scaffold (`npm run test:coverage`, clean `npm ci`, 29 ago 2026):
 * statements 80.76%, branches 89.47%, functions 75%, lines 81.45%.
 * enforced = floor(measured/5)*5 — mismo criterio de geoquest-web, pero sin
 * copiar su número: acá no hay un "target" heredado, este ES el primer
 * baseline del repo. Nunca bajar estos números para forzar un build rojo a
 * verde — si cae, se sube cobertura real, no el umbral.
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
      thresholds: {
        statements: 80,
        branches: 85,
        functions: 75,
        lines: 80,
      },
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
