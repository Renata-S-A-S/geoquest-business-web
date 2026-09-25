import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { LanguageSwitcher } from './language-switcher'

afterEach(async () => {
  await i18next.changeLanguage('es')
})

describe('LanguageSwitcher', () => {
  it('ofrece exactamente los dos idiomas que la app tiene', () => {
    render(<LanguageSwitcher />)

    const options = screen.getAllByRole('button')
    expect(options).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Español' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inglés' })).toBeInTheDocument()
  })

  it('marca el idioma activo con aria-pressed', () => {
    render(<LanguageSwitcher />)

    expect(screen.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Inglés' })).toHaveAttribute('aria-pressed', 'false')
  })

  /**
   * La prueba de que sirve: no alcanza con que el botón cambie de estado, la
   * interfaz tiene que quedar traducida. Este caso verifica que el propio
   * rótulo del selector pasa a inglés, o sea que `changeLanguage` surtió
   * efecto sobre el árbol y no solo sobre el estado interno de i18next.
   */
  it('cambia el idioma de la interfaz al elegir el otro', async () => {
    render(<LanguageSwitcher />)

    fireEvent.click(screen.getByRole('button', { name: 'Inglés' }))

    expect(await screen.findByRole('group', { name: 'Language' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('agrupa las opciones con un nombre accesible', () => {
    render(<LanguageSwitcher />)

    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument()
  })
})
