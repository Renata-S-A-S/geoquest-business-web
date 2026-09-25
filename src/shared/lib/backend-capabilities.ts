import { createContext, createElement, useContext, type ReactNode } from 'react'
import { USE_MOCKS } from './env'

/**
 * Costura única de capacidades — spec #1547 "Single capability seam": este
 * módulo es el ÚNICO lector de `USE_MOCKS` fuera de la capa de transporte.
 * Ningún feature debe leer `USE_MOCKS` directamente ni ramificar con
 * `if (mock)` ad hoc (dominio `mock-parity` del spec); toda decisión de
 * "¿existe esto en el backend real?" pasa por `useBackendCapabilities()`.
 */
export type BackendMode = 'mock' | 'real'

export const BACKEND_MODE: BackendMode = USE_MOCKS ? 'mock' : 'real'

export interface BackendCapabilities {
  /** #205 — el dashboard de analíticas no tiene endpoints reales todavía. */
  analytics: boolean
  /** #182 — editar el perfil del negocio no tiene contrato real (PR4 borra el código muerto). */
  profileEdit: boolean
  /** #203 — no existe un endpoint de identidad de staff; la identidad sale de los claims del JWT. */
  staffIdentity: boolean
  /** #212 — el alta de negocio autogestionada todavía no existe en el backend real. */
  registration: boolean
}

/**
 * Regla de #1550 (enmienda de diseño, override del design original): "true
 * en modo mock SOLO donde existe una implementación mock". `profileEdit` y
 * `staffIdentity` quedan `false` en AMBOS modos porque ninguno conserva una
 * implementación mock — no son "flags apagadas", son features sin backend
 * en absoluto para este modo.
 */
export function resolveBackendCapabilities(mode: BackendMode): BackendCapabilities {
  return {
    analytics: mode === 'mock',
    profileEdit: false,
    staffIdentity: false,
    registration: mode === 'mock',
  }
}

const defaultBackendCapabilities = resolveBackendCapabilities(BACKEND_MODE)

const BackendCapabilitiesContext = createContext<BackendCapabilities>(defaultBackendCapabilities)

/**
 * Sin JSX a propósito (archivo `.ts`, no `.tsx`, para conservar la ruta que
 * fija el design): `createElement` evita requerir sintaxis JSX en un
 * `.ts`. El `value` por defecto es el derivado real de `BACKEND_MODE`; los
 * tests pasan un `value` explícito para simular el otro modo sin tocar
 * `import.meta.env`.
 */
export function BackendCapabilitiesProvider({
  value = defaultBackendCapabilities,
  children,
}: {
  value?: BackendCapabilities
  children: ReactNode
}) {
  return createElement(BackendCapabilitiesContext.Provider, { value }, children)
}

export function useBackendCapabilities(): BackendCapabilities {
  return useContext(BackendCapabilitiesContext)
}
