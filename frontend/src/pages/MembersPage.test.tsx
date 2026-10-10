import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState, createEmptyState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

async function openMembers(options: MockOptions = {}) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: '/miembros', client: tracked.client })
  await screen.findByRole('heading', { level: 1, name: 'Miembros' })
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

// Each list item's visible link text without the decorative initials: the
// name (with «(tú)») and the status.
const items = (main: HTMLElement) =>
  within(within(main).getByRole('list'))
    .getAllByRole('listitem')
    .map((item) => {
      const link = within(item).getByRole('link').cloneNode(true) as HTMLElement
      link.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove())
      return link.textContent
    })

describe('Miembros', () => {
  it('lists the seven active members by name for the default admin, with week 3 statuses', async () => {
    const { main, tracked } = await openMembers()

    expect(within(main).getByText('Lectura de esta semana: semana 3')).toBeInTheDocument()
    expect(items(main)).toEqual([
      'Carmen✓ Leído',
      'ElenaLeyendo',
      'InésLeyendo',
      'Jordi✓ Leído',
      'Lucía (tú)Leyendo',
      'MateoLeyendo',
      'PabloLeyendo',
    ])
    expect(tracked.clubDataCalls()).toEqual(['listMembers'])
    expect(screen.getByRole('link', { name: 'Miembros' })).toHaveAttribute('aria-current', 'page')
    expect(within(main).getAllByRole('heading').map((h) => [h.tagName, h.textContent])).toEqual([['H1', 'Miembros']])
  })

  it('links each member to their profile, named by their display name', async () => {
    const { main } = await openMembers()

    const carmen = within(main).getByRole('link', { name: /Carmen/ })
    expect(carmen).toHaveAttribute('href', '/miembros/m3')
    expect(within(main).getByRole('link', { name: /Lucía \(tú\)/ })).toHaveAttribute('href', '/miembros/m1')
    // The initials are decorative; the name is the link's text.
    expect(carmen.querySelector('[aria-hidden="true"]')).toHaveTextContent('C')
  })

  it('shows an image avatar with its alt text', async () => {
    const state = createClubState()
    state.members.find((m) => m.id === 'm3')!.avatarUrl = '/avatars/carmen.png'
    const { main } = await openMembers({ state })

    expect(within(main).getByRole('img', { name: 'Foto de Carmen' })).toHaveAttribute('src', '/avatars/carmen.png')
  })

  it('marks the default member as «(tú)»', async () => {
    const { main } = await openMembers({ session: 'member' })

    expect(items(main)).toContain('Mateo (tú)Leyendo')
    expect(main).not.toHaveTextContent('Lucía (tú)')
  })

  it('never lists the revoked member', async () => {
    const { main } = await openMembers()

    expect(main).not.toHaveTextContent('Tomás')
    expect(main.querySelector('a[href="/miembros/m8"]')).toBeNull()
  })

  it('uses only low-pressure wording, never a ranking', async () => {
    const { main } = await openMembers()

    expect(main.textContent).not.toMatch(/pendiente|atrasad|puesto|ranking|null|undefined|semana 0/i)
  })

  it('shows no week line and no status when there is no current week', async () => {
    const state = createClubState()
    state.books.find((b) => b.id === 'b3')!.status = 'terminado'
    const { main } = await openMembers({ state })

    expect(main).not.toHaveTextContent('Lectura de esta semana')
    expect(items(main)).toEqual(['Carmen', 'Elena', 'Inés', 'Jordi', 'Lucía (tú)', 'Mateo', 'Pablo'])
    expect(main.textContent).not.toMatch(/Leído|Leyendo|null|undefined|semana 0/)
  })

  it('shows the viewer and a calm empty state when they are the only member', async () => {
    const { main } = await openMembers({ state: createEmptyState() })

    expect(items(main)).toEqual(['Lucía (tú)'])
    expect(within(main).getByText('Todavía no hay más miembros en el club.')).toBeInTheDocument()
    expect(main).not.toHaveTextContent('Lectura de esta semana')
    expect(main.textContent).not.toMatch(/null|undefined|semana 0/)
  })

  it('does not show the empty state when there are other members', async () => {
    await openMembers()
    expect(screen.queryByText('Todavía no hay más miembros en el club.')).not.toBeInTheDocument()
  })

  it('shows «✓ Leído» for the viewer after marking week 3 on Inicio', async () => {
    const user = userEvent.setup()
    const { main } = await openMembers()
    expect(items(main)).toContain('Lucía (tú)Leyendo')

    await user.click(screen.getByRole('link', { name: 'Inicio' }))
    await user.click(await screen.findByRole('button', { name: 'Marcar como leído' }))
    await screen.findByText('Has marcado esta semana como leída.')
    await user.click(screen.getByRole('link', { name: 'Miembros' }))

    await screen.findByRole('heading', { level: 1, name: 'Miembros' })
    expect(items(screen.getByRole('main'))).toContain('Lucía (tú)✓ Leído')
  })

  it('shows a loading message, and a retry that calls listMembers again', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient({ failures: { listMembers: 1 } }))
    const held = holdCalls(tracked.client, 'listMembers')
    renderApp({ path: '/miembros', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    held.release()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Miembros' })).toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['listMembers', 'listMembers'])
  })

  it('returns to the sign-in screen when listMembers gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'listMembers')
    renderApp({ path: '/miembros', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('Carmen', { exact: false })).not.toBeInTheDocument()
  })

  it('reaches every member with Tab in reading order and opens a profile with Enter', async () => {
    const user = userEvent.setup()
    const { main, router } = await openMembers()

    const links = within(main).getAllByRole('link')
    screen.getByRole('link', { name: 'Miembros' }).focus()
    // Past «Mi perfil», «Administración» and «Cerrar sesión».
    await user.tab()
    await user.tab()
    await user.tab()
    for (const link of links) {
      await user.tab()
      expect(link).toHaveFocus()
    }
    links[0].focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Carmen' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/miembros/m3')
  })
})
