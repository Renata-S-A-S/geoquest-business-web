/**
 * Puerto de subida de archivos — issue #14 (plan Paso 2), mismo patrón que
 * `SessionPort`: el resto de la app (dropzone, formularios de B-01/B-02/B-03)
 * programa CONTRA ESTA INTERFAZ, nunca contra un mecanismo concreto.
 *
 * ⚠️ La única implementación de este slice es `mockUploader` — para tests
 * unitarios/Storybook y para desarrollar la UI en aislamiento, NUNCA como
 * sustituto de la integración real. Derek rechazó explícitamente el atajo
 * de cerrar #14/#22/#26/#31 contra un `Uploader` mock como si fuera la
 * implementación final (BL-014, 2 sep 2026): esas 4 tareas siguen
 * bloqueadas hasta que exista el backend real de subida de archivos
 * (✅ ADR-048). Este archivo, `uploader.mock.ts` y el componente de
 * dropzone (`file-dropzone.tsx`) son trabajo de base que no depende de esa
 * decisión — nada acá se conecta a un flujo real todavía.
 */
export interface UploadResult {
  url: string
}

export interface Uploader {
  /** Sube `file` y resuelve con la URL resultante. Rechaza en caso de error — el caller decide cómo mostrarlo (ver `UploadState`). */
  upload(file: File): Promise<UploadResult>
}
