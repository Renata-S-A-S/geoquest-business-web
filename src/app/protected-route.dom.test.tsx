import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { ProtectedRoute } from './protected-route'
import { useSessionStore } from '@/shared/stores/session-store'

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
  useSessionStore.getState().signOut()
})

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no session', () => {
    renderProtected('/secure')
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('secure content')).not.toBeInTheDocument()
  })

  it('renders the protected content when there is an active session', () => {
    useSessionStore.getState().signIn('fake-token')
    renderProtected('/secure')
    expect(screen.getByText('secure content')).toBeInTheDocument()
  })
})
