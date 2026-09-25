import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AnalyticsCheckInSeries, AnalyticsSummary } from '@/shared/schemas/analytics'
import { AnalyticsView } from './analytics-view'

const SUMMARY: AnalyticsSummary = {
  from: '2026-08-26',
  to: '2026-09-24',
  current: {
    checkIns: 120,
    uniqueVisitors: 44,
    redemptions: 8,
    estimatedValueDeliveredCop: 120000,
    averageExperienceRating: 4.4,
  },
  previous: {
    checkIns: 100,
    uniqueVisitors: 44,
    redemptions: 0,
    estimatedValueDeliveredCop: 90000,
    averageExperienceRating: 4.0,
  },
  places: [
    {
      placeId: '00000000-0000-0000-0000-000000000010',
      name: 'Café de la 70 — Sede Laureles',
      checkIns: 120,
      uniqueVisitors: 44,
    },
    {
      placeId: '00000000-0000-0000-0000-000000000011',
      name: 'Café de la 70 — Sede Envigado',
      checkIns: 0,
      uniqueVisitors: 0,
    },
  ],
}

const SERIES: AnalyticsCheckInSeries = {
  granularity: 'day',
  points: [
    { date: '2026-09-22', checkIns: 4 },
    { date: '2026-09-23', checkIns: 0 },
    { date: '2026-09-24', checkIns: 8 },
  ],
}

function renderView(overrides: Partial<Parameters<typeof AnalyticsView>[0]> = {}) {
  const onPeriodChange = vi.fn()
  render(
    <AnalyticsView
      summary={SUMMARY}
      series={SERIES}
      period={30}
      onPeriodChange={onPeriodChange}
      isRefreshing={false}
      {...overrides}
    />
  )
  return { onPeriodChange }
}

describe('AnalyticsView', () => {
  /**
   * Este test es el que protege la regla central de la slice: el contrato es una
   * propuesta sin backend y quien mire la pantalla tiene que saberlo sin leer el
   * código. Un dashboard con números plausibles es exactamente lo que se
   * confunde con un dashboard real.
   */
  it('avisa EN PANTALLA que las métricas salen de un mock, citando el issue de la propuesta', () => {
    renderView()

    expect(screen.getByRole('note')).toHaveTextContent('Renata-S-A-S/geoquest#205')
  })

  it('muestra el rango del período resuelto, no solo el rótulo del selector', () => {
    renderView()

    expect(screen.getByText('Del 2026-08-26 al 2026-09-24')).toBeInTheDocument()
  })

  it('renderiza las cinco métricas con su valor', () => {
    renderView()

    // «Check-ins» y «Visitantes únicos» aparecen más de una vez a propósito:
    // son rótulo de tarjeta Y encabezado de columna de las tablas de abajo.
    expect(screen.getAllByText('Check-ins').length).toBeGreaterThanOrEqual(2)
    // Dos veces: la tarjeta del total y la fila del único lugar con visitas.
    // Que coincidan es la propiedad real — el desglose tiene que sumar al total.
    expect(screen.getAllByText('120')).toHaveLength(2)
    expect(screen.getAllByText('Visitantes únicos').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Canjes')).toBeInTheDocument()
    expect(screen.getByText('Valor entregado')).toBeInTheDocument()
    expect(screen.getByText('4.4 de 5')).toBeInTheDocument()
    expect(screen.getByText('Calificación promedio')).toBeInTheDocument()
  })

  it('muestra la variación contra el período previo cuando es calculable', () => {
    renderView()

    expect(screen.getByText('Subió 20 % contra el período anterior')).toBeInTheDocument()
    expect(screen.getByText('Sin cambios contra el período anterior')).toBeInTheDocument()
  })

  /**
   * `redemptions` va de 0 a 8. Eso no es «+100 %», es una variación indefinida
   * (dividiría por cero). La insignia no se dibuja y el aviso queda solo para
   * lector de pantalla.
   */
  it('NO inventa un porcentaje cuando el período previo fue 0', () => {
    renderView()

    expect(screen.getByText('Sin período anterior con el que comparar')).toBeInTheDocument()
    expect(screen.queryByText(/Subió 100 %/)).not.toBeInTheDocument()
  })

  it('muestra «sin calificaciones» en vez de 0 cuando nadie calificó', () => {
    renderView({
      summary: {
        ...SUMMARY,
        current: { ...SUMMARY.current, averageExperienceRating: null },
      },
    })

    expect(screen.getByText('Sin calificaciones')).toBeInTheDocument()
    expect(screen.queryByText('0.0 de 5')).not.toBeInTheDocument()
  })

  it('renderiza la serie como tabla accesible: un día por fila con su número', () => {
    renderView()

    const row = screen.getByRole('rowheader', { name: '2026-09-24' }).closest('tr')
    expect(screen.getByRole('rowheader', { name: '2026-09-23' })).toBeInTheDocument()
    // El número se busca DENTRO de la fila del día: el 8 de la serie y el 8 de
    // «Canjes» son el mismo texto en dos lugares distintos de la pantalla.
    expect(within(row as HTMLElement).getByText('8')).toBeInTheDocument()
  })

  it('muestra el estado vacío de la serie cuando el período no tuvo ningún check-in', () => {
    renderView({
      series: { granularity: 'day', points: [{ date: '2026-09-24', checkIns: 0 }] },
    })

    expect(screen.getByText('Todavía no hay check-ins en este período.')).toBeInTheDocument()
  })

  it('lista el desglose por lugar incluyendo el lugar sin visitas', () => {
    renderView()

    expect(
      screen.getByRole('rowheader', { name: 'Café de la 70 — Sede Envigado' })
    ).toBeInTheDocument()
  })

  it('muestra el estado vacío del desglose cuando el negocio no tiene lugares', () => {
    renderView({ summary: { ...SUMMARY, places: [] } })

    expect(
      screen.getByText('Todavía no tenés ningún lugar. Creá uno para empezar a medir visitas.')
    ).toBeInTheDocument()
  })

  it('anuncia que está actualizando mientras se ven los datos del período anterior', () => {
    renderView({ isRefreshing: true })

    expect(screen.getByRole('status')).toHaveTextContent('Actualizando…')
  })

  it('no anuncia nada cuando los datos en pantalla son los del período pedido', () => {
    renderView()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  /**
   * `@testing-library/user-event` NO está instalado en este repo: la interacción
   * con `Select` va con `fireEvent` sobre `combobox` y después `option`, mismo
   * patrón que `register-form.dom.test.tsx`.
   */
  it('avisa el cambio de período con el número de días, no con el rótulo traducido', () => {
    const { onPeriodChange } = renderView()

    fireEvent.click(screen.getByRole('combobox', { name: 'Período' }))
    fireEvent.click(screen.getByRole('option', { name: 'Últimos 7 días' }))

    expect(onPeriodChange).toHaveBeenCalledWith(7)
  })

  it('el selector arranca mostrando el período activo', () => {
    renderView({ period: 90 })

    expect(screen.getByRole('combobox', { name: 'Período' })).toHaveTextContent('Últimos 90 días')
  })
})
