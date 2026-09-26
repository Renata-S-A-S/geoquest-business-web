import axios from 'axios'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { FormField } from '@/shared/components/ui/form-field'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, type SelectOption } from '@/shared/components/ui/select'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { useWriteGuard } from '@/features/business/use-write-guard'
import { useUpdateReward } from '@/features/rewards/queries'
import { usePlaces } from '@/features/places/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { useToast } from '@/shared/hooks/use-toast'
import {
  createRewardFormSchema,
  type RewardFormOutput,
  type RewardFormValues,
} from '@/features/rewards/reward-form-schema'
import { committedUnits, type BusinessRewardSummary } from '@/shared/schemas/business-reward'

/**
 * Traduce los 409/403 de la edición a su motivo real.
 *
 * Los cuatro se devuelven **directo**, sin pasar por el `fallback` de
 * `getProblemDetailsMessage`: ese helper resuelve `detail ?? title ??
 * fallback`, así que el `detail` en inglés del backend ("The new stock total
 * cannot be lower than the units already committed.") le ganaría al texto
 * traducido. Mismo criterio que `publishErrorMessage` en
 * `publish-place-action.tsx`.
 */
function editErrorMessage(
  error: unknown,
  reward: BusinessRewardSummary,
  t: TFunction<'rewards'>
): string {
  const title = axios.isAxiosError(error)
    ? (error.response?.data?.title as string | undefined)
    : undefined

  if (title === 'Reward.StockBelowCommitted') {
    /**
     * ⚠️ **El backend NO manda el número de unidades comprometidas.**
     * `StockBelowCommittedError()` es un `Error(Code, Message)` de dos strings
     * sin `extensions`, y el `committed` que el dominio calcula en
     * `Reward.cs:238` nunca se interpola.
     *
     * Así que se deriva del DTO que ya tenemos. Y cuando NO se puede derivar
     * —una recompensa sin tope que recién ahora le pone uno, cuyo conteo sale
     * de `CountCommittedByRewardIdAsync` y ningún endpoint expone— el mensaje
     * lo dice en vez de inventar una cifra. Un número inventado acá sería peor
     * que no dar ninguno: el negocio ajustaría el stock a un valor que vuelve
     * a fallar.
     */
    const committed = committedUnits(reward)

    return committed === null
      ? t('editForm.errors.stockBelowCommittedUnknown')
      : t('editForm.errors.stockBelowCommitted', { committed })
  }

  if (title === 'Reward.ConcurrencyConflict') return t('editForm.errors.concurrency')
  if (title === 'Reward.NotEditable') return t('editForm.errors.notEditable')
  if (title === 'RewardPortal.BusinessNotActive') return t('editForm.errors.businessNotActive')

  return getProblemDetailsMessage(error, t('editForm.errors.generic'))
}

/** Un 409 de concurrencia es el único que se resuelve recargando. */
function isConcurrencyConflict(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.data?.title === 'Reward.ConcurrencyConflict'
}

export interface RewardEditFormProps {
  businessId: string
  /** Recompensa ya resuelta: de acá salen TODOS los valores precargados. */
  reward: BusinessRewardSummary
  /** Relee el detalle. Se usa para ofrecer recargar tras un 409 de concurrencia. */
  onReload: () => void
}

/**
 * Formulario de edición de recompensa (#110).
 *
 * ⚠️⚠️ **El `PUT` es un REEMPLAZO TOTAL y `null` BORRA** (`Reward.Edit`
 * asigna sin condición, `Reward.cs:245-252`). De ahí sale la regla que
 * gobierna todo este archivo: **precargar todos los campos y reenviarlos
 * completos, siempre.** Nunca un body parcial.
 *
 * Eso incluye `menuItemId`, que el portal no ofrece editar (la entidad
 * `MenuItem` no existe en el backend) pero que **se reenvía tal como vino**.
 * Omitirlo lo pondría en `null`, que en este endpoint significa borrar el
 * vínculo. El campo invisible es justamente el más fácil de perder.
 */
export function RewardEditForm({ businessId, reward, onReload }: RewardEditFormProps) {
  const { t } = useTranslation('rewards')
  const navigate = useNavigate()
  const { success } = useToast()
  const writeGuard = useWriteGuard()
  const mutation = useUpdateReward(businessId, reward.rewardId)

  const placesQuery = usePlaces()
  const placeOptions: SelectOption[] = (placesQuery.data ?? []).map((place) => ({
    value: place.placeId,
    label: place.name,
  }))

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RewardFormValues>({
    resolver: zodResolver(createRewardFormSchema(t)),
    /**
     * Precarga COMPLETA desde el detalle. `placeId: null` se representa como
     * cadena vacía porque es lo que el `Select` entiende por «sin elegir»; se
     * vuelve a convertir a `null` al enviar.
     */
    defaultValues: {
      title: reward.title,
      description: reward.description,
      geoPointsCost: reward.geoPointsCost,
      estimatedValueCop: reward.estimatedValueCop,
      placeId: reward.placeId ?? '',
      stockTotal: reward.stockTotal,
    },
  })

  function onSubmit(values: RewardFormOutput) {
    mutation.mutate(
      {
        title: values.title,
        description: values.description,
        geoPointsCost: values.geoPointsCost,
        estimatedValueCop: values.estimatedValueCop,
        // Vacío significa «válida en todos mis lugares», que el backend
        // representa como `null`, no como cadena vacía.
        placeId: values.placeId === '' ? null : values.placeId,
        // Ya transformado por el schema: NaN llegó acá como `null`.
        stockTotal: values.stockTotal,
        // Se reenvía sin tocar: el PUT es reemplazo total y omitirlo lo
        // borraría. No hay campo de formulario para esto a propósito.
        menuItemId: reward.menuItemId,
      },
      {
        onSuccess: () => {
          success(t('editForm.success'))
          navigate(`/recompensas/${reward.rewardId}`)
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 p-4" noValidate>
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-lg font-bold text-ink">{t('editForm.title')}</h1>
        <Link
          to={`/recompensas/${reward.rewardId}`}
          className="font-sans text-xs font-bold text-teal hover:underline"
        >
          {t('editForm.cancel')}
        </Link>
      </div>

      <Card className="flex flex-col gap-4">
        <FormField
          htmlFor="reward-edit-title"
          label={t('createForm.fields.title.label')}
          errorId="reward-edit-title-error"
          error={errors.title?.message}
        >
          <Input
            id="reward-edit-title"
            aria-describedby={errors.title ? 'reward-edit-title-error' : undefined}
            aria-invalid={errors.title ? true : undefined}
            {...register('title')}
          />
        </FormField>

        <FormField
          htmlFor="reward-edit-description"
          label={t('createForm.fields.description.label')}
          errorId="reward-edit-description-error"
          error={errors.description?.message}
        >
          <Textarea
            id="reward-edit-description"
            aria-describedby={errors.description ? 'reward-edit-description-error' : undefined}
            aria-invalid={errors.description ? true : undefined}
            {...register('description')}
          />
        </FormField>

        <FormField
          htmlFor="reward-edit-geo-points"
          label={t('createForm.fields.geoPointsCost.label')}
          errorId="reward-edit-geo-points-error"
          error={errors.geoPointsCost?.message}
        >
          <Input
            id="reward-edit-geo-points"
            type="number"
            step="1"
            aria-describedby={errors.geoPointsCost ? 'reward-edit-geo-points-error' : undefined}
            aria-invalid={errors.geoPointsCost ? true : undefined}
            {...register('geoPointsCost', { valueAsNumber: true })}
          />
        </FormField>

        <FormField
          htmlFor="reward-edit-value"
          label={t('createForm.fields.estimatedValueCop.label')}
          errorId="reward-edit-value-error"
          error={errors.estimatedValueCop?.message}
        >
          <Input
            id="reward-edit-value"
            type="number"
            step="any"
            aria-describedby={errors.estimatedValueCop ? 'reward-edit-value-error' : undefined}
            aria-invalid={errors.estimatedValueCop ? true : undefined}
            {...register('estimatedValueCop', { valueAsNumber: true })}
          />
        </FormField>

        <FormField
          htmlFor="reward-edit-place"
          label={t('createForm.fields.place.label')}
          errorId="reward-edit-place-error"
          error={errors.placeId?.message}
        >
          <Controller
            control={control}
            name="placeId"
            render={({ field }) => (
              <Select
                id="reward-edit-place"
                ref={field.ref}
                aria-labelledby="reward-edit-place-label"
                options={placeOptions}
                value={field.value === '' ? null : field.value}
                disabled={placeOptions.length === 0}
                placeholder={t('createForm.fields.place.placeholder')}
                onChange={field.onChange}
              />
            )}
          />
          {/*
            El aviso más importante del formulario: vaciar este campo NO deja
            el lugar como estaba, lo DESVINCULA. Es la consecuencia directa de
            que el PUT sea reemplazo total, y sin decirlo el dueño no tiene
            forma de saberlo.
          */}
          <p className="font-sans text-xs text-muted">{t('editForm.fields.place.unlinkWarning')}</p>
        </FormField>

        <FormField
          htmlFor="reward-edit-stock"
          label={t('createForm.fields.stockTotal.label')}
          errorId="reward-edit-stock-error"
          error={errors.stockTotal?.message}
        >
          <Input
            id="reward-edit-stock"
            type="number"
            step="1"
            placeholder={t('createForm.fields.stockTotal.placeholder')}
            aria-describedby={errors.stockTotal ? 'reward-edit-stock-error' : undefined}
            aria-invalid={errors.stockTotal ? true : undefined}
            {...register('stockTotal', { valueAsNumber: true })}
          />
          <p className="font-sans text-xs text-muted">{stockHint(reward, t)}</p>
        </FormField>
      </Card>

      {mutation.isError && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="font-sans text-xs text-alert">
            {editErrorMessage(mutation.error, reward, t)}
          </p>
          {/*
            Recargar, no reintentar a ciegas. El token de concurrencia (`xmin`)
            es una shadow property que NO viaja en ningún DTO, así que el
            portal no puede mandar un ETag ni detectar el conflicto antes de
            intentar: solo puede reaccionar al 409. Y reenviar el mismo body
            volvería a pisar lo que el otro escritor acaba de guardar.
          */}
          {isConcurrencyConflict(mutation.error) && (
            <Button type="button" variant="secondary" onClick={onReload}>
              {t('editForm.reload')}
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={mutation.isPending || writeGuard.disabled}
          aria-describedby={writeGuard.describedBy}
        >
          {mutation.isPending ? t('editForm.submitting') : t('editForm.submit')}
        </Button>
      </div>
    </form>
  )
}

/**
 * El stock es el campo con más trampa, así que la ayuda cambia según el caso.
 *
 * Con tope se puede decir cuántas unidades ya están comprometidas, que es el
 * piso por debajo del cual el servidor rechaza con 409. Sin tope no se puede:
 * ese número solo existe del lado del servidor.
 */
function stockHint(reward: BusinessRewardSummary, t: TFunction<'rewards'>): string {
  const committed = committedUnits(reward)

  if (committed === null) return t('editForm.fields.stockTotal.hintUncapped')

  return t('editForm.fields.stockTotal.hintCommitted', { committed })
}
