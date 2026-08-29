import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/cn'

/**
 * Variantes heredadas del sistema de diseño de GeoQuest (primary/secondary/
 * destructive). No se agrega la variante "social" (login con Google) — no
 * aplica a BusinessStaff, ver decisión abierta de auth en
 * contratos-portal-b2b.md.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border-[1.5px] border-transparent px-[18px] py-2.5 font-sans text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-teal text-cream hover:bg-teal/90',
        secondary: 'border-teal text-teal bg-transparent hover:bg-teal/10',
        destructive: 'border-alert text-alert bg-transparent hover:bg-alert/10',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />
  )
)
Button.displayName = 'Button'
