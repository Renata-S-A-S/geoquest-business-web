/**
 * Storage detrás de una interfaz — NO usar `localStorage` directo en los
 * handlers de MSW. `localStorage` no existe en el proyecto Vitest 'node'
 * (usado por session-interceptor.test.ts, schemas, etc.) y SÍ existe tanto
 * en el navegador real como en jsdom — mezclar ambos casos sin abstracción
 * es la fuente típica de tests que rompen o arrastran estado entre sí
 * (ver plan-geoquest-business-web.md, Paso 3.3).
 */
export interface MockStorage {
  get<T>(key: string): T | null
  set<T>(key: string, value: T): void
  clear(key: string): void
}

class LocalStorageAdapter implements MockStorage {
  get<T>(key: string): T | null {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }
  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value))
  }
  clear(key: string): void {
    localStorage.removeItem(key)
  }
}

class MemoryStorageAdapter implements MockStorage {
  private store = new Map<string, unknown>()
  get<T>(key: string): T | null {
    return this.store.has(key) ? (this.store.get(key) as T) : null
  }
  set<T>(key: string, value: T): void {
    this.store.set(key, value)
  }
  clear(key: string): void {
    this.store.delete(key)
  }
}

/**
 * Singleton del fallback en memoria — igual que `localStorage` real (que
 * es un único store compartido por todo el proceso), TODAS las llamadas a
 * `createMockStorage()` en un entorno sin DOM deben ver el MISMO store. Si
 * cada llamada creara un adapter nuevo y vacío, `db.ts` (que llama
 * `createMockStorage()` de nuevo en cada `readDb()`/`writeDb()`) nunca
 * persistiría nada entre un POST y el siguiente GET dentro del mismo test.
 */
let memorySingleton: MemoryStorageAdapter | null = null

/**
 * `localStorage` existe como global tanto en el navegador real como en
 * jsdom (el entorno de los tests `*.dom.test.tsx`) — typeof lo detecta sin
 * necesitar una variable de entorno. Solo el proyecto Vitest 'node' cae al
 * adapter en memoria.
 */
export function createMockStorage(): MockStorage {
  if (typeof localStorage !== 'undefined') return new LocalStorageAdapter()
  memorySingleton ??= new MemoryStorageAdapter()
  return memorySingleton
}

/** Seam de test: limpia el fallback en memoria compartido entre casos (proyecto 'node'). */
export function __resetMemoryStorage(): void {
  memorySingleton = null
}
