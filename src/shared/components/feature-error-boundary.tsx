import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/shared/components/ui/button'

interface Props {
  children: ReactNode
  /** Nombre de la feature, para el mensaje y para diferenciar boundaries en tests. */
  featureName: string
}

interface State {
  error: Error | null
}

/**
 * Error boundary por feature — un error en "Recompensas" no debería tumbar
 * el sidebar ni el resto del portal. geoquest-web documenta este patrón en
 * Confluence pero no lo tiene implementado todavía (verificado por grep,
 * 29 ago 2026); esta es la primera implementación real en el proyecto.
 */
export class FeatureErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.featureName}]`, error, info.componentStack)
  }

  private reset = (): void => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-md bg-surface-alert p-6 text-center">
          <p className="font-sans text-sm text-ink">Algo salió mal en {this.props.featureName}.</p>
          <Button variant="secondary" onClick={this.reset}>
            Reintentar
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
