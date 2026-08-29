import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

/**
 * Bootstrap mínimo de WU0 — reemplazado en WU3 (app shell + router +
 * providers). Ver plan-geoquest-business-web.md.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      GeoQuest — Portal de Negocios (scaffold WU0, sin app shell todavía)
    </div>
  </StrictMode>
)
