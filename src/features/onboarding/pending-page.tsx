import { RoutePlaceholder } from '@/app/route-placeholder'

/**
 * `/registro/pendiente` — destino de redirección de #21 tras un registro
 * exitoso. La pantalla real (SLA 48h, criterios de verificación) es #27,
 * sin implementar todavía — mismo patrón que `OnboardingPage`/`PlacesPage`/
 * etc. usan hoy para features sin construir. #27 reemplaza el contenido,
 * la ruta/redirect no cambian.
 */
export function PendingStatusPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream p-4">
      <RoutePlaceholder label="negocio — pendiente de verificación (ver #27)" />
    </div>
  )
}
