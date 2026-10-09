import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState } from '../api/mock/fixtures'
import { createMockClient } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

const MEMBER_LINKS = ['Inicio', 'Biblioteca', 'Reuniones', 'Votaciones', 'Estadísticas', 'Miembros', 'Mi perfil']

describe('Layout', () => {
  it('shows every section, plus Administración for the admin', async () => {
    renderApp()

    const nav = await screen.findByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Administración' })).toBeInTheDocument()
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

    const button = await screen.findByRole('button', { name: 'Menú' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('link', { name: 'Biblioteca' }))
    expect(screen.getByRole('button', { name: 'Menú' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
  })

  it('shows a friendly page for unknown addresses', async () => {
    renderApp({ path: '/no-existe' })
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
  })
})

describe('signing out', () => {
  it('keeps «Cerrar sesión» inside the collapsible menu', async () => {
    renderApp()

    const button = await screen.findByRole('button', { name: 'Cerrar sesión' })
    expect(document.getElementById('menu-principal')).toContainElement(button)
    expect(screen.getByRole('button', { name: 'Menú' })).toHaveAttribute('aria-controls', 'menu-principal')
  })

  it('signs out to the sign-in screen with a goodbye, and can sign in again', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient({ random: () => 0 }), 'signOut')
    const tracked = trackCalls(held.client)
    renderApp({ client: tracked.client })

    await screen.findByRole('heading', { name: 'La Regenta' })
    const button = screen.getByRole('button', { name: 'Cerrar sesión' })
    await user.click(button)
    expect(button).toBeDisabled()
    await user.click(button)
    held.release()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Club de Lectura' })
    expect(screen.getByRole('status')).toHaveTextContent('Has cerrado sesión. ¡Hasta pronto!')
    expect(heading).toHaveFocus()
    expectNoClubContent()
    expect(tracked.calls.filter((method) => method === 'signOut')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Entrar con Discord' }))
    expect(await screen.findByRole('heading', { name: 'La Regenta' })).toBeInTheDocument()
    expect(screen.queryByText('Has cerrado sesión. ¡Hasta pronto!')).not.toBeInTheDocument()
  })

  it('works with the keyboard', async () => {
    const user = userEvent.setup()
    renderApp()

    const button = await screen.findByRole('button', { name: 'Cerrar sesión' })
    button.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Has cerrado sesión. ¡Hasta pronto!')).toBeInTheDocument()
  })

  it('stays signed in on the same page and says so when signing out fails', async () => {
    const user = userEvent.setup()
    renderApp({ client: createMockClient({ random: () => 0, failures: { signOut: 1 } }) })

    await screen.findByRole('heading', { name: 'La Regenta' })
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se ha podido cerrar la sesión. Inténtalo de nuevo.')
    expect(alert).not.toHaveTextContent('Error simulado')
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'La Regenta' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeEnabled()
    expect(screen.queryByText(/Has cerrado sesión/)).not.toBeInTheDocument()
  })
})
