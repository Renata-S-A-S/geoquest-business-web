import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { ProtectedRoute } from './protected-route'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'

/**
 * Ejercita `ProtectedRoute` contra el store REAL (`business-session-store.ts`,
 * el que respalda `sessionPort.instance.ts` desde #20) — antes probaba
 * contra `useSessionStore`, el store del mock, que ya no es la implementación
 * activa. `ProtectedRoute` en sí no cambió (sigue leyendo solo `useSession()`,
 * nunca un store concreto): lo que cambió es contra cuál store hay que
 * manipular la sesión desde afuera para que la abstracción lo refleje.
 */
const fakeTokens = {
  accessToken: 'fake-token',
  accessTokenExpiresAtUtc: '2026-09-02T01:00:00Z',
  refreshToken: 'fake-refresh',
  refreshTokenExpiresAtUtc: '2026-09-09T00:00:00Z',
}

function renderProtected(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/secure" element={<div>secure content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

afterEach(() => {
  useBusinessSessionStore.getState().logout()
})

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no session', () => {
    renderProtected('/secure')
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('secure content')).not.toBeInTheDocument()
  })

  it('renders the protected content when there is an active session', () => {
    useBusinessSessionStore.getState().login(fakeTokens)
    renderProtected('/secure')
    expect(screen.getByText('secure content')).toBeInTheDocument()
  })
})
