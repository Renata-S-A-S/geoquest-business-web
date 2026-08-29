import type { Config } from 'tailwindcss'

/**
 * Paleta y tipografía heredadas 1:1 de geoquest-web / el sistema de diseño
 * de marca (Confluence: Identidad de Marca & Sistema de Diseño). La FIRMA
 * VISUAL lúdica (borde rasgado, sello de barrio, textura topográfica) NO se
 * hereda — ver ADR-047 (borrador). Un panel B2B necesita densidad de datos,
 * no una libreta de aventura.
 *
 * Modo oscuro: NO implementado en este scaffold. geoquest-web tampoco lo
 * tiene todavía pese a estar "aprobado para el MVP" en Confluence — la
 * paleta dark exacta sigue sin definir ahí (pendiente explícito). Inventarla
 * acá sería una decisión de diseño no autorizada. Cuando exista, se agrega
 * como variantes `dark:` sobre estos mismos tokens semánticos.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de marca (6 colores del design system)
        teal: '#0EA5A0', // Explorer teal — marca, botón primario, nav activa
        coral: '#FF7A59', // Sunset coral — acentos puntuales (NO celebración en el portal, ver ADR-047)
        green: '#3ECF8E', // Spring green — estados de éxito
        ink: '#10262B', // Jungle ink — texto principal, fondos oscuros (sidebar)
        cream: '#FFF9F2', // Cloud cream — fondo claro por defecto
        alert: '#E5484D', // Alert red — SOLO destructivo/error, nunca marca

        // Neutros de soporte
        border: '#E4DFD4',
        muted: '#8A8578',
        paper: '#F6F3EC',

        // Tokens de superficie por escenario
        surface: {
          mint: '#E1F0E6',
          teal: '#E1F5EE',
          alert: '#FDECEC',
          skeleton: '#E9E5DC',
          placeholder: '#DCD6C8',
        },
      },
      fontFamily: {
        display: ['"Baloo 2"', 'sans-serif'], // wordmark, encabezados
        sans: ['"Nunito"', 'sans-serif'], // texto de interfaz
        mono: ['"Space Mono"', 'monospace'], // datos: montos, fechas, IDs
      },
      borderRadius: {
        xs: '8px', // inputs
        sm: '10px', // botones, swatches
        md: '12px', // cards
        lg: '16px', // pills, modal
        xl: '18px', // superficies grandes
      },
    },
  },
  plugins: [],
} satisfies Config
