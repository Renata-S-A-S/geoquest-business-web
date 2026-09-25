import { MapPin } from '@phosphor-icons/react'
import { Map, Marker } from 'react-map-gl'
import { MAPBOX_TOKEN, PLACE_DETAIL_ZOOM, resolveMapStyleUrl } from '@/features/places/map-config'
import { useResolvedTheme } from '@/shared/hooks/use-resolved-theme'
import 'mapbox-gl/dist/mapbox-gl.css'

export interface PlaceLocationMapProps {
  latitude: number
  longitude: number
  /** Nombre del lugar, para el texto alternativo del pin. */
  name: string
}

/**
 * Mapa de solo lectura con el pin del lugar (mejora pedida por Derek,
 * 24 sep 2026).
 *
 * **Solo lectura a propósito.** Esto NO es el selector de #32: no arrastra
 * el pin, no busca direcciones y no geocodifica. Mostrar una ubicación y
 * elegirla son dos problemas distintos, y el primero es mucho más chico —
 * no necesita geocoding ni manejar un estado que el formulario tenga que
 * validar.
 *
 * Por eso están apagadas todas las interacciones de edición y se deja solo
 * lo que ayuda a orientarse: arrastrar el lienzo y hacer zoom. Un mapa
 * rotable en una ficha de detalle solo sirve para perder el norte.
 *
 * Este módulo se importa con `lazy()` desde la vista de detalle:
 * `mapbox-gl` pesa cientos de kilobytes y solo hace falta en esta pantalla.
 * Cargarlo con el bundle principal penalizaría el login y el listado, que
 * son las pantallas que todo negocio abre primero.
 */
export function PlaceLocationMap({ latitude, longitude, name }: PlaceLocationMapProps) {
  const resolvedTheme = useResolvedTheme()

  return (
    <div className="h-48 w-full overflow-hidden rounded-xs border border-border">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ latitude, longitude, zoom: PLACE_DETAIL_ZOOM }}
        mapStyle={resolveMapStyleUrl(resolvedTheme)}
        style={{ width: '100%', height: '100%' }}
        dragRotate={false}
        touchZoomRotate={false}
        attributionControl={false}
      >
        <Marker latitude={latitude} longitude={longitude} anchor="bottom">
          <MapPin size={28} weight="fill" className="text-teal" aria-label={name} />
        </Marker>
      </Map>
    </div>
  )
}
