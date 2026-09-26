import { apiClient } from '@/shared/lib/api-client'

/**
 * `POST /business/{businessId}/legal-document` — PR7b, spec #1547 "Rejected
 * gate con reenvío". Multipart con el archivo en el campo **`file`** (mismo
 * nombre que `upload-reward-image.ts`), **204 sin cuerpo** en éxito: nada que
 * parsear, `useSubmitLegalDocument` invalida `businessKeys.mine` en su lugar.
 * No se fija `Content-Type` a mano: el navegador pone el `boundary`.
 */
export async function submitLegalDocument(businessId: string, file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)

  await apiClient.post(`/business/${businessId}/legal-document`, form)
}
