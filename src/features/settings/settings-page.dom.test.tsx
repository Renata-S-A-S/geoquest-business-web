import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS_STAFF, SEED_BUSINESS_STAFF_USERNAME } from '@/shared/mocks/seed'
import { useThemeStore } from '@/shared/stores/theme-store'
import { useBusinessSessionStore } from '@/shared/stores/business-session-store'
import { createMockJwt } from '@/shared/mocks/mock-jwt'
import { SettingsPage } from './settings-page'

function renderSettingsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>
  )
}

/**
 * `AccountBlock` (issue #1547, PR2) lee identidad de `useIdentityClaims()`,
 * que decodifica el `accessToken` de la sesión real — ya NO hace
 * `GET /business-staff/me`. Sin esto, cada test de este archivo vería el
 * bloque de cuenta en su estado "sin sesión" (claims `null`).
 */
function signInAsSeedStaff() {
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

// Aplica a AMBOS `describe` de este archivo: sin sesión, el bloque de
// cuenta cae en su estado "sin claims" y varios `findByText(username)` de
// las secciones de abajo (idioma, legal) nunca resolverían.
beforeEach(() => {
  signInAsSeedStaff()
})

describe('SettingsPage', () => {
  it('muestra el título de la pantalla', () => {
    renderSettingsPage()

    expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument()
  })

  /**
   * El bloque de cuenta ya no hace fetch (claims salen del token, síncrono):
   * el ÚNICO indicador de carga que puede quedar pendiente es el del
   * negocio. Antes de #1547 PR2 acá había DOS loaders — cubre el cambio de
   * conducta, no solo lo que quedó igual.
   */
  it('el único indicador de carga pendiente es el del bloque de negocio — el de cuenta ya no hace fetch', async () => {
    server.use(http.get(`${API_BASE_URL}/business/me`, () => new Promise(() => {})))

    renderSettingsPage()

    const loaders = await screen.findAllByRole('status')
    expect(loaders).toHaveLength(1)
  })

  /**
   * La contracara: el bloque del negocio falla y el de la cuenta sigue
   * mostrando sus datos. Este caso fija la independencia entre las dos
   * secciones, que antes de la fusión no podía existir porque vivían en
   * pantallas distintas.
   */
  it('una falla en el bloque de negocio no tumba el bloque de cuenta', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json({ title: 'InternalError' }, { status: 500 })
      )
    )

    renderSettingsPage()

    // El bloque de cuenta resuelve igual — no depende de ninguna query.
    expect(screen.getByText(SEED_BUSINESS_STAFF_USERNAME)).toBeInTheDocument()
    // Y el de negocio muestra su propio error, acotado a su sección.
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  /**
   * `decodeJwtClaims` nunca lanza (jwt-claims.ts): un token corrupto
   * devuelve `null` y el bloque muestra un mensaje genérico. Ya no hay
   * botón de reintentar — no hay ninguna query que reintentar, el dato sale
   * directo del token de la sesión.
   */
  it('muestra un mensaje genérico y ningún botón de reintentar si el token no decodifica a claims válidas', () => {
    useBusinessSessionStore.setState({
      isAuthenticated: true,
      accessToken: 'token-sin-forma-de-jwt',
      accessTokenExpiresAtUtc: null,
      refreshToken: 'a-refresh',
      refreshTokenExpiresAtUtc: null,
    })

    renderSettingsPage()

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar los datos de tu cuenta.')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.queryByText(SEED_BUSINESS_STAFF_USERNAME)).not.toBeInTheDocument()
  })

  it('el selector de tema se renderiza igual aunque el token no traiga claims válidas — son independientes', () => {
    useBusinessSessionStore.setState({
      isAuthenticated: true,
      accessToken: 'token-sin-forma-de-jwt',
      accessTokenExpiresAtUtc: null,
      refreshToken: 'a-refresh',
      refreshTokenExpiresAtUtc: null,
    })

    renderSettingsPage()

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument()
  })

  it('muestra el username y el correo de acceso decodificados del token, con el correo etiquetado como credencial', () => {
    renderSettingsPage()

    expect(screen.getByText(SEED_BUSINESS_STAFF_USERNAME)).toBeInTheDocument()
    expect(screen.getByText(SEED_BUSINESS_STAFF.email)).toBeInTheDocument()
    expect(
      screen.getByText(
        'Es el correo con el que iniciás sesión — distinto del correo de contacto público del negocio, que se edita en tu perfil de negocio.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /**
   * Triangulación: otra identidad (otro token) debe reflejarse tal cual,
   * no un valor pisado/hardcodeado en el componente.
   */
  it('muestra la identidad que traiga el token, no un valor fijo — triangulación contra el Fake It', () => {
    useBusinessSessionStore.setState({
      isAuthenticated: true,
      accessToken: createMockJwt({
        sub: '11111111-1111-1111-1111-111111111111',
        email: 'owner@otronegocio.com',
        username: 'owner_otro',
      }),
      accessTokenExpiresAtUtc: null,
      refreshToken: 'a-refresh',
      refreshTokenExpiresAtUtc: null,
    })

    renderSettingsPage()

    expect(screen.getByText('owner_otro')).toBeInTheDocument()
    expect(screen.getByText('owner@otronegocio.com')).toBeInTheDocument()
  })

  it('no ofrece edición de username ni de correo — ambos son de solo lectura', async () => {
    renderSettingsPage()

    await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
  })

  /**
   * Este caso afirmaba lo contrario —"el logout sigue siendo exclusivo del
   * menú de cuenta"— y defendía la decisión de #70. Derek la revirtió el 24
   * sep 2026: el avatar navega directo acá y cerrar sesión vive en esta
   * pantalla, así que el test se invierte en vez de borrarse.
   */
  it('muestra el botón de cerrar sesión, que ahora vive acá', async () => {
    renderSettingsPage()

    await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)

    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  /**
   * La confirmación se mantuvo al mudar el logout. Cerrar sesión no destruye
   * datos, pero interrumpe el trabajo de quien lo toque por accidente — y en
   * un mostrador eso pasa.
   */
  it('pide confirmación antes de cerrar sesión, no lo hace de una', async () => {
    renderSettingsPage()

    await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)
    screen.getByRole('button', { name: 'Cerrar sesión' }).click()

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Vas a salir del portal/)).toBeInTheDocument()
  })

  it('el selector de tema funciona desde /configuracion', async () => {
    renderSettingsPage()
    await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)

    const group = screen.getByRole('group', { name: 'Tema' })
    within(group).getByRole('button', { name: 'Oscuro' }).click()

    expect(useThemeStore.getState().mode).toBe('dark')
  })
})

/**
 * Las dos secciones nuevas que pidió Derek: idioma y legal.
 */
describe('SettingsPage — idioma y legal', () => {
  it('ofrece el selector de idioma, que antes no existía en ninguna pantalla', async () => {
    renderSettingsPage()

    await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)

    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument()
  })

  it('muestra el acuerdo comercial y los términos, reutilizando la copia del registro', async () => {
    renderSettingsPage()

    await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)

    expect(screen.getByText(/Leer el acuerdo comercial/)).toBeInTheDocument()
    expect(screen.getByText(/Leer los Términos y Condiciones/)).toBeInTheDocument()
  })

  /**
   * La garantía de #61: no hay forma de renderizar un bloque legal sin su
   * aviso de no-vinculante. Acá se verifica que esa garantía viaja con el
   * componente a esta pantalla nueva, no solo al formulario de registro.
   */
  it('cada bloque legal trae su aviso de que el texto no es vinculante', async () => {
    renderSettingsPage()

    await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)

    // `getAllByText` y no `getByText`: el aviso aparece DOS veces por bloque,
    // en el slot de aviso y al inicio del cuerpo. Es la garantía triple que
    // `LegalDisclosure` documenta, no una duplicación accidental — así que el
    // test la reconoce en vez de pelearse con ella.
    expect(
      screen.getAllByText(/No constituye un acuerdo comercial vinculante/).length
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByText(/No constituye los Términos y Condiciones vinculantes/).length
    ).toBeGreaterThanOrEqual(1)
  })

  it('marca los textos legales como borrador pendiente', async () => {
    renderSettingsPage()

    await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)

    expect(screen.getAllByText(/BORRADOR — PENDIENTE/).length).toBeGreaterThanOrEqual(2)
  })
})
