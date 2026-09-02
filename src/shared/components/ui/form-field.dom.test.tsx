import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from './form-field'
import { Input } from './input'

describe('FormField', () => {
  it('asocia el label al control vía htmlFor/id', () => {
    render(
      <FormField htmlFor="legalName" label="Nombre legal" errorId="legalName-error">
        <Input id="legalName" />
      </FormField>
    )

    expect(screen.getByLabelText('Nombre legal')).toBe(screen.getByRole('textbox'))
  })

  it('no renderiza ningún mensaje de error cuando no se pasa `error`', () => {
    render(
      <FormField htmlFor="legalName" label="Nombre legal" errorId="legalName-error">
        <Input id="legalName" />
      </FormField>
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renderiza el error con role="alert" e id conectable vía aria-describedby', () => {
    render(
      <FormField
        htmlFor="legalName"
        label="Nombre legal"
        errorId="legalName-error"
        error="Campo requerido"
      >
        <Input id="legalName" aria-describedby="legalName-error" />
      </FormField>
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Campo requerido')
    expect(alert).toHaveAttribute('id', 'legalName-error')
  })

  it('expone un id de label predecible para conectar aria-labelledby (caso Select)', () => {
    render(
      <FormField htmlFor="category" label="Categoría" errorId="category-error">
        <span />
      </FormField>
    )

    expect(document.getElementById('category-label')).toHaveTextContent('Categoría')
  })
})
