import { z } from 'zod'
import type { TFunction } from 'i18next'

/**
 * Fábrica de schema compartida por el alta (#38/#40/#41) y la edición (#110).
 *
 * Extraída de `reward-form.tsx` para que las dos pantallas validen con las
 * MISMAS reglas: es criterio de aceptación explícito de #110 («reutiliza el
 * formulario de alta donde tenga sentido, sin duplicar la validación»). Y
 * tiene sustento en el contrato: `EditRewardRequest` es **byte-idéntico** a
 * `PublishRewardRequest`, así que dos schemas distintos serían dos formas de
 * describir el mismo body — y tarde o temprano divergirían.
 *
 * Es una fábrica y no un schema estático porque zod congela sus mensajes al
 * construirse: uno a nivel de módulo se quedaría con el idioma del primer
 * import.
 *
 * Las claves de i18n siguen viviendo bajo `createForm.validation.*` aunque las
 * use también la edición. Duplicarlas bajo `editForm.validation.*` con los
 * mismos textos sería hacer trabajar al test de paridad es/en para nada.
 *
 * Los numéricos se validan **como números** (`valueAsNumber: true` en el
 * registro), no como texto. `stockTotal` es la excepción interesante: es
 * opcional, y un campo vacío llega como `NaN`, así que se normaliza a `null`
 * — que es lo que el backend entiende por «sin límite». Sin ese paso, un
 * stock vacío viajaría como `NaN` y el request fallaría con un error que no
 * tendría nada que ver con lo que el usuario hizo.
 *
 * ⚠️ Nunca `z.coerce.number()`: convierte ANTES de validar y `Number('')` es
 * `0`, así que un campo vacío pasaría como cero sin un solo error. Para
 * `estimatedValueCop`, cuyo rango válido INCLUYE el cero, eso sería un
 * desastre silencioso. `valueAsNumber` entrega `NaN` y `z.number()` lo
 * rechaza, que es la distinción que importa.
 */
export function createRewardFormSchema(t: TFunction<'rewards'>) {
  const requiredNumber = {
    required_error: t('createForm.validation.required'),
    invalid_type_error: t('createForm.validation.number'),
  }

  return z.object({
    title: z.string().min(1, t('createForm.validation.required')),
    description: z.string().min(1, t('createForm.validation.required')),
    geoPointsCost: z
      .number(requiredNumber)
      .int(t('createForm.validation.number'))
      .positive(t('createForm.validation.geoPointsPositive')),
    estimatedValueCop: z
      .number(requiredNumber)
      .nonnegative(t('createForm.validation.valueNotNegative')),
    placeId: z.string(),
    stockTotal: z
      .union([z.number().int().positive(t('createForm.validation.stockPositive')), z.nan()])
      .transform((value) => (Number.isNaN(value) ? null : (value as number)))
      .nullable(),
  })
}

/**
 * `z.input<...>` y no `z.infer<...>`: el `.transform()` de `stockTotal` hace
 * que el tipo de ENTRADA (lo que el formulario maneja) difiera del de salida.
 */
export type RewardFormValues = z.input<ReturnType<typeof createRewardFormSchema>>
