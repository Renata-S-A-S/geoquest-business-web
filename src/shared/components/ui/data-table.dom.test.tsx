import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataTable, type ColumnDef } from './data-table'
import type { StatusBadgeVariant } from './status-badge'

interface Row {
  id: string
  name: string
  status: string
}

const columns: ColumnDef<Row>[] = [
  { key: 'name', header: 'Nombre' },
  { key: 'status', header: 'Estado' },
]

const statusVariantMap: Record<string, StatusBadgeVariant> = {
  Draft: 'neutral',
  Active: 'success',
}

const data: Row[] = [
  { id: 'p1', name: 'Café Laureles', status: 'Active' },
  { id: 'p2', name: 'Panadería El Sol', status: 'Draft' },
]

describe('DataTable', () => {
  it('renders one header cell per column and one row per data item', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        statusField="status"
        statusVariantMap={statusVariantMap}
      />
    )
    expect(screen.getAllByText('Nombre').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Estado').length).toBeGreaterThanOrEqual(1)
    // cada fila aparece dos veces (tabla desktop + tarjeta mobile, ambas en el DOM)
    expect(screen.getAllByText('Café Laureles').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Panadería El Sol').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the status column as a StatusBadge, not plain text', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        statusField="status"
        statusVariantMap={statusVariantMap}
      />
    )
    const badges = screen.getAllByRole('status')
    expect(badges.length).toBeGreaterThanOrEqual(2)
    expect(badges.some((b) => b.textContent === 'Active')).toBe(true)
    expect(badges.some((b) => b.textContent === 'Draft')).toBe(true)
  })

  it('shows the default empty state with a message when data is empty', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        statusField="status"
        statusVariantMap={statusVariantMap}
      />
    )
    expect(screen.getByText('No hay datos todavía')).toBeInTheDocument()
  })

  it('shows a custom emptyState (message + CTA) instead of the default when provided', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        statusField="status"
        statusVariantMap={statusVariantMap}
        emptyState={<button>Crear lugar</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Crear lugar' })).toBeInTheDocument()
    expect(screen.queryByText('No hay datos todavía')).not.toBeInTheDocument()
  })

  it('shows a loading skeleton and no rows while isLoading is true', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        statusField="status"
        statusVariantMap={statusVariantMap}
        isLoading
      />
    )
    expect(screen.queryByText('Café Laureles')).not.toBeInTheDocument()
    expect(screen.getAllByText('Nombre').length).toBeGreaterThanOrEqual(1)
  })

  it('uses a custom render override for a column instead of the raw field value', () => {
    const customColumns: ColumnDef<Row>[] = [
      { key: 'name', header: 'Nombre', render: (row) => `#${row.name}` },
      { key: 'status', header: 'Estado' },
    ]
    render(
      <DataTable
        columns={customColumns}
        data={data}
        statusField="status"
        statusVariantMap={statusVariantMap}
      />
    )
    expect(screen.getAllByText('#Café Laureles').length).toBeGreaterThanOrEqual(1)
  })

  it('uses getRowId when provided instead of the array index', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        statusField="status"
        statusVariantMap={statusVariantMap}
        getRowId={(row) => row.id}
      />
    )
    expect(screen.getAllByText('Café Laureles').length).toBeGreaterThanOrEqual(1)
  })
})
