import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS_STAFF, SEED_BUSINESS_STAFF_USERNAME } from '@/shared/mocks/seed'
import { useThemeStore } from '@/shared/stores/theme-store'
import { SettingsPage } from './settings-page'

function renderSettingsPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>
  )
}

describe('SettingsPage', () => {
  it('muestra el título de la pantalla', () => {
    renderSettingsPage()

    expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument()
  })

  /**
   * `findAllByRole` y no `findByRole`: desde la fusión de `/negocio` la
   * pantalla tiene DOS bloques que cargan por separado, el del negocio y el de
   * la cuenta. Que sean dos indicadores y no uno es la conducta buscada — cada
   * bloque degrada solo, así que una falla en uno no tumba al otro.
   */
  it('muestra el indicador de carga del bloque de cuenta mientras su query está pendiente', async () => {
    server.use(http.get(`${API_BASE_URL}/business-staff/me`, () => new Promise(() => {})))

    renderSettingsPage()

    const loaders = await screen.findAllByRole('status')
    expect(loaders.map((node) => node.textContent)).toContain('Cargando los datos de tu cuenta…')
  })

  /**
   * La contracara: el bloque del negocio falla y el de la cuenta sigue
   * mostrando sus datos. Este caso fija la independencia entre las dos
   * consultas, que antes de la fusión no podía existir porque vivían en
   * pantallas distintas.
   */
  it('una falla en el bloque de negocio no tumba el bloque de cuenta', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business/me`, () =>
        HttpResponse.json({ title: 'InternalError' }, { status: 500 })
      )
    )

    renderSettingsPage()

    // El bloque de cuenta resuelve igual.
    expect(await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)).toBeInTheDocument()
    // Y el de negocio muestra su propio error, acotado a su sección.
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('muestra el error inline con reintento cuando la query falla, sin renderizar los datos', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business-staff/me`, () =>
        HttpResponse.json(
          { title: 'InternalError', detail: 'No pudimos consultar tu cuenta' },
          { status: 500 }
        )
      )
    )

    renderSettingsPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar tu cuenta')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled()
    expect(screen.queryByText(SEED_BUSINESS_STAFF_USERNAME)).not.toBeInTheDocument()
  })

  it('el selector de tema se renderiza igual aunque la lectura de la cuenta falle — son independientes', async () => {
    server.use(
      http.get(`${API_BASE_URL}/business-staff/me`, () =>
        HttpResponse.json({ title: 'InternalError' }, { status: 500 })
      )
    )

    renderSettingsPage()

    await screen.findByRole('alert')
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument()
  })

  it('reintenta la query al hacer click en el botón de reintentar tras un error', async () => {
    let callCount = 0
    server.use(
      http.get(`${API_BASE_URL}/business-staff/me`, () => {
        callCount += 1
        if (callCount === 1) {
          return HttpResponse.json(
            { title: 'InternalError', detail: 'No pudimos consultar tu cuenta' },
            { status: 500 }
          )
        }
        return HttpResponse.json({ ...SEED_BUSINESS_STAFF, username: SEED_BUSINESS_STAFF_USERNAME })
      })
    )

    renderSettingsPage()

    const retryButton = await screen.findByRole('button', { name: 'Reintentar' })
    retryButton.click()

    expect(await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)).toBeInTheDocument()
    expect(callCount).toBe(2)
  })

  it('muestra el username y el correo de acceso cuando la query resuelve, con el correo etiquetado como credencial', async () => {
    renderSettingsPage()

    expect(await screen.findByText(SEED_BUSINESS_STAFF_USERNAME)).toBeInTheDocument()
    expect(screen.getByText(SEED_BUSINESS_STAFF.email)).toBeInTheDocument()
    expect(
      screen.getByText(
        'Es el correo con el que iniciás sesión — distinto del correo de contacto público del negocio, que se edita en tu perfil de negocio.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
