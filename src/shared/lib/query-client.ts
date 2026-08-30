import { QueryClient } from '@tanstack/react-query'

/**
 * Singleton fuera del árbol de React — mismo motivo que en geoquest-web: el
 * interceptor de sesión necesita limpiar la cache en logout forzado (401
 * con refresh fallido) sin `useQueryClient()`, que solo resuelve dentro de
 * un `QueryClientProvider`. `app/providers.tsx` reusa esta misma instancia.
 */
export const queryClient = new QueryClient()
