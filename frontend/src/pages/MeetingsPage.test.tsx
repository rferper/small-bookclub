import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState, createEmptyState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

async function openMeetings(options: MockOptions = {}) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: '/reuniones', client: tracked.client })
  await screen.findByRole('heading', { level: 1, name: 'Reuniones' })
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

const region = (name: string) => screen.getByRole('region', { name })
const items = (name: string) => within(region(name)).getAllByRole('listitem')
const linkNames = (name: string) => items(name).map((item) => within(item).getByRole('link').textContent)

describe('Reuniones', () => {
  it('lists upcoming meetings soonest first and past meetings most recent first, with the year', async () => {
    await openMeetings()

    expect(screen.getByRole('link', { name: 'Reuniones' })).toHaveAttribute('aria-current', 'page')
    const headings = within(screen.getByRole('main'))
      .getAllByRole('heading')
      .map((h) => [h.tagName, h.textContent])
    expect(headings).toEqual([
      ['H1', 'Reuniones'],
      ['H2', 'Próximas reuniones'],
      ['H2', 'Reuniones anteriores'],
    ])
    expect(linkNames('Próximas reuniones')).toEqual([
      'jueves, 15 de octubre de 2026, 19:30',
      'jueves, 22 de octubre de 2026, 19:30',
    ])
    expect(linkNames('Reuniones anteriores')).toEqual([
      'jueves, 1 de octubre de 2026, 19:30',
      'jueves, 24 de septiembre de 2026, 19:30',
      'jueves, 17 de septiembre de 2026, 19:30',
      'jueves, 10 de abril de 2025, 19:30',
      'jueves, 28 de noviembre de 2024, 19:30',
      'jueves, 26 de septiembre de 2024, 19:30',
    ])
  })

  it('shows one link per meeting, with its date in a machine-readable time element', async () => {
    await openMeetings()

    const [mt3] = items('Próximas reuniones')
    const links = within(mt3).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/reuniones/mt3')
    expect(links[0].querySelector('time')).toHaveAttribute('dateTime', '2026-10-15T19:30:00+02:00')
  })

  it('shows the book and the reading assignment exactly as returned', async () => {
    const state = createClubState()
    state.weeks[2] = { ...state.weeks[2], percentStart: 0, percentEnd: 50, pageStart: 1, pageEnd: 10 }
    await openMeetings({ state })

    const [mt3] = items('Próximas reuniones')
    expect(within(mt3).getByText('La Regenta')).toBeInTheDocument()
    expect(within(mt3).getByText('Semana 3')).toBeInTheDocument()
    expect(within(mt3).getByText('0–50 %')).toBeInTheDocument()
    expect(within(mt3).getByText('páginas 1–10')).toBeInTheDocument()
  })

  it('says «Cancelada» in text and still links a cancelled meeting', async () => {
    await openMeetings()

    const past = items('Reuniones anteriores')
    expect(past[2]).toHaveTextContent('Cancelada')
    expect(within(past[2]).getByRole('link')).toHaveAttribute('href', '/reuniones/mt0')
    expect(past.filter((item) => item.textContent?.includes('Cancelada'))).toHaveLength(1)
  })

  it('shows nothing about a book for a meeting without one, and no week without an assignment', async () => {
    const { main } = await openMeetings()

    const past = items('Reuniones anteriores')
    expect(past[3]).toHaveTextContent('Niebla')
    expect(past[3]).not.toHaveTextContent('Semana')
    expect(past[5].textContent).toBe('jueves, 26 de septiembre de 2024, 19:30')
    expect(main.textContent).not.toMatch(/null|undefined|NaN|Invalid Date/)
  })

  it('never shows summaries, highlights or attendance, and asks only for the list', async () => {
    const { main, tracked } = await openMeetings()

    expect(main).not.toHaveTextContent('Vetusta no es una ciudad')
    expect(main).not.toHaveTextContent('Empezamos')
    expect(main).not.toHaveTextContent('Lucía')
    expect(tracked.clubDataCalls()).toEqual(['listMeetings'])
  })

  it('shows one warm message and no sections when there are no meetings', async () => {
    const { main } = await openMeetings({ state: createEmptyState() })

    expect(main).toHaveTextContent('Todavía no hay reuniones en el calendario del club.')
    expect(within(main).queryAllByRole('heading', { level: 2 })).toHaveLength(0)
    expect(within(main).queryByRole('list')).not.toBeInTheDocument()
  })

  it('says when no meeting is scheduled yet', async () => {
    const state = createClubState()
    state.now = '2027-01-01T12:00:00+01:00'
    await openMeetings({ state })

    expect(region('Próximas reuniones')).toHaveTextContent('Por ahora no hay ninguna reunión programada.')
    expect(within(region('Próximas reuniones')).queryByRole('list')).not.toBeInTheDocument()
    expect(items('Reuniones anteriores')).toHaveLength(8)
  })

  it('says when no meeting has been held yet', async () => {
    const state = createClubState()
    state.now = '2020-01-01T12:00:00+01:00'
    await openMeetings({ state })

    expect(region('Reuniones anteriores')).toHaveTextContent('Todavía no se ha celebrado ninguna reunión.')
    expect(within(region('Reuniones anteriores')).queryByRole('list')).not.toBeInTheDocument()
    expect(items('Próximas reuniones')).toHaveLength(8)
  })

  it('shows a loading message, and a retry when the list cannot be loaded', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient({ failures: { listMeetings: 1 } }))
    const held = holdCalls(tracked.client, 'listMeetings')
    renderApp({ path: '/reuniones', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    held.release()

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    retry.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('region', { name: 'Próximas reuniones' })).toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['listMeetings', 'listMeetings'])
  })

  it('returns to the sign-in screen when listMeetings gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'listMeetings')
    renderApp({ path: '/reuniones', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('No se ha podido cargar esta página.')).not.toBeInTheDocument()
  })

  it('opens a meeting from the list with the keyboard', async () => {
    const user = userEvent.setup()
    const { router } = await openMeetings()

    within(items('Reuniones anteriores')[1]).getByRole('link').focus()
    await user.keyboard('{Enter}')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reunión del jueves, 24 de septiembre de 2026' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reuniones/mt1')
  })
})
