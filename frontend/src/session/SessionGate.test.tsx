import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState } from '../api/mock/fixtures'
import { createMockClient } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

const PATHS = ['/', '/biblioteca', '/administracion', '/no-existe']

describe('session gate', () => {
  it('shows only a loading message while the session is loading, without asking for club data', async () => {
    const held = holdCalls(createMockClient({ random: () => 0 }), 'getSession')
    const tracked = trackCalls(held.client)
    renderApp({ client: tracked.client })

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    expectNoClubContent()
    expect(tracked.clubDataCalls()).toEqual([])

    held.release()
    expect(await screen.findByRole('heading', { name: 'La Regenta' })).toBeInTheDocument()
  })

  it.each(PATHS)('shows the sign-in screen at %s to an anonymous visitor, without club data or calls', async (path) => {
    const tracked = trackCalls(createMockClient({ session: 'anonymous', failures: { getHome: Infinity } }))
    const { router } = renderApp({ path, client: tracked.client })

    expect(await screen.findByRole('heading', { level: 1, name: 'Club de Lectura' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // A fresh visit has no signed-out message.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
    expect(tracked.clubDataCalls()).toEqual([])
  })

  it.each(PATHS)('shows the access-denied page at %s to a refused account, without club data or calls', async (path) => {
    const tracked = trackCalls(createMockClient({ session: 'denied', failures: { getHome: Infinity } }))
    const { router } = renderApp({ path, client: tracked.client })

    expect(await screen.findByRole('heading', { level: 1, name: 'Esta cuenta no tiene acceso al club' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
    expect(tracked.clubDataCalls()).toEqual([])
  })

  it('shows the shell without Administración to a member', async () => {
    renderApp({ client: createMockClient({ session: 'member', random: () => 0 }) })

    const nav = await screen.findByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Inicio' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'La Regenta' })).toBeInTheDocument()
  })

  it('shows Administración to an admin', async () => {
    renderApp({ client: createMockClient({ session: 'admin', random: () => 0 }) })

    const nav = await screen.findByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Administración' })).toBeInTheDocument()
  })

  it('offers a retry when the session cannot be loaded', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient({ session: 'anonymous', failures: { getSession: 1 } }))
    renderApp({ client: tracked.client })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No hemos podido conectar con el club. Inténtalo de nuevo en un momento.')
    expect(alert).not.toHaveTextContent('Error simulado')
    expectNoClubContent()

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expect(tracked.calls.filter((method) => method === 'getSession')).toHaveLength(2)
    // The new screen takes focus, not the removed retry button.
    expect(screen.getByRole('heading', { level: 1, name: 'Club de Lectura' })).toHaveFocus()
  })

  it('returns to the sign-in screen when a club-data call gets a 401', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    const tracked = trackCalls(createMockClient({ state, random: () => 0 }))
    renderApp({ client: tracked.client })

    await screen.findByRole('heading', { name: 'La Regenta' })
    state.session = 'anonymous'
    await user.click(screen.getByRole('button', { name: 'Marcar como leído' }))

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText(/No se ha podido/)).not.toBeInTheDocument()
    expect(tracked.calls.filter((method) => method === 'getSession')).toHaveLength(2)
    expect(state.completions.w3).toEqual(['m3', 'm6'])
  })

  it('shows the access-denied page when a revoked member reloads Inicio', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    renderApp({ client: createMockClient({ state, random: () => 0, failures: { getHome: 1 } }) })

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    state.session = 'denied'
    await user.click(retry)

    expect(await screen.findByRole('heading', { level: 1, name: 'Esta cuenta no tiene acceso al club' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('No se ha podido cargar esta página.')).not.toBeInTheDocument()
  })
})
