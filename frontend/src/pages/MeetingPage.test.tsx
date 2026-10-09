import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

async function openMeeting(meetingId: string, options: MockOptions = {}) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: `/reuniones/${meetingId}`, client: tracked.client })
  await screen.findByRole('link', { name: '← Volver a Reuniones' })
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

const region = (name: string) => screen.getByRole('region', { name })
const queryRegion = (name: string) => screen.queryByRole('region', { name })
const LOCKED = 'Resumen y momentos destacados'

// Summary and highlight texts of a fixture meeting, published or draft.
function recordTexts(meetingId: string): string[] {
  const meeting = createClubState().meetings.find((m) => m.id === meetingId)!
  return [...(meeting.summary ? meeting.summary.text.split('\n').filter(Boolean) : []), ...meeting.highlights.map((h) => h.text)]
}

function expectNoBrokenValues(main: HTMLElement) {
  expect(main.textContent).not.toMatch(/null|undefined|NaN|Invalid Date/)
}

describe('Meeting page', () => {
  it('shows the date with the year, the time, the book, the reading and a way back', async () => {
    const { main } = await openMeeting('mt1')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Reunión del jueves, 24 de septiembre de 2026' }),
    ).toBeInTheDocument()
    const facts = region('Detalles')
    const terms = within(facts)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent])
    expect(terms).toEqual([
      ['Fecha', 'jueves, 24 de septiembre de 2026'],
      ['Hora', '19:30'],
      ['Libro', 'La Regenta'],
      ['Lectura', 'Semana 10–12 %páginas 1–98'],
    ])
    expect(facts.querySelector('time')).toHaveAttribute('dateTime', '2026-09-24T19:30:00+02:00')
    expect(within(facts).getByRole('link', { name: 'La Regenta' })).toHaveAttribute('href', '/biblioteca/b3')
    expect(screen.getByRole('link', { name: '← Volver a Reuniones' })).toHaveAttribute('href', '/reuniones')
    expect(screen.getByRole('link', { name: 'Reuniones' })).toHaveAttribute('aria-current', 'page')
    expectNoBrokenValues(main)
  })

  it('shows a visible record: summary paragraphs, quotes, paraphrases and speakers, without drafts', async () => {
    const { main } = await openMeeting('mt1')

    const headings = within(main)
      .getAllByRole('heading')
      .map((h) => [h.tagName, h.textContent])
    expect(headings).toEqual([
      ['H1', 'Reunión del jueves, 24 de septiembre de 2026'],
      ['H2', 'Detalles'],
      ['H2', 'Asistencia'],
      ['H2', 'Resumen'],
      ['H2', 'Momentos destacados'],
    ])

    const paragraphs = within(region('Resumen')).getAllByText(/./, { selector: 'p' })
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[0]).toHaveTextContent(/^Empezamos «La Regenta»/)
    expect(paragraphs[2]).toHaveTextContent(/^Para la próxima semana/)

    const highlights = within(region('Momentos destacados')).getAllByRole('listitem')
    expect(highlights).toHaveLength(3)
    const quote = highlights[0].querySelector('blockquote')
    expect(quote).toHaveTextContent('«Vetusta no es una ciudad, es un estado de ánimo.»')
    expect(highlights[0]).toHaveTextContent(/— Carmen$/)
    expect(highlights[1].querySelector('blockquote')).toBeNull()
    expect(highlights[1]).toHaveTextContent(/^El primer capítulo se disfruta más.*— Carmen y Jordi$/)
    expect(highlights[2].querySelector('blockquote')).toBeNull()
    expect(highlights[2].textContent).toBe(
      'Alguien propuso hacer un mapa de Vetusta entre todos para no perderse entre calles y apellidos.',
    )
    expect(main).not.toHaveTextContent('Borrador')
    expect(queryRegion(LOCKED)).not.toBeInTheDocument()
  })

  it('lists the attendees with their avatars, read-only', async () => {
    await openMeeting('mt1')

    const attendance = region('Asistencia')
    expect(
      within(attendance)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['LLucía', 'MMateo', 'CCarmen', 'IInés', 'JJordi'])
    expect(within(attendance).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(attendance).queryByRole('button')).not.toBeInTheDocument()
  })

  it('gives attendee photos Spanish alt text', async () => {
    const state = createClubState()
    state.members[1] = { ...state.members[1], avatarUrl: '/avatars/mateo.png' }
    await openMeeting('mt1', { state })

    expect(within(region('Asistencia')).getByRole('img', { name: 'Foto de Mateo' })).toBeInTheDocument()
  })

  it('says when there is no summary or highlight yet, and leaves out the missing book and reading', async () => {
    const { main } = await openMeeting('mt7')

    expect(region('Resumen')).toHaveTextContent('Todavía no hay un resumen de esta reunión.')
    expect(region('Momentos destacados')).toHaveTextContent('Todavía no hay momentos destacados de esta reunión.')
    expect(within(region('Momentos destacados')).queryByRole('list')).not.toBeInTheDocument()
    expect(within(region('Detalles')).getAllByRole('term').map((t) => t.textContent)).toEqual(['Fecha', 'Hora'])
    expect(within(main).queryByRole('link', { name: /biblioteca/i })).not.toBeInTheDocument()
    expect(main.querySelector('a[href^="/biblioteca"]')).toBeNull()
    expect(main).not.toHaveTextContent('Semana')
    // The draft summary is not shown.
    expect(main).not.toHaveTextContent('Borrador')
    expect(region('Asistencia')).toHaveTextContent('Todavía no se ha anotado quién vino a esta reunión.')
    expectNoBrokenValues(main)
  })

  it('shows summary and highlight text as plain text', async () => {
    const state = createClubState()
    const mt1 = state.meetings.find((m) => m.id === 'mt1')!
    mt1.summary = { published: true, text: 'Un resumen con <b>texto</b> y <script>alert(1)</script>.' }
    mt1.highlights[0] = { ...mt1.highlights[0], text: 'Una cita con <b>texto</b>.' }
    mt1.highlights[1] = { ...mt1.highlights[1], text: '<script>alert(2)</script>' }
    const { main } = await openMeeting('mt1', { state })

    expect(region('Resumen')).toHaveTextContent('Un resumen con <b>texto</b> y <script>alert(1)</script>.')
    expect(region('Momentos destacados')).toHaveTextContent('«Una cita con <b>texto</b>.»')
    expect(region('Momentos destacados')).toHaveTextContent('<script>alert(2)</script>')
    expect(main.querySelector('b')).toBeNull()
    expect(main.querySelector('script')).toBeNull()
  })

  it('has no attendance section for an upcoming meeting', async () => {
    const { main } = await openMeeting('mt3')

    expect(screen.getByRole('heading', { level: 1, name: 'Reunión del jueves, 15 de octubre de 2026' })).toBeInTheDocument()
    expect(queryRegion('Asistencia')).not.toBeInTheDocument()
    expectNoBrokenValues(main)
  })

  it('marks a cancelled meeting in text and shows no record or attendance', async () => {
    const { main, tracked } = await openMeeting('mt0')

    expect(screen.getByText('Reunión cancelada')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    for (const name of ['Resumen', 'Momentos destacados', 'Asistencia', LOCKED]) {
      expect(queryRegion(name)).not.toBeInTheDocument()
    }
    expect(region('Detalles')).toHaveTextContent('La Regenta')
    expect(tracked.clubDataCalls()).toEqual(['getMeeting'])
    expectNoBrokenValues(main)
  })

  it('shows a calm locked card while the week is not read, with no gated text', async () => {
    // The default session is the admin, who has not read week 2.
    const { main, tracked } = await openMeeting('mt2')

    const card = region(LOCKED)
    expect(card).toHaveTextContent(
      'Para evitar spoilers, el resumen y los momentos destacados aparecerán cuando marques como leída la semana 2 (páginas 99–204).',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(main).not.toHaveTextContent(/bloquead/i)
    expect(queryRegion('Resumen')).not.toBeInTheDocument()
    expect(queryRegion('Momentos destacados')).not.toBeInTheDocument()
    for (const text of recordTexts('mt2')) expect(main).not.toHaveTextContent(text)
    expect(main.querySelector('blockquote')).toBeNull()
    expect(within(main).queryByRole('button')).not.toBeInTheDocument()
    // Attendance is not gated.
    expect(region('Asistencia')).toHaveTextContent('Mateo')
    expect(tracked.clubDataCalls()).toEqual(['getMeeting'])
  })

  it('shows a different locked message for a meeting with no week that is not shared yet', async () => {
    const { main } = await openMeeting('mt6', { session: 'member' })

    expect(region(LOCKED)).toHaveTextContent('El resumen de esta reunión aún no se ha compartido con el club.')
    expect(region(LOCKED)).not.toHaveTextContent(/semana/i)
    for (const text of recordTexts('mt6')) expect(main).not.toHaveTextContent(text)
    expect(region('Detalles')).toHaveTextContent('Cumbres borrascosas')
  })

  it('shows a meeting with no week once it is marked safe', async () => {
    await openMeeting('mt5', { session: 'member' })

    expect(region('Resumen')).toHaveTextContent('Cerramos «Niebla»')
    expect(region('Momentos destacados')).toHaveTextContent('— Pablo')
  })

  it('shows the record to a member who has read the week', async () => {
    await openMeeting('mt2', { session: 'member' })

    expect(region('Resumen')).toHaveTextContent('La segunda semana nos llevó a la confesión')
    expect(queryRegion(LOCKED)).not.toBeInTheDocument()
  })

  it('looks the same for a member and an admin in the same situation, with no edit controls', async () => {
    for (const meetingId of ['mt1', 'mt6']) {
      const asAdmin = await openMeeting(meetingId, { session: 'admin' })
      const adminText = asAdmin.main.textContent
      expect(within(asAdmin.main).queryByRole('button')).not.toBeInTheDocument()
      asAdmin.unmount()

      const asMember = await openMeeting(meetingId, { session: 'member' })
      expect(asMember.main.textContent).toBe(adminText)
      expect(within(asMember.main).queryByRole('button')).not.toBeInTheDocument()
      expect(within(asMember.main).queryByRole('checkbox')).not.toBeInTheDocument()
      expect(asMember.main).not.toHaveTextContent('Marcar como leído')
      asMember.unmount()
    }
  })

  it('shows the record after the week is marked as read', async () => {
    const user = userEvent.setup()
    const api = createMockClient()
    renderApp({ path: '/reuniones/mt2', client: api })
    expect(await screen.findByRole('region', { name: LOCKED })).toBeInTheDocument()

    await api.setWeekCompleted('w2', true)
    await user.click(screen.getByRole('link', { name: '← Volver a Reuniones' }))
    const past = await screen.findByRole('region', { name: 'Reuniones anteriores' })
    await user.click(within(past).getByRole('link', { name: 'jueves, 1 de octubre de 2026, 19:30' }))

    expect(await screen.findByRole('region', { name: 'Resumen' })).toHaveTextContent('La segunda semana')
    expect(queryRegion(LOCKED)).not.toBeInTheDocument()
  })

  it('shows a friendly page for an unknown meeting', async () => {
    renderApp({ path: '/reuniones/no-existe' })

    expect(await screen.findByRole('heading', { level: 1, name: 'No encontramos esta reunión' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Volver a Reuniones' })).toHaveAttribute('href', '/reuniones')
    expect(screen.getByRole('link', { name: 'Reuniones' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.queryByText('No se ha podido cargar esta página.')).not.toBeInTheDocument()
  })

  it('shows a loading message, and a retry when the meeting cannot be loaded', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient({ failures: { getMeeting: 1 } }))
    const held = holdCalls(tracked.client, 'getMeeting')
    renderApp({ path: '/reuniones/mt1', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    held.release()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('region', { name: 'Resumen' })).toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['getMeeting', 'getMeeting'])
  })

  it('returns to the sign-in screen when getMeeting gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getMeeting')
    renderApp({ path: '/reuniones/mt1', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('Vetusta no es una ciudad', { exact: false })).not.toBeInTheDocument()
  })
})

describe('Opening a meeting', () => {
  it('opens the next meeting from Inicio, and its record once the week is marked as read there', async () => {
    const user = userEvent.setup()
    const { router } = renderApp()

    await user.click(await screen.findByRole('button', { name: 'Marcar como leído' }))
    await screen.findByText('Has marcado esta semana como leída.')
    await user.click(screen.getByRole('link', { name: 'Ver reunión' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Reunión del jueves, 15 de octubre de 2026' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reuniones/mt3')
    // Week 3 is read now, so its (still empty) record is visible instead of the locked card.
    expect(region('Resumen')).toHaveTextContent('Todavía no hay un resumen de esta reunión.')
    expect(queryRegion(LOCKED)).not.toBeInTheDocument()
  })

  it('shows the locked card for the next meeting before its week is marked as read', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('link', { name: 'Ver reunión' }))
    expect(await screen.findByRole('region', { name: LOCKED })).toHaveTextContent('la semana 3 (páginas 205–330)')
  })

  it('opens a meeting from the book page reading plan and meetings list', async () => {
    const user = userEvent.setup()
    const { router } = renderApp({ path: '/biblioteca/b3' })

    const plan = await screen.findByRole('region', { name: 'Plan de lectura' })
    await user.click(within(plan).getByRole('link', { name: 'jueves, 24 de septiembre, 19:30' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Reunión del jueves, 24 de septiembre de 2026' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reuniones/mt1')

    await user.click(within(region('Detalles')).getByRole('link', { name: 'La Regenta' }))
    const meetings = await screen.findByRole('region', { name: 'Reuniones' })
    await user.click(within(meetings).getByRole('link', { name: 'jueves, 17 de septiembre, 19:30' }))
    expect(await screen.findByText('Reunión cancelada')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/reuniones/mt0')
  })

  it('opens a meeting from the Reuniones list', async () => {
    const user = userEvent.setup()
    renderApp({ path: '/reuniones' })

    const past = await screen.findByRole('region', { name: 'Reuniones anteriores' })
    await user.click(within(past).getByRole('link', { name: 'jueves, 10 de abril de 2025, 19:30' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Reunión del jueves, 10 de abril de 2025' })).toBeInTheDocument()
    await waitFor(() => expect(region('Resumen')).toHaveTextContent('Cerramos «Niebla»'))
  })
})
