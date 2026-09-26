import { act } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { setMockBusiness } from '@/test/mock-business'
import { API_BASE_URL } from '@/shared/lib/env'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { createMockJwt } from '@/shared/mocks/mock-jwt'
import {
  SEED_BUSINESS_SCENARIOS,
  SEED_BUSINESS_STAFF,
  SEED_BUSINESS_STAFF_USERNAME,
} from '@/shared/mocks/seed'
import {
  BackendCapabilitiesProvider,
  resolveBackendCapabilities,
  type BackendCapabilities,
} from '@/shared/lib/backend-capabilities'
import { BusinessGateway } from './business-gateway'

/** Misma semilla que `settings-page.dom.test.tsx` — `NoBusinessGate` necesita claims reales. */
function signIn() {
  useBusinessSessionStore.setState({
    isAuthenticated: true,
    accessToken: createMockJwt({
      sub: SEED_BUSINESS_STAFF.id,
      email: SEED_BUSINESS_STAFF.email,
      username: SEED_BUSINESS_STAFF_USERNAME,
    }),
    accessTokenExpiresAtUtc: null,
    refreshToken: 'a-refresh',
    refreshTokenExpiresAtUtc: null,
  })
}

function renderGateway(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  capabilities?: BackendCapabilities
) {
  signIn()
  return render(
    <QueryClientProvider client={queryClient}>
      <BackendCapabilitiesProvider value={capabilities}>
        <MemoryRouter>
          <Routes>
            <Route element={<BusinessGateway />}>
              <Route path="/" element={<div>contenido protegido</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </BackendCapabilitiesProvider>
    </QueryClientProvider>
  )
}

describe('BusinessGateway', () => {
  it('deja pasar el contenido protegido (vía AppShell) cuando el negocio está Active', async () => {
    renderGateway()
    expect(await screen.findByText('contenido protegido')).toBeInTheDocument()
  })

  it.each(['Paused', 'Suspended'] as const)(
    'también deja pasar AppShell cuando el negocio está %s — el banner es PR8a',
    async (status) => {
      setMockBusiness(status)
      renderGateway()
      expect(await screen.findByText('contenido protegido')).toBeInTheDocument()
    }
  )

  it('renderiza NoBusinessGate con el email de sesión y el CTA de registro (capability on) cuando /business/mine devuelve [], sin AppShell', async () => {
    setMockBusiness('none')
    renderGateway(undefined, resolveBackendCapabilities('mock'))

    const heading = await screen.findByRole('heading', {
      name: 'No encontramos un negocio asociado a tu cuenta.',
    })
    expect(heading).toHaveFocus()
    expect(
      screen.getByText(`Iniciaste sesión como ${SEED_BUSINESS_STAFF.email}`)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar mi negocio' })).toBeInTheDocument()
    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument()
  })

  it('oculta el CTA de registro en NoBusinessGate cuando la capability registration está apagada (modo real)', async () => {
    setMockBusiness('none')
    renderGateway(undefined, resolveBackendCapabilities('real'))

    await screen.findByRole('heading', {
      name: 'No encontramos un negocio asociado a tu cuenta.',
    })
    expect(screen.queryByRole('button', { name: 'Registrar mi negocio' })).not.toBeInTheDocument()
  })

  it('renderiza el gate PendingVerification con acción de refresh, sin AppShell', async () => {
    setMockBusiness('PendingVerification')
    renderGateway()

    const heading = await screen.findByRole('heading', { name: 'Estamos revisando tu negocio' })
    expect(heading).toHaveFocus()
    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument()

    // Clic en refresh: la acción real dispara un refetch que puede resolver
    // Active — no solo un botón decorativo (mismo criterio que
    // `pending-page.dom.test.tsx`).
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, () =>
        HttpResponse.json([SEED_BUSINESS_SCENARIOS.Active])
      )
    )
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }))
    expect(await screen.findByText('contenido protegido')).toBeInTheDocument()
  })

  it('renderiza el gate Rejected con motivo y fecha, sin AppShell', async () => {
    setMockBusiness('Rejected')
    renderGateway()

    expect(
      await screen.findByRole('heading', { name: 'Tu negocio no fue aprobado' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'El documento legal no coincide con el nombre registrado ante cámara de comercio.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument()
  })

  it('el botón "Reenviar documento" abre el selector y el envío devuelve el negocio a PendingVerification', async () => {
    setMockBusiness('Rejected')
    renderGateway()
    await screen.findByRole('heading', { name: 'Tu negocio no fue aprobado' })

    fireEvent.click(screen.getByRole('button', { name: 'Reenviar documento' }))
    const file = new File([new Uint8Array(1024)], 'documento.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Elegí el documento legal a reenviar'), {
      target: { files: [file] },
    })

    expect(
      await screen.findByRole('heading', { name: 'Estamos revisando tu negocio' })
    ).toBeInTheDocument()
  })

  it('un archivo inválido muestra error inline sin llamar al backend', async () => {
    setMockBusiness('Rejected')
    renderGateway()
    await screen.findByRole('heading', { name: 'Tu negocio no fue aprobado' })

    const invalidFile = new File([new Uint8Array(1024)], 'foto.gif', { type: 'image/gif' })
    fireEvent.change(screen.getByLabelText('Elegí el documento legal a reenviar'), {
      target: { files: [invalidFile] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El archivo no es válido — solo se aceptan PDF, JPG o PNG de hasta 5 MB.'
    )
    expect(screen.getByRole('heading', { name: 'Tu negocio no fue aprobado' })).toBeInTheDocument()
  })

  it('un 409 al reenviar explica que ya no se puede y mantiene el gate Rejected', async () => {
    setMockBusiness('Rejected')
    renderGateway()
    await screen.findByRole('heading', { name: 'Tu negocio no fue aprobado' })

    server.use(
      http.post(`${API_BASE_URL}/business/:businessId/legal-document`, () =>
        HttpResponse.json(
          {
            title: 'Business.NotAwaitingVerification',
            detail: 'El negocio no está en un estado que admita el reenvío.',
            status: 409,
          },
          { status: 409 }
        )
      )
    )
    const file = new File([new Uint8Array(1024)], 'documento.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Elegí el documento legal a reenviar'), {
      target: { files: [file] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu negocio ya no puede reenviar el documento en este estado.'
    )
    expect(screen.getByRole('heading', { name: 'Tu negocio no fue aprobado' })).toBeInTheDocument()
  })

  it('un 400 del backend (validación de bytes reales) muestra el mismo mensaje de archivo inválido', async () => {
    setMockBusiness('Rejected')
    renderGateway()
    await screen.findByRole('heading', { name: 'Tu negocio no fue aprobado' })

    server.use(
      http.post(`${API_BASE_URL}/business/:businessId/legal-document`, () =>
        HttpResponse.json(
          {
            title: 'BusinessDocument.UnsupportedFormat',
            detail: 'Formato no soportado.',
            status: 400,
          },
          { status: 400 }
        )
      )
    )
    const file = new File([new Uint8Array(1024)], 'documento.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Elegí el documento legal a reenviar'), {
      target: { files: [file] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El archivo no es válido — solo se aceptan PDF, JPG o PNG de hasta 5 MB.'
    )
  })

  it('tras 5s en estado pendiente agrega el aviso de arranque en frío, sin reemplazar el indicador de carga', async () => {
    server.use(http.get(`${API_BASE_URL}/business/mine`, () => new Promise(() => {})))
    vi.useFakeTimers()
    try {
      renderGateway()
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.queryByText(/puede estar despertando/)).not.toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText(/puede estar despertando/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('en error muestra un mensaje y reintentar recupera el contenido protegido — nunca un spinner infinito mudo', async () => {
    let callCount = 0
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, () => {
        callCount += 1
        return callCount === 1
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json([SEED_BUSINESS_SCENARIOS.Active])
      })
    )
    renderGateway()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('contenido protegido')).toBeInTheDocument()
  })
})
