import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './avatar'

describe('Avatar', () => {
  it('renders the initial as its content', () => {
    render(<Avatar initial="N" />)
    expect(screen.getByText('N')).toBeInTheDocument()
  })

  it('defaults to size md', () => {
    render(<Avatar initial="N" />)
    expect(screen.getByText('N')).toHaveClass('h-[38px]', 'w-[38px]')
  })

  it('maps size sm to its class', () => {
    render(<Avatar initial="N" size="sm" />)
    expect(screen.getByText('N')).toHaveClass('h-[30px]', 'w-[30px]')
  })

  it('maps size lg to its class', () => {
    render(<Avatar initial="N" size="lg" />)
    expect(screen.getByText('N')).toHaveClass('h-14', 'w-14')
  })

  it('merges a custom className with the default styles', () => {
    render(<Avatar initial="N" className="custom-class" />)
    expect(screen.getByText('N')).toHaveClass('custom-class')
  })

  it('renders an img with the given src and alt when src is provided', () => {
    render(<Avatar initial="N" src="https://example.com/logo.png" alt="Negocio Demo" />)
    const img = screen.getByRole('img', { name: 'Negocio Demo' })
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png')
    expect(screen.queryByText('N')).not.toBeInTheDocument()
  })

  it('falls back to the initial when src is null', () => {
    render(<Avatar initial="N" src={null} />)
    expect(screen.getByText('N')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
