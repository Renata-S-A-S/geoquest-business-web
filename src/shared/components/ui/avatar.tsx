import { cn } from '@/shared/lib/cn'

export interface AvatarProps {
  initial: string
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
 * call-site. `businessSchema` no tiene campo de logo/foto todavía (BL-014),
 * así que esa mitad no se porta acá.
 */
export function Avatar({ initial, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-teal font-display font-bold text-cream',
        sizeMap[size],
        className
      )}
    >
      {initial}
    </div>
  )
}
