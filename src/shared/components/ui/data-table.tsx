import type { ReactNode } from 'react'
import { Card } from '@/shared/components/ui/card'
import { StatusBadge, type StatusBadgeVariant } from '@/shared/components/ui/status-badge'
import { cn } from '@/shared/lib/cn'

/**
 * Tabla/lista con badge de estado — issue #17 del slice 004c-business-portal-flows.
 * Usada por listado de lugares (#29) y listado de recompensas (#36).
 *
 * Responsive (ADR-047-BF: el portal es desktop-first, "sidebar fijo... el
 * staff opera desde mostrador o escritorio, no en movimiento", pero
 * "debe seguir siendo usable en mobile" — criterio de aceptación de #17):
 * por debajo de `md` (768px) se colapsa a tarjetas apiladas (una `Card` por
 * fila) en vez de una tabla con scroll horizontal roto. El corte se puso en
 * `md`, no en el `lg` (1024px) que usa la navegación (🎨 Identidad de Marca
 * & Sistema de Diseño) — una tabla de datos necesita menos ancho para
 * seguir siendo legible que el rail de navegación.
 */
export interface ColumnDef<T> {
  /** Campo de `T` que esta columna muestra (clave para las tarjetas mobile: "label: valor"). */
  key: keyof T
  header: string
  /** Override del renderizado de celda; por default se muestra `String(row[key])`. */
  render?: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  /** Campo de `T` cuyo valor se muestra como `StatusBadge` en vez de texto plano. */
  statusField: keyof T
  statusVariantMap: Record<string, StatusBadgeVariant>
  isLoading?: boolean
  /** Contenido a mostrar cuando `data.length === 0` (mensaje + CTA — el CTA es responsabilidad del caller, ej. "Crear lugar"). */
  emptyState?: ReactNode
  /** Identificador único de fila para `key`. Default: índice (usar cuando `T` no tenga `id` estable). */
  getRowId?: (row: T, index: number) => string | number
}

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {[0, 1, 2].map((row) => (
        <tr key={row} aria-hidden="true">
          {Array.from({ length: columns }).map((_, col) => (
            <td key={col} className="px-4 py-3">
              <div className="h-3 w-full max-w-[120px] animate-pulse rounded-xs bg-surface-skeleton" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-3 md:hidden" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <Card key={row} className="flex flex-col gap-2">
          <div className="h-3 w-2/3 animate-pulse rounded-xs bg-surface-skeleton" />
          <div className="h-3 w-1/2 animate-pulse rounded-xs bg-surface-skeleton" />
        </Card>
      ))}
    </div>
  )
}

function DefaultEmptyState() {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border px-4 py-8 text-center">
      <span className="font-sans text-sm font-bold text-ink">No hay datos todavía</span>
    </div>
  )
}

export function DataTable<T>({
  columns,
  data,
  statusField,
  statusVariantMap,
  isLoading = false,
  emptyState,
  getRowId,
}: DataTableProps<T>) {
  const rowId = getRowId ?? ((_row: T, index: number) => index)

  if (isLoading) {
    return (
      <div>
        <table className="hidden w-full border-collapse text-left md:table">
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className="px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-wide text-muted"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SkeletonRows columns={columns.length} />
          </tbody>
        </table>
        <SkeletonCards />
      </div>
    )
  }

  if (data.length === 0) {
    return <>{emptyState ?? <DefaultEmptyState />}</>
  }

  function cellContent(row: T, column: ColumnDef<T>) {
    if (column.render) return column.render(row)
    if (column.key === statusField) {
      return <StatusBadge status={String(row[statusField])} variantMap={statusVariantMap} />
    }
    return String(row[column.key])
  }

  return (
    <div>
      <table className="hidden w-full border-collapse text-left md:table">
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-wide text-muted"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={rowId(row, index)} className="border-b border-border last:border-0">
              {columns.map((column) => (
                <td key={String(column.key)} className="px-4 py-3 font-sans text-sm text-ink">
                  {cellContent(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className={cn('flex flex-col gap-3 md:hidden')}>
        {data.map((row, index) => (
          <Card key={rowId(row, index)} className="flex flex-col gap-1.5">
            {columns.map((column) => (
              <div key={String(column.key)} className="flex items-baseline justify-between gap-2">
                <span className="font-sans text-[11px] font-bold uppercase tracking-wide text-muted">
                  {column.header}
                </span>
                <span className="font-sans text-sm text-ink">{cellContent(row, column)}</span>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  )
}
