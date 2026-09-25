import { cn } from '@/shared/lib/cn'

export interface AvatarProps {
  initial: string
  /** URL del logo (`MyBusiness.logoUrl`). Si es truthy, reemplaza el círculo de iniciales por una imagen. */
  src?: string | null
  /** Texto alternativo de la imagen. Default: `initial`. */
  alt?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-[30px] w-[30px] text-xs',
  md: 'h-[38px] w-[38px] text-sm',
  lg: 'h-14 w-14 text-lg',
} as const

/**
 * Círculo de iniciales — trigger del menú de cuenta (issue #70, decisión de
 * diseño #3). Nombres de prop (`initial` / `size` / `className`) idénticos
 * byte a byte a los del Explorer (`geoquest-web/avatar.tsx`), así su mitad
 * de imagen (`src`/`alt`) puede incorporarse después sin tocar ningún
 * call-site.
 *
 * `src`/`alt` (real-backend-readiness PR6c) agregan esa mitad de imagen:
 * `MyBusiness.logoUrl` ya existe en el contrato real. Con `src` truthy se
 * renderiza un `<img>` en vez del círculo de iniciales; `src` nulo o
 * ausente conserva el fallback de iniciales de siempre.
 */
export function Avatar({ initial, src, alt, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? initial}
        className={cn('shrink-0 rounded-full object-cover', sizeMap[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-teal font-display font-bold text-on-brand',
        sizeMap[size],
        className
      )}
    >
      {initial}
    </div>
  )
}
