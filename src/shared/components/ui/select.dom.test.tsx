import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Select, type SelectOption } from './select'

const OPTIONS: SelectOption[] = [
  { label: 'Restaurante', value: 'restaurant' },
  { label: 'Café', value: 'cafe' },
  { label: 'Bar', value: 'bar' },
]

/** Wrapper controlado — el issue pide `value`/`onChange` explícitos, no un
 * modo no controlado, así que las pruebas de selección lo ejercitan real. */
function ControlledSelect(props: Partial<React.ComponentProps<typeof Select>> = {}) {
  const [value, setValue] = useState<string | null>(props.value ?? null)
  return (
    <Select
      options={OPTIONS}
      value={value}
      onChange={setValue}
      placeholder="Elegí una categoría"
      {...props}
    />
  )
}

describe('Select', () => {
  it('muestra el placeholder cuando no hay value', () => {
    render(
      <Select options={OPTIONS} value={null} onChange={vi.fn()} placeholder="Elegí una categoría" />
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('Elegí una categoría')
  })

  it('muestra el label de la opción seleccionada, no su value crudo', () => {
    render(<Select options={OPTIONS} value="cafe" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Café')
  })

  it('no muestra el listbox hasta que se abre', () => {
    render(<Select options={OPTIONS} value={null} onChange={vi.fn()} />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('abre el listbox al clickear el trigger y lista las opciones', () => {
    render(<Select options={OPTIONS} value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('combobox'))

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('clickear una opción llama a onChange con su value y cierra el listbox', () => {
    const onChange = vi.fn()
    render(<Select options={OPTIONS} value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Bar' }))

    expect(onChange).toHaveBeenCalledWith('bar')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('integración controlada: seleccionar una opción actualiza el texto del trigger', () => {
    render(<ControlledSelect />)

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Restaurante' }))

    expect(screen.getByRole('combobox')).toHaveTextContent('Restaurante')
  })

  it('ArrowDown abre el listbox y resalta la primera opción', () => {
    render(<Select options={OPTIONS} value={null} onChange={vi.fn()} />)
    const trigger = screen.getByRole('combobox')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(trigger).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Restaurante' }).id
    )
  })

  it('ArrowDown repetido mueve el resaltado sin salirse del final de la lista', () => {
    render(<Select options={OPTIONS} value={null} onChange={vi.fn()} />)
    const trigger = screen.getByRole('combobox')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // Restaurante
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // Café
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // Bar
    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // se queda en Bar

    expect(trigger).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Bar' }).id
    )
  })

  it('ArrowUp mueve el resaltado hacia arriba sin bajar del inicio', () => {
    render(<Select options={OPTIONS} value="bar" onChange={vi.fn()} />)
    const trigger = screen.getByRole('combobox')

    fireEvent.keyDown(trigger, { key: 'ArrowUp' }) // abre resaltando el seleccionado (Bar)
    fireEvent.keyDown(trigger, { key: 'ArrowUp' }) // Café
    fireEvent.keyDown(trigger, { key: 'ArrowUp' }) // Restaurante
    fireEvent.keyDown(trigger, { key: 'ArrowUp' }) // se queda en Restaurante

    expect(trigger).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Restaurante' }).id
    )
  })

  it('Enter confirma la opción resaltada y cierra el listbox', () => {
    const onChange = vi.fn()
    render(<Select options={OPTIONS} value={null} onChange={onChange} />)
    const trigger = screen.getByRole('combobox')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('cafe')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('Escape cierra el listbox sin llamar a onChange', () => {
    const onChange = vi.fn()
    render(<Select options={OPTIONS} value={null} onChange={onChange} />)
    const trigger = screen.getByRole('combobox')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clickear afuera cierra el listbox', () => {
    render(
      <div>
        <Select options={OPTIONS} value={null} onChange={vi.fn()} />
        <button>afuera</button>
      </div>
    )

    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('button', { name: 'afuera' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('label explícito: renderiza <label> asociado al trigger vía htmlFor/id', () => {
    render(<Select options={OPTIONS} value={null} onChange={vi.fn()} label="Categoría" />)
    expect(screen.getByLabelText('Categoría')).toBe(screen.getByRole('combobox'))
  })

  it('aria-labelledby: usa un label externo en vez de renderizar uno propio', () => {
    render(
      <div>
        <span id="external-label">Categoría externa</span>
        <Select
          options={OPTIONS}
          value={null}
          onChange={vi.fn()}
          aria-labelledby="external-label"
        />
      </div>
    )

    const combobox = screen.getByRole('combobox')
    expect(combobox).toHaveAttribute('aria-labelledby', 'external-label')
    expect(screen.queryByText('Categoría')).not.toBeInTheDocument()
  })

  it('disabled evita que el trigger se pueda abrir', () => {
    render(<Select options={OPTIONS} value={null} onChange={vi.fn()} disabled />)
    const trigger = screen.getByRole('combobox')

    expect(trigger).toBeDisabled()
    fireEvent.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('marca aria-selected=true solo en la opción que coincide con value', () => {
    render(<Select options={OPTIONS} value="cafe" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('combobox'))

    expect(screen.getByRole('option', { name: 'Restaurante' })).toHaveAttribute(
      'aria-selected',
      'false'
    )
    expect(screen.getByRole('option', { name: 'Café' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Bar' })).toHaveAttribute('aria-selected', 'false')
  })

  it('clickear el trigger ya abierto lo cierra (toggle)', () => {
    render(<Select options={OPTIONS} value={null} onChange={vi.fn()} />)
    const trigger = screen.getByRole('combobox')

    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('pasar el mouse sobre una opción la resalta (aria-activedescendant)', () => {
    render(<Select options={OPTIONS} value={null} onChange={vi.fn()} />)
    const trigger = screen.getByRole('combobox')

    fireEvent.click(trigger)
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'Bar' }))

    expect(trigger).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Bar' }).id
    )
  })

  it('ignora teclas sin comportamiento asignado', () => {
    const onChange = vi.fn()
    render(<Select options={OPTIONS} value={null} onChange={onChange} />)
    const trigger = screen.getByRole('combobox')

    fireEvent.keyDown(trigger, { key: 'a' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
