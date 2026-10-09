import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('names the member in the image alt text', () => {
    render(<Avatar member={{ id: 'x1', displayName: 'Rosa Prieto', avatarUrl: '/avatars/rosa.png' }} />)
    expect(screen.getByRole('img', { name: 'Foto de Rosa Prieto' })).toBeInTheDocument()
  })

  it('shows decorative initials when there is no image', () => {
    const { container } = render(<Avatar member={{ id: 'x2', displayName: 'Rosa Prieto', avatarUrl: null }} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container).toHaveTextContent('RP')
  })
})
