import { useMemo, useSyncExternalStore } from 'react'
import { sessionPort } from '@/shared/lib/session-port.instance'
import type { IdentityClaims } from '@/shared/lib/jwt-claims'

/**
 * Único punto donde un componente lee claims de identidad (username/email
 * para MOSTRAR, nunca para autorizar) — spec "session-identity" (#1547).
 * `useSyncExternalStore` sobre el access token (no sobre las claims ya
 * decodificadas) porque es lo que expone `sessionPort.subscribe`; `useMemo`
 * evita decodificar el JWT en cada render si el token no cambió — mismo
 * criterio de encapsulamiento que `useSession()` en `use-session.ts`.
 */
export function useIdentityClaims(): IdentityClaims | null {
  const accessToken = useSyncExternalStore(sessionPort.subscribe, () =>
    sessionPort.getAccessToken()
  )

  return useMemo(() => {
    // `sessionPort.getIdentityClaims()` no recibe `accessToken` como
    // argumento (cada puerto decide cómo leerlo: `realSessionPort` lo
    // decodifica, `mockSessionPort` lo ignora y devuelve la semilla) — este
    // `void` es lo que le dice a React que igual hay que recalcular cuando
    // cambia, sin mentirle a `exhaustive-deps` sacando la dependencia.
    void accessToken
    return sessionPort.getIdentityClaims()
  }, [accessToken])
}
