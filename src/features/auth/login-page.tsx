/**
 * Placeholder — B-01 (registro/verificación) y el login real de
 * BusinessStaff no se implementan en este scaffold. El mecanismo de auth es
 * una decisión abierta para Derek (ver contratos-portal-b2b.md); esta
 * pantalla existe solo para que ProtectedRoute tenga a dónde redirigir.
 */
export function LoginPage() {
  return (
    <div className="flex h-dvh items-center justify-center bg-cream">
      <div className="rounded-md border border-border bg-white px-6 py-5 text-center">
        <h1 className="font-display text-lg font-bold text-ink">GeoQuest — Portal de Negocios</h1>
        <p className="mt-2 font-sans text-sm text-muted">
          Login pendiente — mecanismo de auth de BusinessStaff sin definir todavía.
        </p>
      </div>
    </div>
  )
}
