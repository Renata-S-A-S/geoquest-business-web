import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import i18next from '@/test/i18n'
import { LegalDisclosure } from './legal-disclosure'

/**
 * `features/onboarding/*` normalmente no lleva tests propios — sus módulos se
 * ejercitan desde `register-form.dom.test.tsx`. Este archivo es la excepción
 * deliberada: el fallback de `warning` es una rama que NINGÚN consumidor
 * recorre, porque tanto #23 como #24 pasan su aviso específico. Sin este
 * test la red de seguridad de #61 quedaría sin cubrir y sin verificar.
 */
describe('LegalDisclosure', () => {
  it('uses the warning it is given', () => {
    render(<LegalDisclosure summary="Leer" body="Cuerpo" warning="Aviso específico" />)
    expect(screen.getByText('Aviso específico')).toBeInTheDocument()
  })

  it('falls back to the generic non-binding warning when none is given', () => {
    render(<LegalDisclosure summary="Leer" body="Cuerpo" />)
    expect(
      screen.getByText('Texto provisional. No constituye un documento vinculante.')
    ).toBeInTheDocument()
  })

  it('localizes the fallback warning', async () => {
    await i18next.changeLanguage('en')
    render(<LegalDisclosure summary="Read" body="Body" />)
    expect(
      screen.getByText('Provisional text. This is not a binding document.')
    ).toBeInTheDocument()
  })

  it('always renders a warning — the slot cannot be turned off', () => {
    const { container } = render(<LegalDisclosure summary="Leer" body="Cuerpo" />)
    // El aviso vive en el primer <p> del cuerpo desplegable; que exista es
    // la garantía estructural de #61, independiente de qué texto lleve.
    expect(container.querySelectorAll('details > div > p')).toHaveLength(2)
  })
})
