import { beforeEach, describe, expect, it } from 'vitest'

/**
 * `import(specifier + '?tag')` fuerza una instancia de módulo realmente
 * nueva (su propio `create()`) dentro de un mismo archivo de test — la
 * única forma de probar rehidratación entre "instancias" sin reiniciar el
 * proceso de test.
 */
async function importFreshThemeStore(tag: string) {
  const specifier = '@/shared/stores/theme-store?' + tag
  return import(specifier) as Promise<typeof import('@/shared/stores/theme-store')>
}

describe('theme-store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('arranca en modo "system" antes de cualquier elección explícita', async () => {
    const { useThemeStore } = await importFreshThemeStore('default-0')
    expect(useThemeStore.getState().mode).toBe('system')
  })

  it('persiste la forma literal exacta de zustand al llamar setMode("dark")', async () => {
    const { useThemeStore } = await importFreshThemeStore('literal-0')
    useThemeStore.getState().setMode('dark')

    const raw = window.localStorage.getItem('geoquest-business.theme')
    expect(raw).toBe('{"state":{"mode":"dark"},"version":1}')
  })

  it('setMode("light") actualiza el estado en memoria y rehidrata una instancia nueva con el mismo valor', async () => {
    const { useThemeStore: firstInstance } = await importFreshThemeStore('rehydrate-0')
    firstInstance.getState().setMode('light')
    expect(firstInstance.getState().mode).toBe('light')

    const { useThemeStore: secondInstance } = await importFreshThemeStore('rehydrate-1')
    await secondInstance.persist.rehydrate()

    expect(secondInstance.getState().mode).toBe('light')
  })

  it('setMode("system") después de una elección explícita previa vuelve a persistir "system"', async () => {
    const { useThemeStore } = await importFreshThemeStore('roundtrip-0')
    useThemeStore.getState().setMode('dark')
    useThemeStore.getState().setMode('system')

    const raw = window.localStorage.getItem('geoquest-business.theme')
    expect(raw).toBe('{"state":{"mode":"system"},"version":1}')
  })
})
