import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeSwitcher } from './theme-switcher'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useResolvedTheme } from '@/shared/hooks/use-resolved-theme'
import { stubPrefersColorScheme } from '@/test/match-media'

/** Sonda mínima para exponer `useResolvedTheme()` en el DOM sin acoplar el
 *  test a `ThemeEffects` (que pertenece a PR3b) — solo nos interesa que la
 *  elección explícita del store le gane a la preferencia del SO. */
function ResolvedProbe() {
  const resolved = useResolvedTheme()
  return <span data-testid="resolved">{resolved}</span>
}

function renderSwitcherWithProbe() {
  return render(
    <>
      <ThemeSwitcher />
      <ResolvedProbe />
    </>
  )
}

describe('ThemeSwitcher', () => {
  it('renders a role="group" with three options: light, dark, system', () => {
    render(<ThemeSwitcher />)

    const group = screen.getByRole('group', { name: 'Tema' })
    expect(within(group).getByRole('button', { name: 'Claro' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'Oscuro' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'Sistema' })).toBeInTheDocument()
  })

  it('each option sets the corresponding mode on useThemeStore', () => {
    render(<ThemeSwitcher />)

    fireEvent.click(screen.getByRole('button', { name: 'Claro' }))
    expect(useThemeStore.getState().mode).toBe('light')

    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }))
    expect(useThemeStore.getState().mode).toBe('dark')

    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }))
    expect(useThemeStore.getState().mode).toBe('system')
  })

  it('aria-pressed reflects the active mode and only one option is pressed at a time', () => {
    render(<ThemeSwitcher />)
    const light = screen.getByRole('button', { name: 'Claro' })
    const dark = screen.getByRole('button', { name: 'Oscuro' })
    const system = screen.getByRole('button', { name: 'Sistema' })

    // `system` es el default del store (theme-store.ts).
    expect(system).toHaveAttribute('aria-pressed', 'true')
    expect(light).toHaveAttribute('aria-pressed', 'false')
    expect(dark).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(dark)

    expect(dark).toHaveAttribute('aria-pressed', 'true')
    expect(light).toHaveAttribute('aria-pressed', 'false')
    expect(system).toHaveAttribute('aria-pressed', 'false')
  })

  it('picking light while the OS prefers dark results in light — the override beats the OS', () => {
    stubPrefersColorScheme(true)
    renderSwitcherWithProbe()

    // Con `mode: 'system'` (default) y el SO en oscuro, el resuelto arranca oscuro.
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')

    fireEvent.click(screen.getByRole('button', { name: 'Claro' }))

    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
    expect(useThemeStore.getState().mode).toBe('light')
  })
})
