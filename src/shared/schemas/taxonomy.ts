import { z } from 'zod'

/**
 * Taxonomía única de `Place` (RN-TAX-01).
 *
 * ⚠️ Esto NO es una propuesta del frontend: está copiado literalmente del
 * backend ya desplegado (`GeoQuest.SharedKernel/Domain/Taxonomy/Category.cs`
 * y `Subcategory.cs`). Los valores numéricos son el contrato: **viajan como
 * enteros**, no como texto, porque el host no registra ningún
 * `JsonStringEnumConverter` — verificado en `GeoQuest.Api/`.
 *
 * Reemplaza a `BUSINESS_CATEGORY_OPTIONS`, que proponía una lista inventada
 * (`entretenimiento`, `compras`, `servicios`, `otro`) cuyos valores **no
 * existen** en el backend. Ese archivo advertía de sí mismo que la
 * taxonomía no estaba confirmada en Confluence; sí lo estaba, solo que en
 * código y no en el wiki.
 *
 * El mismo enum aplica a `Business.category` según la documentación de
 * `Category.cs` ("onboarding, filtros de mapa, pines, `Explorer.interests[]`
 * y `Business.category`").
 */
export enum Category {
  Gastronomia = 0,
  Naturaleza = 1,
  HistoriaCultura = 2,
  Aventura = 3,
  Arte = 4,
  Alojamiento = 5,
}

export enum Subcategory {
  // Category.Gastronomia
  Restaurant = 0,
  Cafe = 1,
  Bar = 2,
  FoodMarket = 3,

  // Category.Naturaleza
  Park = 4,
  Viewpoint = 5,
  Trail = 6,
  Beach = 7,

  // Category.HistoriaCultura
  Museum = 8,
  Monument = 9,
  HistoricSite = 10,
  CulturalCenter = 11,

  // Category.Aventura
  AdventureActivity = 12,
  CableCar = 13,
  Sports = 14,

  // Category.Arte
  StreetArt = 15,
  Gallery = 16,
  PublicArt = 17,

  // Category.Alojamiento
  Hotel = 18,
  Hostel = 19,
}

export const categorySchema = z.nativeEnum(Category)
export const subcategorySchema = z.nativeEnum(Subcategory)

/**
 * Mapa padre-hijo, espejo de `TaxonomyRules.SubcategoriesByCategory`. El
 * orden de cada lista es el del backend a propósito: es el que se usa para
 * poblar el `Select` del formulario, así que mantenerlo evita que la UI
 * ordene distinto que el resto del producto.
 */
export const SUBCATEGORIES_BY_CATEGORY: Readonly<Record<Category, readonly Subcategory[]>> = {
  [Category.Gastronomia]: [
    Subcategory.Restaurant,
    Subcategory.Cafe,
    Subcategory.Bar,
    Subcategory.FoodMarket,
  ],
  [Category.Naturaleza]: [
    Subcategory.Park,
    Subcategory.Viewpoint,
    Subcategory.Trail,
    Subcategory.Beach,
  ],
  [Category.HistoriaCultura]: [
    Subcategory.Museum,
    Subcategory.Monument,
    Subcategory.HistoricSite,
    Subcategory.CulturalCenter,
  ],
  [Category.Aventura]: [Subcategory.AdventureActivity, Subcategory.CableCar, Subcategory.Sports],
  [Category.Arte]: [Subcategory.StreetArt, Subcategory.Gallery, Subcategory.PublicArt],
  [Category.Alojamiento]: [Subcategory.Hotel, Subcategory.Hostel],
} as const

/** Las 6 categorías en el orden del enum — para poblar selects sin reordenar. */
export const categoriesInOrder: readonly Category[] = [
  Category.Gastronomia,
  Category.Naturaleza,
  Category.HistoriaCultura,
  Category.Aventura,
  Category.Arte,
  Category.Alojamiento,
]

export function subcategoriesOf(category: Category): readonly Subcategory[] {
  return SUBCATEGORIES_BY_CATEGORY[category]
}

/**
 * Réplica de `TaxonomyRules.IsValid` del backend.
 *
 * Existe para rechazar la combinación en el formulario ANTES de gastar un
 * request que el servidor iba a contestar con 400 `Place.InvalidTaxonomy`.
 * **No reemplaza la validación server-side** — el backend sigue siendo la
 * autoridad, y esta copia solo evita el viaje de ida y vuelta.
 */
export function isValidTaxonomy(category: Category, subcategory: Subcategory): boolean {
  return SUBCATEGORIES_BY_CATEGORY[category].includes(subcategory)
}
