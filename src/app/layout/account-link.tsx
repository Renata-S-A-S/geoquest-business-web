import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/shared/components/ui/avatar'

/**
 * Trigger de cuenta — pieza de shell-chrome montada dos veces (pie de
 * `SidebarNav` y `MobileTopBar`) para que la configuración sea alcanzable en
 * cualquier viewport sin sumar un ítem a `BottomNav` (issue #70).
 *
 * ⚠️ **Reemplaza al `AccountMenu` anterior, y revierte una decisión suya a
 * pedido de Derek (24 sep 2026).**
 *
 * Antes esto abría un modal con un link a `/configuracion` y el botón de
 * cerrar sesión. Llegar a cerrar sesión costaba dos clics y una decisión
 * intermedia: abrir el menú y recién ahí elegir. Y el modal no aportaba nada
 * propio — era una lista de dos ítems, uno de los cuales llevaba a una
 * pantalla que podía contener al otro.
 *
 * Ahora el avatar navega directo a `/configuracion`, y cerrar sesión vive
 * allá. Eso también deja un solo lugar donde se agregan cosas de cuenta, en
 * vez de repartirlas entre un menú y una pantalla.
 *
 * El comentario de `settings-page.tsx` decía explícitamente que "el logout NO
 * vive acá… sigue existiendo una única superficie de cierre de sesión, en
 * `AccountMenu`" (decisión de #70). Esa decisión queda superada; sigue
 * habiendo una única superficie, solo que es la otra.
 *
 * El avatar muestra una inicial estática ("N" de "Negocio"): el shell no hace
 * fetch de identidad (decisión #4 de #70). Cuando exista el endpoint de
 * identidad del staff (`Renata-S-A-S/geoquest#203`) puede suscribirse
 * cache-only sin request extra.
 */
export function AccountLink() {
  const { t } = useTranslation()

  return (
    <Link to="/configuracion" aria-label={t('account.open')} className="inline-flex">
      <Avatar initial="N" />
    </Link>
  )
}
