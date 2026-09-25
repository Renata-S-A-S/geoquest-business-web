import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { readDb, writeDb } from '@/shared/mocks/db'
import {
  SEED_EXPIRED_QR_TOKEN,
  SEED_FAILED_QR_TOKEN,
  SEED_PENDING_QR_TOKEN,
  SEED_PRIZE_QR_TOKEN,
  SEED_PURCHASED_QR_TOKEN,
  SEED_REDEEMED_QR_TOKEN,
} from '@/shared/mocks/seed'
import { setMockBusiness } from '@/test/mock-business'
import { RedemptionsPage } from './redemptions-page'

/**
 * Las consultas NO se mockean: se renderiza el contenedor real contra los
 * handlers de MSW, igual que `places-page.dom.test.tsx`. Interacción con
 * `fireEvent` porque `@testing-library/user-event` no está instalado.
 */
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RedemptionsPage />
    </QueryClientProvider>
  )
}

async function pasteToken(token: string) {
  const field = await screen.findByLabelText('Código del QR')
  fireEvent.change(field, { target: { value: token } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar canje' }))
}

/** Lleva el flujo hasta la previsualización de un canje válido. */
async function reachPreview(token = SEED_PURCHASED_QR_TOKEN) {
  renderPage()
  await pasteToken(token)
  await screen.findByRole('button', { name: 'Confirmar canje' })
}

describe('RedemptionsPage', () => {
  it('ya no renderiza el placeholder de ruta', async () => {
    renderPage()

    await screen.findByLabelText('Código del QR')
    expect(screen.queryByText('validar canje — pendiente')).not.toBeInTheDocument()
  })

  it('arranca en la entrada manual del código (#44)', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Validar canje' })).toBeInTheDocument()
  })

  /**
   * #44: valida el formato ANTES de llamar al endpoint. El contador de
   * requests prueba que no hubo llamada, que es la mitad del criterio.
   */
  it('rechaza un código con formato inválido sin llamar al endpoint', async () => {
    let calls = 0
    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/:businessId/redemptions/lookup`, () => {
        calls += 1
        return HttpResponse.json({}, { status: 404 })
      })
    )

    renderPage()
    await pasteToken('no-es-un-token')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ese código no tiene el formato de un QR de GeoQuest'
    )
    expect(calls).toBe(0)
  })

  it('pide el código cuando el campo está vacío', async () => {
    renderPage()
    await pasteToken('   ')

    expect(await screen.findByRole('alert')).toHaveTextContent('Pegá el código del QR')
  })

  it('acepta un token pegado con espacios alrededor', async () => {
    renderPage()
    await pasteToken(`  ${SEED_PURCHASED_QR_TOKEN}  `)

    expect(await screen.findByRole('button', { name: 'Confirmar canje' })).toBeInTheDocument()
  })

  it('muestra la recompensa a entregar en la previsualización (#45)', async () => {
    await reachPreview()

    expect(screen.getByText('2x1 en café de especialidad')).toBeInTheDocument()
    expect(screen.getByText('100 GeoPoints')).toBeInTheDocument()
  })

  it('muestra la descripción de la recompensa', async () => {
    await reachPreview()

    expect(screen.getByText('Llevá dos cafés pagando uno, de lunes a jueves.')).toBeInTheDocument()
  })

  it('muestra el username del explorador cuando el backend lo proyectó', async () => {
    await reachPreview(SEED_PURCHASED_QR_TOKEN)

    expect(screen.getByText('ana_explorer')).toBeInTheDocument()
  })

  /**
   * decision #1473: `explorerUsername` puede ser `null`. La pantalla tiene
   * que caer al identificador crudo en vez de romper o dejar un hueco.
   */
  it('cae al identificador del explorador cuando el username no se proyectó', async () => {
    await reachPreview(SEED_PRIZE_QR_TOKEN)

    expect(screen.getByText('00000000-0000-0000-0000-0000000000a2')).toBeInTheDocument()
    expect(
      screen.getByText(/El backend todavía no proyectó el usuario de este explorador/)
    ).toBeInTheDocument()
  })

  it('distingue Purchased de Prize con el indicador de #47', async () => {
    await reachPreview(SEED_PURCHASED_QR_TOKEN)

    expect(screen.getByTestId('redemption-origin')).toHaveTextContent('Comprada con GeoPoints')
  })

  /** #47: con un premio, el copy tiene que explicar que no se descontó saldo. */
  it('explica que un premio no descuenta saldo y que el costo 0 es correcto', async () => {
    await reachPreview(SEED_PRIZE_QR_TOKEN)

    const callout = screen.getByTestId('redemption-origin')
    expect(callout).toHaveTextContent('Premio otorgado')
    expect(callout).toHaveTextContent('No se le descontó saldo')
    expect(screen.getByText('0 GeoPoints')).toBeInTheDocument()
  })

  it('confirma el canje a través del modal y muestra el estado post-canje (#46, #48)', async () => {
    await reachPreview()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar canje' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('¿Confirmar el canje?')

    fireEvent.click(screen.getByRole('button', { name: 'Sí, ya la entregué' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Canje confirmado')
  })

  it('no confirma nada si el modal se cancela', async () => {
    await reachPreview()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar canje' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('Canje confirmado')).not.toBeInTheDocument()
  })

  /**
   * #46: el botón se deshabilita mientras la request está en curso. Un doble
   * click es un segundo intento de canje sobre un token de un solo uso, así
   * que el contador de requests es lo que realmente prueba el criterio.
   */
  it('deshabilita el botón en vuelo y no manda un segundo escaneo con doble click', async () => {
    let scans = 0
    // El test libera la respuesta a mano: con una demora fija, el polling de
    // `waitFor` competía contra el mock y en una máquina cargada la petición
    // resolvía antes de observar el estado en vuelo.
    let releaseScan: () => void = () => {}
    const scanReleased = new Promise<void>((resolve) => {
      releaseScan = resolve
    })
    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/:businessId/redemptions/scan`, async () => {
        scans += 1
        await scanReleased
        return new HttpResponse(null, { status: 204 })
      })
    )

    await reachPreview()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar canje' }))
    await screen.findByRole('dialog')

    const accept = screen.getByRole('button', { name: 'Sí, ya la entregué' })
    fireEvent.click(accept)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmando…' })).toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Confirmando…' }))

    releaseScan()
    await screen.findByRole('status')
    expect(scans).toBe(1)
  })

  it('vuelve a la entrada de código sin recargar tras un canje (#48)', async () => {
    await reachPreview()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar canje' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Sí, ya la entregué' }))
    await screen.findByRole('status')

    fireEvent.click(screen.getByRole('button', { name: 'Validar otro código' }))

    expect(await screen.findByLabelText('Código del QR')).toHaveValue('')
  })

  it('permite descartar la previsualización y usar otro código', async () => {
    await reachPreview()

    fireEvent.click(screen.getByRole('button', { name: 'Usar otro código' }))

    expect(await screen.findByLabelText('Código del QR')).toBeInTheDocument()
  })

  /**
   * El lookup NUNCA devuelve 409/410 (spec "Successful preview"): un código ya
   * canjeado responde 200 con `isRedeemable: false`, y la previsualización
   * tiene que dejarlo clarísimo sin ofrecer el botón de confirmar.
   */
  it('avisa que el código ya fue canjeado y no ofrece confirmar', async () => {
    renderPage()
    await pasteToken(SEED_REDEEMED_QR_TOKEN)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este código ya fue canjeado. No hace falta entregar la recompensa de nuevo.'
    )
    expect(screen.queryByRole('button', { name: 'Confirmar canje' })).not.toBeInTheDocument()
  })

  it('avisa que el código venció y no ofrece confirmar', async () => {
    renderPage()
    await pasteToken(SEED_EXPIRED_QR_TOKEN)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este código venció. Pedile al cliente que genere uno nuevo desde su app.'
    )
    expect(screen.queryByRole('button', { name: 'Confirmar canje' })).not.toBeInTheDocument()
  })

  it.each([SEED_PENDING_QR_TOKEN, SEED_FAILED_QR_TOKEN])(
    'avisa que el canje no se puede validar y no ofrece confirmar (%s)',
    async (token) => {
      renderPage()
      await pasteToken(token)

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Este canje no está en un estado que se pueda validar por ahora.'
      )
      expect(screen.queryByRole('button', { name: 'Confirmar canje' })).not.toBeInTheDocument()
    }
  )

  it('no rompe cuando el backend no manda fecha de vencimiento (canje ya resuelto)', async () => {
    renderPage()
    await pasteToken(SEED_REDEEMED_QR_TOKEN)

    await screen.findByRole('alert')
    expect(screen.queryByText(/El código vence a las/)).not.toBeInTheDocument()
  })

  it('traduce el 404 sin afirmar que el código no existe', async () => {
    renderPage()
    await pasteToken(`Nop${'Z'.repeat(40)}=`)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No encontramos ninguna recompensa con este código'
    )
  })

  it('traduce el 403 de un token de otro negocio', async () => {
    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/:businessId/redemptions/lookup`, () =>
        HttpResponse.json({ title: 'RedemptionToken.OtherBusiness', status: 403 }, { status: 403 })
      )
    )

    renderPage()
    await pasteToken(SEED_PURCHASED_QR_TOKEN)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este código no pertenece a tu negocio'
    )
  })

  /** El límite de 30 req/min es compartido por lookup y escaneo (design D8). */
  it('muestra el mensaje de límite de requests en un 429 del lookup', async () => {
    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/:businessId/redemptions/lookup`, () =>
        HttpResponse.json({ title: 'Too Many Requests' }, { status: 429 })
      )
    )

    renderPage()
    await pasteToken(SEED_PURCHASED_QR_TOKEN)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hiciste demasiadas validaciones seguidas. Esperá un minuto'
    )
  })

  it('muestra el mensaje de límite de requests en un 429 del escaneo', async () => {
    await reachPreview()

    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/:businessId/redemptions/scan`, () =>
        HttpResponse.json({ title: 'Too Many Requests' }, { status: 429 })
      )
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar canje' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Sí, ya la entregué' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hiciste demasiadas validaciones seguidas. Esperá un minuto'
    )
  })

  /**
   * Protege la decisión de no usar `getProblemDetailsMessage`: si alguien lo
   * cambia, el `detail` inglés del backend aparece en la interfaz.
   */
  it('ignora el `detail` del backend y usa la copia en español', async () => {
    server.use(
      http.post(`${API_BASE_URL}/portal/businesses/:businessId/redemptions/lookup`, () =>
        HttpResponse.json(
          {
            title: 'RedemptionToken.AlreadyRedeemed',
            detail: 'The token was already redeemed.',
            status: 500,
          },
          { status: 500 }
        )
      )
    )

    renderPage()
    await pasteToken(SEED_PURCHASED_QR_TOKEN)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Este código ya fue canjeado')
    expect(alert).not.toHaveTextContent('already been redeemed')
  })

  it('limpia el error anterior al volver a la entrada', async () => {
    renderPage()
    await pasteToken(`Nop${'Z'.repeat(40)}=`)
    await screen.findByRole('alert')

    await pasteToken(SEED_PURCHASED_QR_TOKEN)

    expect(await screen.findByRole('button', { name: 'Confirmar canje' })).toBeInTheDocument()
  })

  /**
   * Spec `business-gateway`, escenario "Paused blocks redemption scan"
   * (real-backend-readiness PR6b): el mock replica `requireActive: true`
   * (`LookupRedemptionByQrTokenQueryHandler.cs:39`) end-to-end, desde el MSW
   * handler hasta la copia que ve el mostrador. `db.business` (contrato
   * LEGACY) solo modela `Pending|Active|Suspended`, así que `Suspended` es el
   * estado no-Active disponible acá — mismo gate que bloquearía `Paused`.
   */
  it('bloquea la búsqueda del canje con el negocio Suspended y explica por qué', async () => {
    const db = readDb()
    db.business.status = 'Suspended'
    writeDb(db)

    renderPage()
    await pasteToken(SEED_PURCHASED_QR_TOKEN)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu negocio no está activo, así que no podés validar canjes por ahora.'
    )
  })

  it('muestra el error y permite reintentar si no se pudo resolver el negocio', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/mine`, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos leer el negocio' },
          { status: 500 }
        )
      )
    )

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos leer el negocio')
  })

  /**
   * `useMyBusiness()` resuelve con éxito y `data === null` cuando
   * `/business/mine` devuelve `[]` (sin negocio propio,
   * real-backend-readiness PR6b) — un caso que `useBusinessMe()` no podía
   * representar. `getProblemDetailsMessage` cae al `fallback` porque acá no
   * hay ningún `AxiosError` que traducir.
   */
  it('muestra un error genérico y permite reintentar cuando el explorador no tiene negocio propio', async () => {
    setMockBusiness('none')

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos confirmar el canje. Probá de nuevo.'
    )
    expect(screen.getByRole('button', { name: 'Validar otro código' })).toBeInTheDocument()
  })

  it('manda el businessId del negocio autenticado en la ruta', async () => {
    let requestedUrl = ''
    server.use(
      http.post(
        `${API_BASE_URL}/portal/businesses/:businessId/redemptions/lookup`,
        ({ request }) => {
          requestedUrl = request.url
          return HttpResponse.json({}, { status: 404 })
        }
      )
    )

    renderPage()
    await pasteToken(SEED_PURCHASED_QR_TOKEN)
    await screen.findByRole('alert')

    expect(requestedUrl).toContain(
      '/portal/businesses/00000000-0000-0000-0000-000000000001/redemptions/lookup'
    )
  })
})
