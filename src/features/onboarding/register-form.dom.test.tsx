import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { API_BASE_URL } from '@/shared/lib/env'
import { useToastStore } from '@/shared/stores/toast-store'
import i18next from '@/test/i18n'
import { businessKeys } from '@/features/business/queries'
import { RegisterPage } from './register-page'

/**
 * PR10b: el éxito ya no navega a `/registro/pendiente` (retirada, spec
 * #1547) sino a `/` — acá un marcador propio en vez del router real, mismo
 * criterio que `login-page.dom.test.tsx`.
 */
function renderRegisterPage(
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/registro']}>
        <Routes>
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/" element={<p>Home marker</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { ...view, queryClient }
}

/** Llena los 4 campos de texto con datos válidos — deja category/legalDocumentType a elección de cada test. */
function fillTextFields() {
  fireEvent.change(screen.getByLabelText('Nombre legal'), {
    target: { value: 'Café de la 70 SAS' },
  })
  fireEvent.change(screen.getByLabelText('Nombre público'), { target: { value: 'Café de la 70' } })
  fireEvent.change(screen.getByLabelText('Correo electrónico'), {
    target: { value: 'contacto@cafe70.co' },
  })
  fireEvent.change(screen.getByLabelText('Número de documento'), {
    target: { value: '900123456-7' },
  })
}

function selectCategory(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Categoría' }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

function selectLegalDocumentType(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Tipo de documento legal' }))
  fireEvent.click(screen.getByRole('option', { name: label }))
}

/**
 * Checks the commercial agreement checkbox — issue #23 (RN-BIZ-03). Every
 * pre-existing happy-path test needs this now, since the acceptance field
 * is required: without it, submission is blocked and `findByRole('alert')`
 * (singular) would match more than one node.
 */
function acceptAgreement() {
  fireEvent.click(screen.getByLabelText('Acepto el acuerdo comercial'))
}

/**
 * Checks the terms & conditions checkbox — issue #24. Same
 * reasoning as `acceptAgreement()`: with a second required acceptance
 * field, any test that expects a singular alert or a successful submission
 * needs both boxes checked.
 */
function acceptTerms() {
  fireEvent.click(screen.getByLabelText('Acepto los Términos y Condiciones'))
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Registrar negocio' }))
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('RegisterForm', () => {
  it('al enviar vacío, muestra el error de requerido en los 6 campos de texto más el de aceptación, y no navega', async () => {
    renderRegisterPage()

    submit()

    const alerts = await screen.findAllByRole('alert')
    expect(alerts).toHaveLength(8)
    for (const alert of alerts) {
      expect(alert).toHaveTextContent('Este campo es obligatorio')
    }
    expect(screen.getByText('Registra tu negocio')).toBeInTheDocument()
  })

  it('un email con formato inválido muestra su propio mensaje, sin bloquear el resto por "requerido"', async () => {
    renderRegisterPage()
    fillTextFields()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'no-es-un-email' },
    })
    selectCategory('Gastronomía')
    selectLegalDocumentType('NIT')
    acceptAgreement()
    acceptTerms()

    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Ingresá un correo electrónico válido')
  })

  it('sin categoría elegida, muestra su error aunque el resto del formulario sea válido', async () => {
    renderRegisterPage()
    fillTextFields()
    selectLegalDocumentType('NIT')
    acceptAgreement()
    acceptTerms()

    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Este campo es obligatorio')
    expect(screen.getByRole('combobox', { name: 'Categoría' })).toHaveTextContent(
      'Elegí una categoría'
    )
  })

  it('con datos válidos, registra el negocio, invalida businessKeys.mine y navega a /', async () => {
    const { queryClient } = renderRegisterPage()
    queryClient.setQueryData(businessKeys.mine, [])
    fillTextFields()
    selectCategory('Gastronomía')
    selectLegalDocumentType('NIT')
    acceptAgreement()
    acceptTerms()

    submit()

    expect(await screen.findByText('Home marker')).toBeInTheDocument()
    expect(queryClient.getQueryState(businessKeys.mine)?.isInvalidated).toBe(true)
  })

  it('si el backend responde 400 problem+json, muestra el detail en un toast y no navega', async () => {
    server.use(
      http.post(`${API_BASE_URL}/business/register`, () =>
        HttpResponse.json(
          { title: 'ValidationFailed', detail: 'El documento ya está registrado' },
          { status: 400 }
        )
      )
    )
    renderRegisterPage()
    fillTextFields()
    selectCategory('Gastronomía')
    selectLegalDocumentType('NIT')
    acceptAgreement()
    acceptTerms()

    submit()

    await screen.findByText('Registra tu negocio')
    expect(useToastStore.getState().toasts).toContainEqual(
      expect.objectContaining({ variant: 'error', message: 'El documento ya está registrado' })
    )
  })

  describe('commercial agreement acceptance (issue #23)', () => {
    it('blocks submission while unchecked, shows the agreement error, and never calls the mutation', async () => {
      let registerCalled = false
      server.use(
        http.post(`${API_BASE_URL}/business/register`, () => {
          registerCalled = true
          return HttpResponse.json({}, { status: 201 })
        })
      )
      renderRegisterPage()
      fillTextFields()
      selectCategory('Gastronomía')
      selectLegalDocumentType('NIT')
      acceptTerms()

      submit()

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Este campo es obligatorio')
      expect(registerCalled).toBe(false)
    })

    it('sends commercialAgreementAccepted: true when the checkbox is checked and the form is submitted', async () => {
      let capturedBody: Record<string, unknown> | undefined
      server.use(
        http.post(`${API_BASE_URL}/business/register`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>
          // Real-backend-readiness PR10: la respuesta ahora es `MyBusiness`
          // (`myBusinessSchema`), no la forma legada — este literal es el
          // mínimo que la valida.
          return HttpResponse.json(
            {
              businessId: '00000000-0000-0000-0000-000000000099',
              name: capturedBody.displayName,
              status: 'PendingVerification',
              rejectionReason: null,
              rejectedAtUtc: null,
              hasLegalDocument: false,
              legalDocumentWaived: false,
              logoUrl: null,
              hasVerificationVideo: false,
            },
            { status: 201 }
          )
        })
      )
      renderRegisterPage()
      fillTextFields()
      selectCategory('Gastronomía')
      selectLegalDocumentType('NIT')
      acceptAgreement()
      acceptTerms()

      submit()

      await screen.findByText('Home marker')
      expect(capturedBody).toMatchObject({ commercialAgreementAccepted: true })
    })

    it('shows an inline <time> with the check-time ISO after checking, and clears it after unchecking', () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-09-23T10:00:00.000Z'))

      try {
        const { container } = renderRegisterPage()
        const checkbox = screen.getByLabelText('Acepto el acuerdo comercial')

        expect(container.querySelector('time')).not.toBeInTheDocument()

        fireEvent.click(checkbox)
        const time = container.querySelector('time')
        expect(time).toHaveAttribute('dateTime', '2026-09-23T10:00:00.000Z')

        fireEvent.click(checkbox)
        expect(container.querySelector('time')).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps the placeholder agreement body hidden until the <summary> disclosure is expanded', () => {
      renderRegisterPage()
      const body = screen.getByText(/Este borrador describe/)

      expect(body).not.toBeVisible()

      // Real browsers translate a click, or Enter/Space on a focused
      // <summary>, into the same native disclosure-toggle activation —
      // jsdom doesn't simulate the keyboard-to-click translation, so click
      // stands in for it here (see also "toggles via keyboard" below).
      fireEvent.click(screen.getByText(/Leer el acuerdo comercial/))

      expect(body).toBeVisible()
    })

    it('shows all three non-binding placeholder signals in Spanish', () => {
      renderRegisterPage()

      expect(screen.getByText(/Leer el acuerdo comercial \[BORRADOR — PENDIENTE\]/)).toBeVisible()
      expect(
        screen.getByText('Texto provisional. No constituye un acuerdo comercial vinculante.')
      ).toBeInTheDocument()

      const body = screen.getByText((_, element) =>
        Boolean(
          element?.tagName === 'P' &&
          element.textContent?.startsWith(
            'Texto provisional. No constituye un acuerdo comercial vinculante.'
          ) &&
          element.textContent?.includes('Este borrador describe')
        )
      )
      expect(body).toBeInTheDocument()
    })

    it('shows all three non-binding placeholder signals in English', async () => {
      await i18next.changeLanguage('en')
      renderRegisterPage()

      expect(screen.getByText(/Read the commercial agreement \[DRAFT — PENDING\]/)).toBeVisible()
      expect(
        screen.getByText('Provisional text. This is not a binding commercial agreement.')
      ).toBeInTheDocument()

      const body = screen.getByText((_, element) =>
        Boolean(
          element?.tagName === 'P' &&
          element.textContent?.startsWith('Provisional text. This is not a binding') &&
          element.textContent?.includes('This draft describes')
        )
      )
      expect(body).toBeInTheDocument()
    })

    it('finds the checkbox via its programmatic label', () => {
      renderRegisterPage()
      expect(screen.getByLabelText('Acepto el acuerdo comercial')).toHaveAttribute(
        'type',
        'checkbox'
      )
    })

    it('toggles the checkbox via keyboard-equivalent activation (native Space activation)', () => {
      renderRegisterPage()
      const checkbox = screen.getByLabelText('Acepto el acuerdo comercial') as HTMLInputElement
      checkbox.focus()

      expect(checkbox.checked).toBe(false)
      // Real browsers translate a Space keypress on a focused native
      // checkbox into a click event (HTML activation behavior) — jsdom
      // doesn't perform that translation, so click stands in for it here.
      fireEvent.click(checkbox)
      expect(checkbox.checked).toBe(true)
    })

    it('toggles the disclosure via keyboard-equivalent activation (native Enter activation)', () => {
      renderRegisterPage()
      const summary = screen.getByText(/Leer el acuerdo comercial/)
      const body = screen.getByText(/Este borrador describe/)
      summary.focus()

      expect(body).not.toBeVisible()
      fireEvent.click(summary)
      expect(body).toBeVisible()
    })
  })

  describe('terms & conditions acceptance (issue #24)', () => {
    it('blocks submission while terms are unchecked, shows the terms error, and never calls the mutation', async () => {
      let registerCalled = false
      server.use(
        http.post(`${API_BASE_URL}/business/register`, () => {
          registerCalled = true
          return HttpResponse.json({}, { status: 201 })
        })
      )
      renderRegisterPage()
      fillTextFields()
      selectCategory('Gastronomía')
      selectLegalDocumentType('NIT')
      acceptAgreement()

      submit()

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Este campo es obligatorio')
      expect(registerCalled).toBe(false)
    })

    it('keeps the placeholder terms body hidden until the <summary> disclosure is expanded', () => {
      renderRegisterPage()
      const body = screen.getByText(/Esta versión preliminar resume/)

      expect(body).not.toBeVisible()

      fireEvent.click(screen.getByText(/Leer los Términos y Condiciones/))

      expect(body).toBeVisible()
    })

    it('shows all three non-binding placeholder signals in Spanish', () => {
      renderRegisterPage()

      expect(
        screen.getByText(/Leer los Términos y Condiciones \[BORRADOR — PENDIENTE\]/)
      ).toBeVisible()
      expect(
        screen.getByText(
          'Texto provisional. No constituye los Términos y Condiciones vinculantes de la plataforma.'
        )
      ).toBeInTheDocument()

      const body = screen.getByText((_, element) =>
        Boolean(
          element?.tagName === 'P' &&
          element.textContent?.startsWith(
            'Texto provisional. No constituye los Términos y Condiciones vinculantes de la plataforma.'
          ) &&
          element.textContent?.includes('Esta versión preliminar resume')
        )
      )
      expect(body).toBeInTheDocument()
    })

    it('shows all three non-binding placeholder signals in English', async () => {
      await i18next.changeLanguage('en')
      renderRegisterPage()

      expect(screen.getByText(/Read the Terms and Conditions \[DRAFT — PENDING\]/)).toBeVisible()
      expect(
        screen.getByText(
          'Provisional text. These are not the binding Terms and Conditions of the platform.'
        )
      ).toBeInTheDocument()

      const body = screen.getByText((_, element) =>
        Boolean(
          element?.tagName === 'P' &&
          element.textContent?.startsWith(
            'Provisional text. These are not the binding Terms and Conditions'
          ) &&
          element.textContent?.includes('This preliminary version outlines')
        )
      )
      expect(body).toBeInTheDocument()
    })
  })

  // Camino de vuelta a `/login` (#74): sin esto, un negocio que ya tiene
  // cuenta no tendría forma de llegar al login desde esta pantalla.
  it('links back to the login page', () => {
    renderRegisterPage()

    const link = screen.getByRole('link', { name: 'Iniciar sesión' })
    expect(link).toHaveAttribute('href', '/login')
  })
})
