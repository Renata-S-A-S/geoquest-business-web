import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { stubPrefersColorScheme } from '@/test/match-media'
import { useThemeStore } from '@/shared/stores/theme-store'
import { AppProviders } from './providers'

describe('AppProviders', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    useThemeStore.setState({ mode: 'system' })
  })

  it('monta ThemeEffects como hermano y aplica el tema oscuro resuelto al montar', () => {
    useThemeStore.setState({ mode: 'dark' })
    stubPrefersColorScheme(false)

    render(
      <AppProviders>
        <div>contenido</div>
      </AppProviders>
    )

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('no interfiere con el render normal de los children', () => {
    stubPrefersColorScheme(false)

    const { getByText } = render(
      <AppProviders>
        <div>contenido</div>
      </AppProviders>
    )

    expect(getByText('contenido')).toBeInTheDocument()
  })
})
