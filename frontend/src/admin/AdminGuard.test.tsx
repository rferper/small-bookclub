import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState } from '../api/mock/fixtures'
import { createMockClient, type MockSession } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { renderApp } from '../test/renderApp'

const ADMIN_CALLS = ['getAdminMembers', 'addMember', 'revokeMember', 'restoreMember', 'setCurator']
const MESSAGE = 'Esta sección es solo para la administración del club.'

const nav = () => screen.getByRole('navigation', { name: 'Principal' })

describe('Administración hub', () => {
  it('shows the admin a heading, a calm line and the link to «Miembros y curaduría»', async () => {
    renderApp({ path: '/administracion' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Administración' })).toBeInTheDocument()
    const main = screen.getByRole('main')
    const links = within(within(main).getByRole('list')).getAllByRole('link')
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Reuniones', '/administracion/reuniones'],
      ['Libros', '/administracion/libros'],
      ['Miembros y curaduría', '/administracion/miembros'],
    ])
    expect(main).toHaveTextContent('Añade miembros con su ID de Discord')
    expect(main).not.toHaveTextContent(/próximamente|preparando/i)
  })

  it('opens «Miembros y curaduría» from the hub', async () => {
    const user = userEvent.setup()
    const { router } = renderApp({ path: '/administracion' })
    await user.click(await screen.findByRole('link', { name: 'Miembros y curaduría' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Miembros y curaduría' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/administracion/miembros')
  })
})

describe('Admin guard', () => {
  for (const path of ['/administracion', '/administracion/miembros']) {
    it(`shows ${path} to the admin, with «Administración» marked as current`, async () => {
      renderApp({ path })
      await screen.findByRole('heading', { level: 1 })
      expect(within(nav()).getByRole('link', { name: 'Administración' })).toHaveAttribute('aria-current', 'page')
      expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
    })

    for (const session of ['member', 'curator'] as MockSession[]) {
      it(`shows the calm message at ${path} to the ${session}, with no admin call`, async () => {
        const tracked = trackCalls(createMockClient({ session }))
        renderApp({ path, client: tracked.client })
        expect(await screen.findByText(MESSAGE)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/')
        expect(within(nav()).queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Miembros y curaduría' })).not.toBeInTheDocument()
        expect(tracked.calls.filter((c) => ADMIN_CALLS.includes(c))).toEqual([])
        expect(tracked.clubDataCalls()).toEqual([])
      })
    }
  }

  it('shows the message to a member at an unknown admin sub-path too', async () => {
    renderApp({ path: '/administracion/no-existe', client: createMockClient({ session: 'member' }) })
    expect(await screen.findByText(MESSAGE)).toBeInTheDocument()
  })

  it('shows the not-found page to the admin at an unknown admin sub-path', async () => {
    renderApp({ path: '/administracion/no-existe' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' })).toBeInTheDocument()
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument()
  })

  it('shows the message when the admin call answers 403 (the role changed while the page was open)', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getAdminMembers')
    renderApp({ path: '/administracion/miembros', client: held.client })
    expect(await screen.findByRole('heading', { level: 1, name: 'Miembros y curaduría' })).toBeInTheDocument()
    state.members.find((m) => m.id === 'm1')!.role = 'member'
    held.release()
    const heading = await screen.findByRole('heading', { level: 1, name: 'Sección reservada' })
    expect(screen.getByText(MESSAGE)).toBeInTheDocument()
    expect(heading).toHaveFocus()
    expect(screen.queryByRole('heading', { name: 'Miembros y curaduría' })).not.toBeInTheDocument()
  })

  it('goes to the sign-in screen on a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getAdminMembers')
    renderApp({ path: '/administracion/miembros', client: held.client })
    await screen.findByRole('heading', { level: 1, name: 'Miembros y curaduría' })
    state.session = 'anonymous'
    held.release()
    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument()
  })
})
