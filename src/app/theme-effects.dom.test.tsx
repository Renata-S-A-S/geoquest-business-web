import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { stubPrefersColorScheme } from '@/test/match-media'
import { THEME_COLOR_META } from '@/shared/lib/theme'
import { useThemeStore } from '@/shared/stores/theme-store'
import { ThemeEffects } from './theme-effects'

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

describe('ThemeEffects', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    setMeta('#ABCDEF')
    useThemeStore.setState({ mode: 'system' })
  })

  it('no renderiza ningún nodo en el DOM', () => {
    stubPrefersColorScheme(false)

    const { container } = render(<ThemeEffects />)

    expect(container).toBeEmptyDOMElement()
  })

  it('aplica la clase "dark" en <html> y el meta theme-color oscuro cuando el modo persistido es "dark"', () => {
    useThemeStore.setState({ mode: 'dark' })
    stubPrefersColorScheme(false)

    render(<ThemeEffects />)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaContent()).toBe(THEME_COLOR_META.dark)
  })

  it('remueve la clase "dark" y aplica el meta claro cuando el modo persistido es "light"', () => {
    document.documentElement.classList.add('dark')
    useThemeStore.setState({ mode: 'light' })
    stubPrefersColorScheme(true)

    render(<ThemeEffects />)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(getMetaContent()).toBe(THEME_COLOR_META.light)
  })

  it('reacciona a un cambio del tema resuelto después del montaje, sin desmontar', () => {
    useThemeStore.setState({ mode: 'light' })
    stubPrefersColorScheme(false)

    render(<ThemeEffects />)
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    act(() => {
      useThemeStore.setState({ mode: 'dark' })
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getMetaContent()).toBe(THEME_COLOR_META.dark)
  })
})
