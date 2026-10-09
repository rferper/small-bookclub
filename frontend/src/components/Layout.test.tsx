import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState } from '../api/mock/fixtures'
import { createMockClient } from '../api/mock/mockClient'
import { renderApp } from '../test/renderApp'

const MEMBER_LINKS = ['Inicio', 'Biblioteca', 'Reuniones', 'Votaciones', 'Estadísticas', 'Miembros', 'Mi perfil']

describe('Layout', () => {
  it('shows every section, plus Administración for the admin', async () => {
    renderApp()

    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(await within(nav).findByRole('link', { name: 'Administración' })).toBeInTheDocument()
    for (const name of MEMBER_LINKS) expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
  })

  it('does not show Administración to a member', async () => {
    const state = createClubState()
    state.currentUserId = 'm2'
    renderApp({ client: createMockClient({ state }) })

    await screen.findByRole('heading', { name: 'La Regenta' })
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument()
  })

  it('opens and closes the mobile menu', async () => {
    const user = userEvent.setup()
    renderApp()

    const button = screen.getByRole('button', { name: 'Menú' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('link', { name: 'Biblioteca' }))
    expect(screen.getByRole('button', { name: 'Menú' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
  })

  it('shows a friendly page for unknown addresses', () => {
    renderApp({ path: '/no-existe' })
    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
  })
})
