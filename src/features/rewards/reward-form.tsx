import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FormField } from '@/shared/components/ui/form-field'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, type SelectOption } from '@/shared/components/ui/select'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { useCreateReward } from '@/features/rewards/queries'
import { usePlaces } from '@/features/places/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { useToast } from '@/shared/hooks/use-toast'
import {
  createRewardFormSchema,
  type RewardFormValues,
} from '@/features/rewards/reward-form-schema'

export interface RewardFormProps {
  /**
   * Negocio dueño de la recompensa, que viaja en el path del `POST`. Lo
   * resuelve el contenedor (`CreateRewardPage`) y no este formulario, para
   * que el fork de carga/error del negocio viva en un solo lugar.
   */
  businessId: string
  /** Lugar preseleccionado, cuando se entra desde el detalle de un lugar. */
  defaultPlaceId?: string
}

/**
 * Formulario de creación de recompensa (#38, #40 y la mitad viable de #41).
 *
 * ⚠️ **Cuatro campos del backlog no están acá porque no existen en el
 * backend**: el tipo de recompensa (#37), la clasificación General/Special
 * y sus subcampos (#39), la vigencia (mitad de #41) y los términos propios
 * (#42). Están citados en Confluence —el flujo B-03 y RN-REW-03/03B— pero
 * el modelo desplegado no los implementa. Ver `Renata-S-A-S/geoquest#191`.
 *
 * En vez de omitirlos en silencio, el formulario **dice que faltan**. Un
 * negocio que leyó la documentación del producto va a buscar el selector de
 * tipo; no encontrarlo sin explicación se siente como un error de la
 * aplicación, no como una función pendiente.
 *
 * El lugar asociado es opcional y no viene de ninguna issue: está en
 * `PublishRewardRequest` como `Guid?`. Sin ese campo toda recompensa sería
 * válida en todos los locales, y el backend modela lo contrario.
 */
export function RewardForm({ businessId, defaultPlaceId }: RewardFormProps) {
  const { t } = useTranslation('rewards')
  const navigate = useNavigate()
  const { success } = useToast()
  const mutation = useCreateReward(businessId)

  /**
   * Las opciones de lugar salen del listado que ya existe. Si la consulta
   * todavía no resolvió, el select queda vacío y deshabilitado en vez de
   * bloquear el formulario entero: el lugar es opcional, así que no vale
   * frenar los cinco campos obligatorios por un campo que se puede dejar
   * en blanco.
   */
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
    defaultValues: {
      title: '',
      description: '',
      geoPointsCost: undefined,
      estimatedValueCop: undefined,
      placeId: defaultPlaceId ?? '',
      stockTotal: null,
    },
  })

  function onSubmit(values: RewardFormValues) {
    mutation.mutate(
      {
        title: values.title,
        description: values.description,
        geoPointsCost: values.geoPointsCost as number,
        estimatedValueCop: values.estimatedValueCop as number,
        // Vacío significa «válida en todos mis lugares», que el backend
        // representa como `null`, no como cadena vacía.
        placeId: values.placeId === '' ? null : values.placeId,
        stockTotal: Number.isNaN(values.stockTotal) ? null : (values.stockTotal ?? null),
      },
      {
        onSuccess: () => {
          success(t('createForm.success'))
          navigate('/recompensas')
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-lg font-bold text-ink">{t('createForm.title')}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField
          htmlFor="reward-title"
          label={t('createForm.fields.title.label')}
          errorId="reward-title-error"
          error={errors.title?.message}
        >
          <Input
            id="reward-title"
            aria-describedby={errors.title ? 'reward-title-error' : undefined}
            aria-invalid={errors.title ? true : undefined}
            placeholder={t('createForm.fields.title.placeholder')}
            {...register('title')}
          />
        </FormField>

        <FormField
          htmlFor="reward-description"
          label={t('createForm.fields.description.label')}
          errorId="reward-description-error"
          error={errors.description?.message}
        >
          <Textarea
            id="reward-description"
            aria-describedby={errors.description ? 'reward-description-error' : undefined}
            aria-invalid={errors.description ? true : undefined}
            placeholder={t('createForm.fields.description.placeholder')}
            {...register('description')}
          />
          <p className="font-sans text-xs text-muted">{t('createForm.fields.description.hint')}</p>
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            htmlFor="reward-cost"
            label={t('createForm.fields.geoPointsCost.label')}
            errorId="reward-cost-error"
            error={errors.geoPointsCost?.message}
          >
            <Input
              id="reward-cost"
              type="number"
              step="1"
              aria-describedby={errors.geoPointsCost ? 'reward-cost-error' : undefined}
              aria-invalid={errors.geoPointsCost ? true : undefined}
              {...register('geoPointsCost', { valueAsNumber: true })}
            />
            <p className="font-sans text-xs text-muted">
              {t('createForm.fields.geoPointsCost.hint')}
            </p>
          </FormField>

          <FormField
            htmlFor="reward-value"
            label={t('createForm.fields.estimatedValueCop.label')}
            errorId="reward-value-error"
            error={errors.estimatedValueCop?.message}
          >
            <Input
              id="reward-value"
              type="number"
              step="any"
              aria-describedby={errors.estimatedValueCop ? 'reward-value-error' : undefined}
              aria-invalid={errors.estimatedValueCop ? true : undefined}
              {...register('estimatedValueCop', { valueAsNumber: true })}
            />
            <p className="font-sans text-xs text-muted">
              {t('createForm.fields.estimatedValueCop.hint')}
            </p>
          </FormField>
        </div>

        <FormField
          htmlFor="reward-place"
          label={t('createForm.fields.place.label')}
          errorId="reward-place-error"
          error={errors.placeId?.message}
        >
          <Controller
            control={control}
            name="placeId"
            render={({ field }) => (
              <Select
                id="reward-place"
                aria-labelledby="reward-place-label"
                options={placeOptions}
                value={field.value === '' ? null : field.value}
                disabled={placeOptions.length === 0}
                placeholder={t('createForm.fields.place.placeholder')}
                onChange={field.onChange}
              />
            )}
          />
          <p className="font-sans text-xs text-muted">{t('createForm.fields.place.hint')}</p>
        </FormField>

        <FormField
          htmlFor="reward-stock"
          label={t('createForm.fields.stockTotal.label')}
          errorId="reward-stock-error"
          error={errors.stockTotal?.message}
        >
          <Input
            id="reward-stock"
            type="number"
            step="1"
            aria-describedby={errors.stockTotal ? 'reward-stock-error' : undefined}
            aria-invalid={errors.stockTotal ? true : undefined}
            placeholder={t('createForm.fields.stockTotal.placeholder')}
            {...register('stockTotal', { valueAsNumber: true })}
          />
          <p className="font-sans text-xs text-muted">{t('createForm.fields.stockTotal.hint')}</p>
        </FormField>

        {/*
         * Los campos que faltan se declaran en voz alta. Un negocio que leyó
         * la documentación del producto va a buscar el selector de tipo de
         * recompensa; no encontrarlo sin explicación se siente como un error
         * de la aplicación en vez de una función pendiente.
         */}
        <Card className="flex flex-col gap-1">
          <span className="font-sans text-xs font-bold text-ink">
            {t('createForm.unavailable.title')}
          </span>
          <p className="font-sans text-xs text-muted">{t('createForm.unavailable.description')}</p>
        </Card>

        <p className="font-sans text-xs text-muted">{t('createForm.draftNote')}</p>

        {mutation.isError && (
          <p role="alert" className="font-sans text-xs text-alert">
            {getProblemDetailsMessage(mutation.error, t('createForm.errors.generic'))}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? t('createForm.submitting') : t('createForm.submit')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/recompensas')}>
            {t('createForm.cancel')}
          </Button>
        </div>
      </form>
    </div>
  )
}
