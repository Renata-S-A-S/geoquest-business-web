import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Modal } from '@/shared/components/ui/modal'
import { useSession } from '@/shared/hooks/use-session'
import { queryClient } from '@/shared/lib/query-client'

/**
 * Cierre de sesión — mudado acá desde `AccountMenu` a pedido de Derek
 * (24 sep 2026). El avatar del shell ahora navega directo a esta pantalla en
 * vez de abrir un menú intermedio.
 *
 * La confirmación se mantiene íntegra: cerrar sesión no es destructivo de
 * datos, pero sí interrumpe el trabajo de quien lo toque por accidente, y en
 * un mostrador eso pasa. `closeOnBackdropClick={false}` sigue puesto por el
 * mismo motivo que en #70 — un click afuera no debe descartar una decisión
 * que se pidió explícitamente.
 *
 * El orden de `signOut()` antes de `queryClient.clear()` es el del Explorer y
 * no es indistinto: limpiar la cache primero dispararía refetches de las
 * queries montadas mientras la sesión todavía está activa. No hay llamada a
 * API (no existe `POST /auth/logout`) ni `navigate()`: `ProtectedRoute`
 * redirige solo al voltear `isAuthenticated`.
 */
export function SignOutSection() {
  const { t } = useTranslation()
  const { signOut } = useSession()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleConfirm() {
    setConfirmOpen(false)
    signOut()
    queryClient.clear()
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className="w-full"
        onClick={() => setConfirmOpen(true)}
      >
        {t('account.signOut')}
      </Button>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('account.confirmTitle')}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>
              {t('account.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirm}>
              {t('account.signOut')}
            </Button>
          </>
        }
      >
        {t('account.confirmDescription')}
      </Modal>
    </>
  )
}
