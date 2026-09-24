import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { Modal } from '@/shared/components/ui/modal'
import { ThemeSwitcher } from '@/shared/components/theme-switcher'
import { useSession } from '@/shared/hooks/use-session'
import { queryClient } from '@/shared/lib/query-client'

/**
 * Trigger + menú + confirmación + handler de cierre de sesión — pieza de
 * shell-chrome montada dos veces (pie de `SidebarNav` y `MobileTopBar`) para
 * que "Cerrar sesión" sea alcanzable en cualquier viewport sin tocar
 * `BottomNav` (issue #70, decisiones de diseño #1/#2/#4/#5/#6).
 *
 * El avatar muestra una inicial estática ("N" de "Negocio"): el shell NO
 * hace fetch de identidad (decisión #4) — ni hay `/staff/me` ni la sesión
 * trae todavía una identidad real (#28 pendiente). Camino hacia adelante
 * documentado en el diseño: cuando #72 pueble `['business','me']`, el
 * trigger puede suscribirse cache-only sin request extra.
 */
export function AccountMenu() {
  const { t } = useTranslation()
  const { signOut } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleSignOutRequest() {
    // El menú se cierra ANTES de abrir la confirmación, nunca anidados: dos
    // Modal simultáneos instalarían dos listeners de Escape y dos focus
    // traps (decisión de diseño #2, trampa de secuenciación verificada en
    // el diseño).
    setMenuOpen(false)
    setConfirmOpen(true)
  }

  function handleConfirm() {
    setConfirmOpen(false)
    // Orden exacto del Explorer (settings-page.tsx): signOut() antes de
    // clear(). Sin llamada a API (no existe POST /auth/logout) y sin
    // navigate() — ProtectedRoute redirige solo al voltear isAuthenticated.
    signOut()
    queryClient.clear()
  }

  return (
    <>
      <button type="button" aria-label={t('account.open')} onClick={() => setMenuOpen(true)}>
        <Avatar initial="N" />
      </button>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title={t('account.title')}>
        {/*
          El switcher de tema va ANTES del botón destructivo (design decisión
          D-2): `Modal` enfoca el primer elemento enfocable al abrir
          (`modal.tsx`), así que este orden hace que el foco inicial caiga
          en un control seguro en vez de "Cerrar sesión". El `border-t`
          separa visualmente la preferencia reversible de la acción
          irreversible — son dos zonas, no una sola lista de acciones.
          Hogar TEMPORAL: cuando #72 (pantalla de configuración) exista,
          `ThemeSwitcher` se muda ahí y este bloque vuelve a ser
          session-only (ver doc comment de `theme-switcher.tsx`).
        */}
        <ThemeSwitcher />
        <div className="mt-4 border-t border-border pt-4">
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={handleSignOutRequest}
          >
            {t('account.signOut')}
          </Button>
        </div>
      </Modal>

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
