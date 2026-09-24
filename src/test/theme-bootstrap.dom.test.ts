import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { stubPrefersColorScheme } from '@/test/match-media'
import { THEME_COLOR_META, THEME_STORAGE_KEY, THEME_STORAGE_VERSION } from '@/shared/lib/theme'

/**
 * Guardia permanente contra divergencia entre el bootstrap de pre-paint
 * embebido en `index.html` (que NO puede importar un módulo — ver diseño,
 * sección "Pre-paint bootstrap") y `src/shared/lib/theme.ts`. Lee el
 * `index.html` real desde disco, extrae el contenido exacto del script
 * `#theme-bootstrap`, y lo evalúa contra un entorno jsdom controlado — así
 * cualquier edición futura de cualquiera de los dos lados que rompa el
 * contrato hace fallar este test.
 */
function extractBootstrapScript(): string {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf-8')
  const match = /<script id="theme-bootstrap">([\s\S]*?)<\/script>/.exec(html)
  if (!match) {
    throw new Error('No se encontró el script theme-bootstrap en index.html')
  }
  return match[1]
}

function runBootstrapScript(): void {
  const script = extractBootstrapScript()
  // Mismo modelo de ejecución que un <script> inline: evaluado contra los
  // globals ambientes de jsdom (`document`, `localStorage`, `matchMedia`),
  // no un scope de módulo — un script inline en <head> no puede importar
  // theme.ts directamente.
  new Function(script)()
}

const UNCHANGED_SENTINEL = '#ABCDEF'

function setMeta(content: string): void {
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove())
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'theme-color')
  meta.setAttribute('content', content)
  document.head.appendChild(meta)
}

function getMetaContent(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null
}

describe('script theme-bootstrap de index.html (guardia contra divergencia)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    setMeta(UNCHANGED_SENTINEL)
  })

  it('lee exactamente el THEME_STORAGE_KEY que usa theme-store.ts', () => {
    expect(extractBootstrapScript()).toContain(`'${THEME_STORAGE_KEY}'`)
  })

  it('usa claro por defecto cuando la clave no existe', () => {
    stubPrefersColorScheme(false)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(getMetaContent()).toBe(THEME_COLOR_META.light)
  })

  it('aplica oscuro cuando el modo persistido es "dark"', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'dark' }, version: THEME_STORAGE_VERSION })
    )
    stubPrefersColorScheme(false)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaContent()).toBe(THEME_COLOR_META.dark)
  })

  it('aplica claro cuando el modo persistido es "light", incluso con preferencia oscura del SO', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'light' }, version: THEME_STORAGE_VERSION })
    )
    stubPrefersColorScheme(true)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(getMetaContent()).toBe(THEME_COLOR_META.light)
  })

  it('resuelve "system" contra la preferencia oscura del SO', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'system' }, version: THEME_STORAGE_VERSION })
    )
    stubPrefersColorScheme(true)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaContent()).toBe(THEME_COLOR_META.dark)
  })

  it('nunca lanza ante JSON corrupto, y deja el DOM sin tocar (la mutación está dentro del try)', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, '{not valid json')
    stubPrefersColorScheme(true)

    expect(() => runBootstrapScript()).not.toThrow()
    // JSON.parse lanza antes de las líneas que mutan classList/meta, así
    // que el DOM queda exactamente como estaba pre-script — probado con el
    // valor centinela, que no es ni THEME_COLOR_META.light ni .dark.
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(getMetaContent()).toBe(UNCHANGED_SENTINEL)
  })

  it('trata un valor de modo no reconocido como "system" (cae a la preferencia del SO, no a un default fijo)', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'sepia' }, version: THEME_STORAGE_VERSION })
    )
    stubPrefersColorScheme(true)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaContent()).toBe(THEME_COLOR_META.dark)
  })

  it('ignora una versión persistida no reconocida y aplica igual el modo válido', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ state: { mode: 'dark' }, version: 99 })
    )
    stubPrefersColorScheme(false)

    runBootstrapScript()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaContent()).toBe(THEME_COLOR_META.dark)
  })
})
