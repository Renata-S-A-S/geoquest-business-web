import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from './nav-items'

describe('NAV_ITEMS', () => {
  /**
   * Cuatro, no cinco, y ya no es "una por flujo B-01..B-05": `Negocio` (B-01)
   * dejó de tener pestaña el 24 sep 2026 y su contenido vive dentro de
   * `/configuracion`. Los cuatro que quedan son bucles operativos — cosas que
   * el dueño hace repetidamente para operar el negocio — y eso es el criterio
   * que gana una pestaña, no la correspondencia con un flujo documentado.
   */
  it('tiene exactamente 4 secciones, todas bucles operativos', () => {
    expect(NAV_ITEMS).toHaveLength(4)
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([
      'places',
      'rewards',
      'redemptions',
      'analytics',
    ])
  })

  /**
   * Guarda explícita: la barra inferior no puede crecer a 6 (decisión de
   * #70). Quitar `Negocio` liberó un lugar, y la instrucción fue NO gastarlo
   * de inmediato — el margen es la ganancia.
   */
  it('no supera los 5 ítems que la barra inferior tolera', () => {
    expect(NAV_ITEMS.length).toBeLessThanOrEqual(5)
  })

  it('ya no incluye la pestaña de negocio, cuyo contenido se fusionó en configuración', () => {
    expect(NAV_ITEMS.map((i) => i.to)).not.toContain('/negocio')
  })

  it('every item has a unique id and a unique route', () => {
    const ids = NAV_ITEMS.map((i) => i.id)
    const paths = NAV_ITEMS.map((i) => i.to)
    expect(new Set(ids).size).toBe(NAV_ITEMS.length)
    expect(new Set(paths).size).toBe(NAV_ITEMS.length)
  })
})
