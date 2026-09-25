import { describe, expect, it } from 'vitest'
import {
  computeHasMapboxToken,
  MAP_STYLE_URLS,
  PLACE_DETAIL_ZOOM,
  resolveMapStyleUrl,
} from './map-config'

/**
 * La resolución del token vive en una función pura para poder testear las
 * dos ramas sin stubbear `import.meta.env`, mismo criterio que el Explorer.
 * Importa porque de esa rama depende que la pantalla degrade a coordenadas
 * en vez de romperse.
 */
describe('computeHasMapboxToken', () => {
  it('reconoce un token presente', () => {
    expect(computeHasMapboxToken('pk.eyJ1Ijoi')).toBe(true)
  })

  it('trata undefined como ausente', () => {
    expect(computeHasMapboxToken(undefined)).toBe(false)
  })

  it('trata la cadena vacía como ausente', () => {
    expect(computeHasMapboxToken('')).toBe(false)
  })

  /**
   * Una variable de entorno mal seteada suele quedar con espacios, no
   * vacía. Tratarla como presente haría que el mapa intente cargar con un
   * token inválido y falle con un error de red opaco, en vez de degradar
   * limpio a coordenadas.
   */
  it('trata una cadena de espacios como ausente', () => {
    expect(computeHasMapboxToken('   ')).toBe(false)
  })
})

describe('resolveMapStyleUrl', () => {
  it('usa el estilo claro en tema claro y el oscuro en tema oscuro', () => {
    expect(resolveMapStyleUrl('light')).toBe(MAP_STYLE_URLS.light)
    expect(resolveMapStyleUrl('dark')).toBe(MAP_STYLE_URLS.dark)
    expect(MAP_STYLE_URLS.light).not.toBe(MAP_STYLE_URLS.dark)
  })

  /**
   * Los mismos dos estilos de stock que usa el Explorer: un lugar con otra
   * paleta en cada aplicación haría dudar de si es el mismo sitio.
   */
  it('usa los estilos de stock de Mapbox, no estilos de marca propios', () => {
    expect(MAP_STYLE_URLS.light).toBe('mapbox://styles/mapbox/streets-v12')
    expect(MAP_STYLE_URLS.dark).toBe('mapbox://styles/mapbox/dark-v11')
  })
})

describe('PLACE_DETAIL_ZOOM', () => {
  it('es un zoom de manzana, no de ciudad ni de vereda', () => {
    expect(PLACE_DETAIL_ZOOM).toBeGreaterThanOrEqual(14)
    expect(PLACE_DETAIL_ZOOM).toBeLessThanOrEqual(18)
  })
})
