import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/msw-server'
import { setMockBusiness } from '@/test/mock-business'
import { submitLegalDocument } from './submit-legal-document'
import { getMyBusinesses } from './get-my-businesses'
import { API_BASE_URL } from '@/shared/lib/env'
import { SEED_BUSINESS } from '@/shared/mocks/seed'

const businessId = SEED_BUSINESS.id
const DOCUMENT_URL = `${API_BASE_URL}/business/${businessId}/legal-document`

function pdf(name = 'documento.pdf', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' })
}

describe('submitLegalDocument', () => {
  it('manda el archivo en el campo "file", con el Content-Type que pone el navegador', async () => {
    setMockBusiness('Rejected')
    const captured: { names?: string[]; fileName?: string; contentType?: string | null } = {}
    server.use(
      http.post(DOCUMENT_URL, async ({ request }) => {
        captured.contentType = request.headers.get('content-type')
        const form = await request.formData()
        captured.names = [...form.keys()]
        const file = form.get('file')
        // Cross-realm: el `File` de undici no es `instanceof` el de jsdom.
        captured.fileName = typeof file === 'string' ? undefined : (file?.name ?? undefined)
        return new HttpResponse(null, { status: 204 })
      })
    )

    await submitLegalDocument(businessId, pdf('mi-documento.pdf'))

    expect(captured.names).toEqual(['file'])
    expect(captured.fileName).toBe('mi-documento.pdf')
    expect(captured.contentType).toMatch(/^multipart\/form-data; boundary=/)
  })

  it('transiciona Rejected → PendingVerification y limpia motivo y fecha', async () => {
    setMockBusiness('Rejected')

    await submitLegalDocument(businessId, pdf())

    const [business] = await getMyBusinesses()
    expect(business.status).toBe('PendingVerification')
    expect(business.rejectionReason).toBeNull()
    expect(business.rejectedAtUtc).toBeNull()
  })

  it('rechaza con 409 Business.NotAwaitingVerification si el negocio no puede reenviar', async () => {
    setMockBusiness('Active') // sin dispensa (legalDocumentWaived: false)

    await expect(submitLegalDocument(businessId, pdf())).rejects.toMatchObject({
      response: { status: 409, data: { title: 'Business.NotAwaitingVerification' } },
    })
  })

  it('rechaza con 403 si el businessId no es el del negocio propio', async () => {
    setMockBusiness('Rejected')

    await expect(
      submitLegalDocument('00000000-0000-0000-0000-0000000000aa', pdf())
    ).rejects.toMatchObject({
      response: { status: 403, data: { title: 'RewardPortal.NotBusinessOwner' } },
    })
  })

  it('rechaza un archivo vacío con 400 BusinessDocument.Empty', async () => {
    setMockBusiness('Rejected')

    await expect(submitLegalDocument(businessId, pdf('vacio.pdf', 0))).rejects.toMatchObject({
      response: { status: 400, data: { title: 'BusinessDocument.Empty' } },
    })
  })
})
