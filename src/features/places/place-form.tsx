import axios from 'axios'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import type { TFunction } from 'i18next'
import { FormField } from '@/shared/components/ui/form-field'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, type SelectOption } from '@/shared/components/ui/select'
import { Button } from '@/shared/components/ui/button'
import { useCreatePlace } from '@/features/places/queries'
import { getProblemDetailsMessage } from '@/shared/lib/get-problem-details-message'
import { useToast } from '@/shared/hooks/use-toast'
import {
  DEFAULT_CHECK_IN_RADIUS_METERS,
  MAX_CHECK_IN_RADIUS_METERS,
  MIN_CHECK_IN_RADIUS_METERS,
} from '@/shared/schemas/business-place'
import {
  categoriesInOrder,
  Category,
  isValidTaxonomy,
  subcategoriesOf,
  type Subcategory,
} from '@/shared/schemas/taxonomy'

/**
 * Fábrica de schema, no un schema estático — mismo criterio que
 * `createUpdateBusinessSchema` (#72): zod congela sus mensajes al
 * construirse, así que un schema a nivel de módulo se quedaría con el
 * idioma del primer import.
 *
 * Los campos numéricos se declaran como `string` y se convierten en el
 * submit: un `<input type="number">` vacío entrega `''`, y `z.coerce.number()`
 * lo convertiría en `0` — un cero silencioso que pasaría la validación de
 * rango del radio por debajo y mandaría una latitud de 0 al backend. Validar
 * el texto primero y convertir después es lo que evita ese cero fantasma.
 */
function createPlaceFormSchema(t: TFunction<'places'>) {
  const numericText = z
    .string()
    .min(1, t('createForm.validation.required'))
    .refine((value) => value.trim() !== '' && Number.isFinite(Number(value)), {
      message: t('createForm.validation.number'),
    })

  return z.object({
    name: z.string().min(1, t('createForm.validation.required')),
    description: z.string().min(1, t('createForm.validation.required')),
    category: z.string().min(1, t('createForm.validation.required')),
    subcategory: z.string().min(1, t('createForm.validation.required')),
    latitude: numericText.refine((value) => Number(value) >= -90 && Number(value) <= 90, {
      message: t('createForm.validation.latitudeRange'),
    }),
    longitude: numericText.refine((value) => Number(value) >= -180 && Number(value) <= 180, {
      message: t('createForm.validation.longitudeRange'),
    }),
    checkInRadiusMeters: numericText.refine(
      (value) =>
        Number.isInteger(Number(value)) &&
        Number(value) >= MIN_CHECK_IN_RADIUS_METERS &&
        Number(value) <= MAX_CHECK_IN_RADIUS_METERS,
      { message: t('createForm.validation.radiusRange') }
    ),
  })
}
type PlaceFormValues = z.infer<ReturnType<typeof createPlaceFormSchema>>

/**
 * Mensaje de error de la mutación. El 400 `Place.InvalidTaxonomy` merece
 * texto propio: el formulario ya impide esa combinación reseteando la
 * subcategoría, así que si llega significa que algo se desalineó, y el
 * usuario tiene que entender QUÉ rechazó el servidor en vez de ver el mismo
 * mensaje que una falla de red.
 */
function createErrorMessage(error: unknown, t: TFunction<'places'>): string {
  const isTaxonomyError =
    axios.isAxiosError(error) && error.response?.data?.title === 'Place.InvalidTaxonomy'

  // Se devuelve el texto traducido DIRECTO, sin pasar por el `fallback` de
  // `getProblemDetailsMessage`: ese helper resuelve `detail ?? title ??
  // fallback`, o sea que el `title` del backend le gana al fallback y el
  // usuario terminaría leyendo el código crudo `Place.InvalidTaxonomy`.
  // Para el resto de los errores sí conviene el helper, porque el `detail`
  // del backend es un mensaje pensado para humanos.
  if (isTaxonomyError) return t('createForm.errors.invalidTaxonomy')

  return getProblemDetailsMessage(error, t('createForm.errors.generic'))
}

/**
 * Formulario de creación de lugar (#30 y #33). El radio de check-in (#33)
 * vive acá y no en una pantalla propia: es un campo del mismo alta, y
 * separarlo obligaría a crear el lugar primero para después configurarlo.
 *
 * **Sin campo de puntos**, por ADR-041/043 y RN-GAM-10 — el contrato pide
 * eliminarlo, no solo cambiar su default. `createPlace` completa el mínimo
 * que el backend exige; ver el comentario largo en `api/create-place.ts`.
 *
 * **Sin campo de `menuItemId`**: ese campo existe en el backend pero apunta
 * a una entidad `MenuItem` que no existe en ninguna parte de la solución.
 * Ver `Renata-S-A-S/geoquest#191`.
 *
 * ⚠️ **Las coordenadas se escriben a mano**, como interino. #32 trae el
 * selector en mapa con Mapbox. El shape ya está resuelto (`latitude` y
 * `longitude` planos), así que ese cambio es de interfaz, no de contrato.
 */
export function PlaceForm() {
  const { t } = useTranslation('places')
  const navigate = useNavigate()
  const { success } = useToast()
  const mutation = useCreatePlace()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PlaceFormValues>({
    resolver: zodResolver(createPlaceFormSchema(t)),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      subcategory: '',
      latitude: '',
      longitude: '',
      checkInRadiusMeters: String(DEFAULT_CHECK_IN_RADIUS_METERS),
    },
  })

  const selectedCategory = watch('category')

  const categoryOptions: SelectOption[] = categoriesInOrder.map((category) => ({
    value: String(category),
    label: t(`taxonomy.categories.${category}`),
  }))

  /**
   * Las subcategorías dependen de la categoría elegida. El backend valida el
   * par y rechaza con 400 `Place.InvalidTaxonomy`, así que ofrecer las 20
   * siempre dejaría al usuario armar una combinación que el servidor va a
   * rechazar — un viaje perdido y un error que no puede entender.
   */
  const subcategoryOptions: SelectOption[] =
    selectedCategory === ''
      ? []
      : subcategoriesOf(Number(selectedCategory) as Category).map((subcategory) => ({
          value: String(subcategory),
          label: t(`taxonomy.subcategories.${subcategory}`),
        }))

  function onSubmit(values: PlaceFormValues) {
    const category = Number(values.category) as Category
    const subcategory = Number(values.subcategory) as Subcategory

    // Última red antes de gastar el request. El reset de subcategoría al
    // cambiar de categoría ya lo hace improbable, pero un estado de
    // formulario restaurado o un cambio futuro podría colarlo.
    if (!isValidTaxonomy(category, subcategory)) return

    mutation.mutate(
      {
        name: values.name,
        description: values.description,
        category,
        subcategory,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
        checkInRadiusMeters: Number(values.checkInRadiusMeters),
      },
      {
        onSuccess: () => {
          success(t('createForm.success'))
          navigate('/lugares')
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-lg font-bold text-ink">{t('createForm.title')}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField
          htmlFor="place-name"
          label={t('createForm.fields.name.label')}
          errorId="place-name-error"
          error={errors.name?.message}
        >
          <Input
            id="place-name"
            aria-describedby={errors.name ? 'place-name-error' : undefined}
            placeholder={t('createForm.fields.name.placeholder')}
            {...register('name')}
          />
        </FormField>

        <FormField
          htmlFor="place-description"
          label={t('createForm.fields.description.label')}
          errorId="place-description-error"
          error={errors.description?.message}
        >
          <Textarea
            id="place-description"
            aria-describedby={errors.description ? 'place-description-error' : undefined}
            placeholder={t('createForm.fields.description.placeholder')}
            {...register('description')}
          />
          <p className="font-sans text-xs text-muted">
            {t('createForm.fields.description.hint')}
          </p>
        </FormField>

        <FormField
          htmlFor="place-category"
          label={t('createForm.fields.category.label')}
          errorId="place-category-error"
          error={errors.category?.message}
        >
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                id="place-category"
                aria-labelledby="place-category-label"
                options={categoryOptions}
                value={field.value === '' ? null : field.value}
                placeholder={t('createForm.fields.category.placeholder')}
                onChange={(value) => {
                  field.onChange(value)
                  // Sin este reset, cambiar de categoría dejaría seleccionada
                  // una subcategoría de la anterior, y el submit se iría con
                  // un par que el backend rechaza con 400.
                  setValue('subcategory', '')
                }}
              />
            )}
          />
        </FormField>

        <FormField
          htmlFor="place-subcategory"
          label={t('createForm.fields.subcategory.label')}
          errorId="place-subcategory-error"
          error={errors.subcategory?.message}
        >
          <Controller
            control={control}
            name="subcategory"
            render={({ field }) => (
              <Select
                id="place-subcategory"
                aria-labelledby="place-subcategory-label"
                options={subcategoryOptions}
                value={field.value === '' ? null : field.value}
                disabled={selectedCategory === ''}
                placeholder={
                  selectedCategory === ''
                    ? t('createForm.fields.subcategory.pickCategoryFirst')
                    : t('createForm.fields.subcategory.placeholder')
                }
                onChange={field.onChange}
              />
            )}
          />
        </FormField>

        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              htmlFor="place-latitude"
              label={t('createForm.fields.latitude.label')}
              errorId="place-latitude-error"
              error={errors.latitude?.message}
            >
              <Input
                id="place-latitude"
                inputMode="decimal"
                aria-describedby={errors.latitude ? 'place-latitude-error' : undefined}
                placeholder={t('createForm.fields.latitude.placeholder')}
                {...register('latitude')}
              />
            </FormField>

            <FormField
              htmlFor="place-longitude"
              label={t('createForm.fields.longitude.label')}
              errorId="place-longitude-error"
              error={errors.longitude?.message}
            >
              <Input
                id="place-longitude"
                inputMode="decimal"
                aria-describedby={errors.longitude ? 'place-longitude-error' : undefined}
                placeholder={t('createForm.fields.longitude.placeholder')}
                {...register('longitude')}
              />
            </FormField>
          </div>
          <p className="font-sans text-xs text-muted">{t('createForm.fields.coordinatesHint')}</p>
        </div>

        <FormField
          htmlFor="place-radius"
          label={t('createForm.fields.checkInRadiusMeters.label')}
          errorId="place-radius-error"
          error={errors.checkInRadiusMeters?.message}
        >
          <Input
            id="place-radius"
            inputMode="numeric"
            aria-describedby={errors.checkInRadiusMeters ? 'place-radius-error' : undefined}
            {...register('checkInRadiusMeters')}
          />
          <p className="font-sans text-xs text-muted">
            {t('createForm.fields.checkInRadiusMeters.hint')}
          </p>
        </FormField>

        {mutation.isError && (
          <p role="alert" className="font-sans text-xs text-alert">
            {createErrorMessage(mutation.error, t)}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? t('createForm.submitting') : t('createForm.submit')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/lugares')}>
            {t('createForm.cancel')}
          </Button>
        </div>
      </form>
    </div>
  )
}
