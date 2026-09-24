import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SEED_BUSINESS } from '@/shared/mocks/seed'
import type { Business } from '@/shared/schemas/business'
import { BusinessProfileView } from './business-profile-view'

function renderView(business: Business) {
  return render(<BusinessProfileView business={business} />)
}

const LEGAL_FROZEN_HINT =
  'No editable: se verificó contra tu documento legal antes de activar el negocio.'

describe('BusinessProfileView', () => {
  it('muestra los campos de identidad (editables en una PR futura) sin ningún candado ni hint de bloqueo', () => {
    renderView(SEED_BUSINESS)

    expect(screen.getByText(SEED_BUSINESS.displayName)).toBeInTheDocument()
    expect(screen.getByText(SEED_BUSINESS.category)).toBeInTheDocument()
    expect(screen.getByText(SEED_BUSINESS.email)).toBeInTheDocument()

    // Los campos de identidad no llevan el hint de congelamiento — esa es
    // la distinción visual entre "aún sin botón de editar" y "congelado
    // por política" que exige el issue #72. Se verifica dentro del
    // contenedor del propio campo, porque el hint sí existe en otra parte
    // de la pantalla (los campos legales).
    const displayNameField = screen.getByText(SEED_BUSINESS.displayName).closest('div')
    expect(displayNameField).not.toBeNull()
    expect(within(displayNameField!).queryByText(LEGAL_FROZEN_HINT)).not.toBeInTheDocument()
  })

  it('marca legalName, legalDocumentType y legalDocumentNumber con el hint de congelamiento, exactamente una vez cada uno', () => {
    renderView(SEED_BUSINESS)

    expect(screen.getByText(SEED_BUSINESS.legalName)).toBeInTheDocument()
    expect(screen.getByText(SEED_BUSINESS.legalDocumentType)).toBeInTheDocument()
    expect(screen.getByText(SEED_BUSINESS.legalDocumentNumber)).toBeInTheDocument()
    expect(screen.getAllByText(LEGAL_FROZEN_HINT)).toHaveLength(3)
  })

  it('muestra isInformalBusiness como solo-lectura pero SIN el hint de congelamiento (no es una restricción de RN-BIZ-01)', () => {
    renderView(SEED_BUSINESS)

    // SEED_BUSINESS.isInformalBusiness es `false` → "No"
    expect(screen.getByText('Negocio informal')).toBeInTheDocument()
    expect(screen.getAllByText(LEGAL_FROZEN_HINT)).toHaveLength(3)
  })

  it('renderiza status y trustStatus con StatusBadge, y el resto de los campos de plataforma como solo-lectura', () => {
    renderView(SEED_BUSINESS)

    const badges = screen.getAllByRole('status')
    const badgeText = badges.map((badge) => badge.textContent)
    expect(badgeText).toContain('Activo') // status: 'Active'
    expect(badgeText).toContain('Premium') // trustStatus: 'Premium'
    expect(badgeText).toContain('Verificado') // isGoogleMapsVerified: true

    expect(screen.getByText('12')).toBeInTheDocument() // totalRedemptions
    expect(screen.getByText('0')).toBeInTheDocument() // totalReports
  })

  it('muestra "Sin firmar" cuando commercialAgreementSignedAt es null, en vez de fallar al formatear una fecha', () => {
    const businessWithoutAgreement: Business = {
      ...SEED_BUSINESS,
      commercialAgreementSignedAt: null,
    }

    renderView(businessWithoutAgreement)

    expect(screen.getByText('Sin firmar')).toBeInTheDocument()
  })

  it('marca isGoogleMapsVerified como "No verificado" cuando el negocio no está verificado en Google Maps', () => {
    const unverifiedBusiness: Business = {
      ...SEED_BUSINESS,
      isGoogleMapsVerified: false,
      googleMapsPlaceId: null,
    }

    renderView(unverifiedBusiness)

    const badges = screen.getAllByRole('status')
    expect(badges.map((badge) => badge.textContent)).toContain('No verificado')
  })

  it('nunca renderiza id, isPlatformOwned ni el googleMapsPlaceId crudo (identificadores internos, no contenido de usuario)', () => {
    renderView(SEED_BUSINESS)

    expect(screen.queryByText(SEED_BUSINESS.id)).not.toBeInTheDocument()
    expect(screen.queryByText(SEED_BUSINESS.googleMapsPlaceId ?? '')).not.toBeInTheDocument()
  })
})
