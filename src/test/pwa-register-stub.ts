/**
 * Stub de `virtual:pwa-register/react`, aliaseado en `vitest.config.ts`.
 *
 * VitePWA no corre bajo Vitest — el módulo virtual real no tiene resolver
 * en ese entorno — así que este archivo existe solo para que
 * `vi.mock('virtual:pwa-register/react', ...)` tenga algo que overridear
 * por test. Excluido de coverage (`src/test/**`).
 */
export interface RegisterSWResult {
  needRefresh: [boolean, (value: boolean) => void]
  offlineReady: [boolean, (value: boolean) => void]
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
}

export function useRegisterSW(): RegisterSWResult {
  return {
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  }
}
