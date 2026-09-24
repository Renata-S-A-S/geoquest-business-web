import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { stubPrefersColorScheme } from '@/test/match-media'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useResolvedTheme } from './use-resolved-theme'

describe('useResolvedTheme', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useThemeStore.setState({ mode: 'system' })
  })

  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('mode=%s, prefersDark=%s -> %s', (mode, prefersDark, expected) => {
    stubPrefersColorScheme(prefersDark)
    useThemeStore.setState({ mode })

    const { result } = renderHook(() => useResolvedTheme())

    expect(result.current).toBe(expected)
  })

  it('vuelve a resolver a "dark" cuando la preferencia del SO cambia mientras el modo sigue en "system"', () => {
    const stub = stubPrefersColorScheme(false)
    useThemeStore.setState({ mode: 'system' })

    const { result } = renderHook(() => useResolvedTheme())
    expect(result.current).toBe('light')

    act(() => {
      stub.emitChange()
    })

    expect(result.current).toBe('dark')
  })

  it('recae en "light" cuando matchMedia no está disponible, sin lanzar', () => {
    const original = window.matchMedia
    // @ts-expect-error -- simula un entorno sin matchMedia en absoluto,
    // el estado real de jsdom antes de instalar el stub de esta suite.
    delete window.matchMedia
    useThemeStore.setState({ mode: 'system' })

    const { result } = renderHook(() => useResolvedTheme())

    expect(result.current).toBe('light')

    window.matchMedia = original
  })
})
