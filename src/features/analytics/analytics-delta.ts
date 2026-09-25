/**
 * Variación de una métrica contra el período previo.
 *
 * Es cálculo del CLIENTE, no del servidor: `analyticsSummarySchema` devuelve
 * `current` y `previous` crudos justamente para que el criterio del caso
 * borde viva acá y se pueda cambiar sin versionar el contrato.
 */
export type AnalyticsDeltaDirection = 'up' | 'down' | 'flat'

export interface AnalyticsDelta {
  direction: AnalyticsDeltaDirection
  /** Variación porcentual absoluta, redondeada a entero. */
  percent: number
}

/**
 * Devuelve `null` cuando el período previo fue **0**, y eso no es un detalle:
 * la variación de 0 a cualquier número no es «+100», es indefinida (dividiría
 * por cero). Mostrar «+100» ahí le diría al negocio que duplicó algo cuando en
 * realidad arrancó de la nada. `null` hace que la vista muestre el total sin
 * insignia de variación, que es la verdad.
 *
 * `previous === 0 && current === 0` también da `null` por el mismo motivo: no
 * hay nada que comparar.
 */
export function resolveAnalyticsDelta(current: number, previous: number): AnalyticsDelta | null {
  if (previous === 0) return null

  const change = ((current - previous) / previous) * 100
  const percent = Math.round(Math.abs(change))

  // El redondeo puede dejar un cambio real por debajo de medio punto en cero;
  // en ese caso la dirección es 'flat', porque una flecha con un cero al lado
  // se lee como un error de la interfaz y no como «prácticamente igual».
  if (percent === 0) return { direction: 'flat', percent: 0 }

  return { direction: change > 0 ? 'up' : 'down', percent }
}
