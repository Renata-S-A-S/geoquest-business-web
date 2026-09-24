import { describe, expect, it } from 'vitest'
import {
  Category,
  Subcategory,
  SUBCATEGORIES_BY_CATEGORY,
  categorySchema,
  subcategorySchema,
  isValidTaxonomy,
  categoriesInOrder,
  subcategoriesOf,
} from './taxonomy'

/**
 * Esta taxonomía NO es una propuesta del frontend: está copiada del enum
 * real del backend (`SharedKernel/Domain/Taxonomy/`, RN-TAX-01), que la
 * valida server-side y rechaza con `Place.InvalidTaxonomy`. Por eso los
 * tests fijan los valores numéricos exactos — si alguien los reordena, el
 * portal empieza a mandar la categoría equivocada sin que nada falle
 * visiblemente.
 */
describe('Category', () => {
  it('mantiene los valores numéricos exactos del backend', () => {
    expect(Category.Gastronomia).toBe(0)
    expect(Category.Naturaleza).toBe(1)
    expect(Category.HistoriaCultura).toBe(2)
    expect(Category.Aventura).toBe(3)
    expect(Category.Arte).toBe(4)
    expect(Category.Alojamiento).toBe(5)
  })

  it('tiene exactamente 6 categorías', () => {
    expect(categoriesInOrder).toHaveLength(6)
  })

  it('acepta un entero válido y rechaza uno fuera del enum', () => {
    expect(categorySchema.parse(0)).toBe(Category.Gastronomia)
    expect(categorySchema.safeParse(6).success).toBe(false)
    expect(categorySchema.safeParse(-1).success).toBe(false)
  })

  it('rechaza el slug de texto que usaba el portal antes de alinearse', () => {
    expect(categorySchema.safeParse('gastronomia').success).toBe(false)
  })
})

describe('Subcategory', () => {
  it('mantiene los valores numéricos exactos del backend', () => {
    expect(Subcategory.Restaurant).toBe(0)
    expect(Subcategory.Beach).toBe(7)
    expect(Subcategory.CulturalCenter).toBe(11)
    expect(Subcategory.Sports).toBe(14)
    expect(Subcategory.PublicArt).toBe(17)
    expect(Subcategory.Hostel).toBe(19)
  })

  it('acepta 0..19 y rechaza 20', () => {
    expect(subcategorySchema.parse(19)).toBe(Subcategory.Hostel)
    expect(subcategorySchema.safeParse(20).success).toBe(false)
  })
})

describe('SUBCATEGORIES_BY_CATEGORY', () => {
  it('cubre las 6 categorías', () => {
    expect(Object.keys(SUBCATEGORIES_BY_CATEGORY)).toHaveLength(6)
  })

  it('asigna las 20 subcategorías sin dejar ninguna huérfana', () => {
    const assigned = categoriesInOrder.flatMap((category) => subcategoriesOf(category))
    expect(assigned).toHaveLength(20)
  })

  it('no asigna la misma subcategoría a dos categorías', () => {
    const assigned = categoriesInOrder.flatMap((category) => subcategoriesOf(category))
    expect(new Set(assigned).size).toBe(assigned.length)
  })

  it('respeta el agrupamiento del backend', () => {
    expect(subcategoriesOf(Category.Gastronomia)).toEqual([
      Subcategory.Restaurant,
      Subcategory.Cafe,
      Subcategory.Bar,
      Subcategory.FoodMarket,
    ])
    expect(subcategoriesOf(Category.Alojamiento)).toEqual([Subcategory.Hotel, Subcategory.Hostel])
  })
})

/**
 * `isValidTaxonomy` replica `TaxonomyRules.IsValid` del backend. Existe
 * para poder rechazar la combinación en el formulario, ANTES de gastar un
 * request que el servidor iba a contestar con 400 `Place.InvalidTaxonomy`.
 * No la reemplaza: el servidor sigue siendo la autoridad.
 */
describe('isValidTaxonomy', () => {
  it('acepta una subcategoría que pertenece a su categoría', () => {
    expect(isValidTaxonomy(Category.Gastronomia, Subcategory.Cafe)).toBe(true)
  })

  it('rechaza una subcategoría de otra categoría', () => {
    expect(isValidTaxonomy(Category.Gastronomia, Subcategory.Hotel)).toBe(false)
  })

  it('rechaza cualquier cruce entre categorías distintas', () => {
    const crossed = categoriesInOrder.flatMap((category) =>
      categoriesInOrder
        .filter((other) => other !== category)
        .flatMap((other) =>
          subcategoriesOf(other).map((subcategory) => isValidTaxonomy(category, subcategory))
        )
    )

    expect(crossed.every((valid) => valid === false)).toBe(true)
  })

  it('acepta todas las combinaciones legítimas', () => {
    const own = categoriesInOrder.flatMap((category) =>
      subcategoriesOf(category).map((subcategory) => isValidTaxonomy(category, subcategory))
    )

    expect(own.every((valid) => valid === true)).toBe(true)
    expect(own).toHaveLength(20)
  })
})
