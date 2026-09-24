import { describe, expect, it } from 'vitest'
import esCommon from './es/common.json'
import enCommon from './en/common.json'

/**
 * Paridad de claves del namespace `theme` entre ES y EN. `ThemeSwitcher`
 * (design decisión D-2, sección "theme-switcher.tsx") depende de que ambos
 * locales expongan exactamente el mismo conjunto de claves — con
 * `returnNull: false` (test/i18n.ts) una clave faltante no rompe el build,
 * degrada en silencio a la clave cruda como texto visible.
 */
describe('common.json — paridad de claves theme.*', () => {
  it('ES y EN exponen el mismo conjunto de claves bajo "theme"', () => {
    expect(Object.keys(esCommon.theme).sort()).toEqual(Object.keys(enCommon.theme).sort())
  })

  it('cada clave esperada existe con una traducción no vacía en ambos locales', () => {
    const expectedKeys = ['label', 'light', 'dark', 'system'] as const

    for (const key of expectedKeys) {
      expect(esCommon.theme).toHaveProperty(key)
      expect(enCommon.theme).toHaveProperty(key)
      expect(esCommon.theme[key]).not.toBe('')
      expect(enCommon.theme[key]).not.toBe('')
    }
  })
})
