import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guardia de regresión para la migración a tokens de Tailwind v4 (design
 * decisión D-5): todo color debe fluir por un token `--color-*`, nunca por
 * un literal hex, una función de color funcional, o una utilidad cruda de
 * la paleta de Tailwind.
 *
 * Las definiciones de regex son verbatim de la sección D-5 del artefacto de
 * diseño (`sdd/theme-light-dark/design`, decisión D-5).
 */
const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/
const FUNCTIONAL_COLOR = /\b(?:rgba?|hsla?)\(/
const WHITE_BLACK_UTILITY =
  /\b(?:bg|text|border|fill|stroke|ring|divide|shadow|outline|decoration|accent|caret|from|via|to|placeholder)-(?:white|black)(?:\/\d+)?\b/
const RAW_PALETTE_UTILITY =
  /\b(?:bg|text|border|fill|stroke|ring|divide|shadow|outline|decoration|accent|caret|from|via|to|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\b/

const VIOLATION_PATTERNS: Record<string, RegExp> = {
  HEX_LITERAL,
  FUNCTIONAL_COLOR,
  WHITE_BLACK_UTILITY,
  RAW_PALETTE_UTILITY,
}

/**
 * Documenta cualquier excepción deliberada, indexada por ruta relativa a
 * `src/`. El diseño (D-5) esperaba que esta lista quedara vacía en PR2:
 * después del sweep de PR1 no queda ninguna violación genuina, y
 * `shared/lib/theme.ts` (que sí necesitará `THEME_COLOR_META` en hex
 * literal para el atributo `<meta name="theme-color">`) recién se crea en
 * PR3a. Verificado por grep sobre todo `src/**\/*.{ts,tsx}` antes de
 * escribir este test: cero coincidencias fuera de archivos de test.
 *
 * Una futura excepción genuina debe agregarse acá con una razón escrita,
 * nunca excluirse en silencio vía regex.
 */
const ALLOWED_HARDCODED_COLORS: Record<string, string> = {}

interface Violation {
  path: string
  line: number
  match: string
  rule: string
}

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true })
  const files: string[] = []

  for (const entry of entries) {
    if (!entry.isFile()) continue

    const parentPath = (entry as { parentPath?: string; path?: string }).parentPath ?? entry.path
    const relativeParent = parentPath.split(/[\\/]src[\\/]?/).pop() ?? ''
    const relativePath = relativeParent
      ? join(relativeParent, entry.name).replace(/\\/g, '/')
      : entry.name

    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue
    if (entry.name.endsWith('.d.ts')) continue
    if (relativePath.startsWith('test/')) continue

    files.push(relativePath)
  }

  return files
}

/**
 * `//` solo abre un comentario cuando no es parte de un esquema `://`, así
 * que una URL como `http://localhost:9000/...` conserva su contenido.
 */
function findLineCommentStart(line: string, from: number): number {
  let at = line.indexOf('//', from)
  while (at > 0 && line[at - 1] === ':') {
    at = line.indexOf('//', at + 2)
  }
  return at
}

/**
 * Vacía el contenido de comentarios antes de escanear, preservando la
 * cantidad de líneas para que los números de línea reportados sigan
 * apuntando a la línea real del código fuente.
 *
 * Un comentario no puede renderizar un color, así que un hex dentro de uno
 * nunca es una violación real. Una referencia a un issue como `#70` son
 * tres dígitos hex válidos, y este repo cita issues en comentarios de forma
 * constante (`(#70)`, `issue #28`, `ver #16`) — sin este strip el guard
 * fallaría contra sus propios comentarios, y reescribirlos no escala.
 */
export function stripComments(lines: string[]): string[] {
  let inBlock = false

  return lines.map((line) => {
    let kept = ''
    let index = 0

    while (index < line.length) {
      if (inBlock) {
        const close = line.indexOf('*/', index)
        if (close === -1) return kept
        inBlock = false
        index = close + 2
        continue
      }

      const blockOpen = line.indexOf('/*', index)
      const lineOpen = findLineCommentStart(line, index)
      const next = Math.min(
        blockOpen === -1 ? Number.POSITIVE_INFINITY : blockOpen,
        lineOpen === -1 ? Number.POSITIVE_INFINITY : lineOpen
      )

      if (next === Number.POSITIVE_INFINITY) {
        return kept + line.slice(index)
      }

      kept += line.slice(index, next)
      if (next === lineOpen) return kept

      inBlock = true
      index = next + 2
    }

    return kept
  })
}

function scanFile(srcDir: string, relativePath: string): Violation[] {
  const content = readFileSync(join(srcDir, relativePath), 'utf-8')
  const lines = stripComments(content.split('\n'))
  const violations: Violation[] = []

  lines.forEach((line, index) => {
    for (const [rule, pattern] of Object.entries(VIOLATION_PATTERNS)) {
      const match = line.match(pattern)
      if (match) {
        violations.push({ path: relativePath, line: index + 1, match: match[0], rule })
      }
    }
  })

  return violations
}

const srcDir = join(process.cwd(), 'src')
const sourceFiles = collectSourceFiles(srcDir)

const allViolations = sourceFiles.flatMap((path) => scanFile(srcDir, path))

const unallowedViolations = allViolations.filter(
  (violation) => !(violation.path in ALLOWED_HARDCODED_COLORS)
)

describe('stripComments', () => {
  it('vacía una referencia a un issue dentro de un comentario de bloque', () => {
    const lines = ['/**', ' * Copy de borrado, ver issue #70 para la razón.', ' */', 'const a = 1']

    expect(stripComments(lines).join(' ')).not.toContain('#70')
  })

  it('conserva un literal hex que es código real', () => {
    const lines = ["export const paper = '#F6F3EC'"]

    expect(stripComments(lines)[0]).toContain('#F6F3EC')
  })

  it('no trata el // de un esquema de URL como un comentario', () => {
    const lines = ["const seed = 'http://localhost:9000/geoquest/#F6F3EC.jpg'"]

    expect(stripComments(lines)[0]).toContain('#F6F3EC')
  })

  it('vacía un comentario de línea al final pero conserva el código previo', () => {
    const lines = ["const paper = '#F6F3EC' // fallback #70"]
    const [stripped] = stripComments(lines)

    expect(stripped).toContain('#F6F3EC')
    expect(stripped).not.toContain('#70')
  })

  it('conserva el código que sigue al cierre de un comentario de bloque en la misma línea', () => {
    const lines = ["/* ver #70 */ const ink = '#0A1618'"]
    const [stripped] = stripComments(lines)

    expect(stripped).not.toContain('#70')
    expect(stripped).toContain('#0A1618')
  })

  it('preserva la cantidad de líneas para que los números reportados sigan siendo correctos', () => {
    const lines = ['/**', ' * #70', ' */', 'const a = 1']

    expect(stripComments(lines)).toHaveLength(4)
  })
})

describe('no-hardcoded-colors static scan', () => {
  /**
   * Centinela. Un escaneo estático que silenciosamente deja de encontrar
   * archivos pasaría para siempre sin guardar nada — `flatMap` sobre una
   * lista vacía no produce violaciones, y "sin violaciones" es exactamente
   * lo que esta suite asegura.
   *
   * El test de entradas obsoletas de abajo no es un sustituto: solo muerde
   * mientras `ALLOWED_HARDCODED_COLORS` tenga alguna entrada viva, y hoy
   * está vacía. El ancla acá es deliberadamente un archivo estructural en
   * vez de uno de la allow-list, para que quitar una entrada no pueda
   * desarmar el centinela.
   */
  it('efectivamente escanea los archivos fuente', () => {
    expect(sourceFiles.length).toBeGreaterThan(0)
    expect(sourceFiles).toContain('app/routes.tsx')
  })

  it('no encuentra hex, color funcional ni utilidad de paleta cruda fuera de la allow-list', () => {
    const message = unallowedViolations
      .map((v) => `${v.path}:${v.line} [${v.rule}] matched "${v.match}"`)
      .join('\n')

    expect(unallowedViolations, message).toHaveLength(0)
  })

  it('no tiene ninguna entrada obsoleta en la allow-list (cada entrada debe seguir siendo una violación genuina)', () => {
    const violatingPaths = new Set(allViolations.map((v) => v.path))
    const staleEntries = Object.keys(ALLOWED_HARDCODED_COLORS).filter(
      (path) => !violatingPaths.has(path)
    )

    expect(
      staleEntries,
      `Entradas obsoletas de la allow-list (ya no violan): ${staleEntries.join(', ')}`
    ).toHaveLength(0)
  })
})
