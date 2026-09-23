import { X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Mitad presentacional — mismo patrón de banner descartable que
 * `FeatureErrorBoundary`/`geoquest-web` (`common:aria.dismiss`), para no
 * inventar una segunda convención de banner en el portal.
 */
export function UpdatePromptBanner({
  onUpdate,
  onDismiss,
}: {
  onUpdate: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-x-3 top-3 z-50 flex items-center justify-between gap-3 rounded-md border border-border bg-surface-raised px-3 py-2.5 shadow-md">
      <p className="font-sans text-xs text-ink">
        <b className="text-teal">{t('notifications.updateAvailable')}</b>
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onUpdate}
          className="font-sans text-xs font-semibold text-teal"
        >
          {t('notifications.update')}
        </button>
        <button
          type="button"
          aria-label={t('aria.dismiss')}
          onClick={onDismiss}
          className="text-muted"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  )
}

/**
 * Container — habla con el service worker generado por Workbox vía
 * `useRegisterSW` (aliaseado a `src/test/pwa-register-stub.ts` bajo Vitest,
 * ver `vitest.config.ts`). No renderiza nada salvo que haya una versión
 * nueva esperando (`needRefresh`). Descartar vuelve `needRefresh` a false —
 * el usuario sigue en la versión actual y el prompt reaparece en la próxima
 * carga si el worker en espera sigue ahí; nada se recarga a la fuerza.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <UpdatePromptBanner
      onUpdate={() => {
        void updateServiceWorker(true)
      }}
      onDismiss={() => setNeedRefresh(false)}
    />
  )
}
