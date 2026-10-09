import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

async function openBook(bookId: string, options: MockOptions = {}) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: `/biblioteca/${bookId}`, client: tracked.client })
  await screen.findByRole('link', { name: '← Volver a la biblioteca' })
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

const region = (name: string) => screen.getByRole('region', { name })
const items = (name: string) => within(region(name)).getAllByRole('listitem')

describe('Book page', () => {
  it('shows the book with its cover, title, authors, status, dates, description and metadata', async () => {
    const { main } = await openBook('b3')

    expect(screen.getByRole('heading', { level: 1, name: 'La Regenta' })).toBeInTheDocument()
    expect(within(main).getByRole('img', { name: 'Portada de «La Regenta»' })).toBeInTheDocument()
    expect(main).toHaveTextContent('Leopoldo Alas «Clarín»')
    expect(within(main).getByText('Leyendo')).toBeInTheDocument()
    expect(within(main).getByText('Desde el 15 de septiembre de 2026')).toBeInTheDocument()
    expect(within(main).getByText(/^En Vetusta, una ciudad de provincias/)).toBeInTheDocument()

    const terms = within(main)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent])
    expect(terms).toEqual([
      ['Publicación', '1884–1885'],
      ['Editorial', 'Editorial Ficticia del Norte'],
      ['ISBN', '978-0-00-000000-2'],
      ['Páginas', '864'],
    ])
    expect(screen.getByRole('link', { name: '← Volver a la biblioteca' })).toHaveAttribute('href', '/biblioteca')
    expect(screen.getByRole('link', { name: 'Biblioteca' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the reading plan in week order', async () => {
    await openBook('b3')

    const weeks = items('Plan de lectura')
    expect(weeks.map((week) => within(week).getByText(/^Semana \d$/).textContent)).toEqual([
      'Semana 1',
      'Semana 2',
      'Semana 3',
      'Semana 4',
      'Semana 5',
    ])
    expect(within(weeks[2]).getByText('25–40 %')).toBeInTheDocument()
    expect(within(weeks[2]).getByText('páginas 205–330')).toBeInTheDocument()
    expect(weeks[2]).toHaveTextContent('Nota: Incluye el capítulo XVI completo.')
    expect(within(weeks[0]).getByRole('link', { name: 'jueves, 24 de septiembre, 19:30' })).toHaveAttribute(
      'href',
      '/reuniones/mt1',
    )
    expect(weeks[0]).not.toHaveTextContent('Nota')
    // A week without a meeting shows its due date instead.
    expect(weeks[4]).toHaveTextContent('Para el 29 de octubre de 2026')
    expect(within(weeks[4]).queryByRole('link')).not.toBeInTheDocument()
  })

  it('shows percent and pages exactly as set, even when they do not correspond', async () => {
    const state = createClubState()
    state.weeks[0] = { ...state.weeks[0], percentStart: 0, percentEnd: 50, pageStart: 1, pageEnd: 10 }
    await openBook('b3', { state })

    const week = items('Plan de lectura')[0]
    expect(within(week).getByText('0–50 %')).toBeInTheDocument()
    expect(within(week).getByText('páginas 1–10')).toBeInTheDocument()
  })

  it('lists the meetings oldest first, with the cancelled one marked in text', async () => {
    await openBook('b3')

    const meetings = items('Reuniones')
    expect(meetings).toHaveLength(5)
    expect(meetings[0]).toHaveTextContent('jueves, 17 de septiembre, 19:30')
    expect(meetings[0]).toHaveTextContent('Cancelada')
    expect(meetings[0]).not.toHaveTextContent('Semana')
    expect(within(meetings[0]).getByRole('link')).toHaveAttribute('href', '/reuniones/mt0')
    expect(meetings[3]).toHaveTextContent('jueves, 15 de octubre, 19:30')
    expect(meetings[3]).toHaveTextContent('Semana 3')
    expect(meetings[3]).not.toHaveTextContent('Cancelada')
    expect(within(meetings[3]).getByRole('link')).toHaveAttribute('href', '/reuniones/mt3')
  })

  it('shows a ratings placeholder without numbers or names', async () => {
    await openBook('b3')

    const ratings = region('Valoraciones')
    expect(ratings).toHaveTextContent('Aquí aparecerán las valoraciones del club sobre este libro.')
    expect(ratings.textContent).not.toMatch(/\d|★|Lucía|Mateo|Carmen/)
  })

  it('links to the vote the book came from', async () => {
    await openBook('b3')

    expect(screen.getByRole('link', { name: /votación/ })).toHaveAttribute('href', '/votaciones/v1')
    expect(screen.getByText('Votación de Carmen (septiembre de 2026)')).toBeInTheDocument()
  })

  it('leaves out every missing field and shows friendly empty sections', async () => {
    const { main } = await openBook('b5')

    expect(screen.getByRole('heading', { level: 1, name: 'Los pazos de Ulloa' })).toBeInTheDocument()
    const placeholder = within(main).getByRole('img', { name: 'Portada de «Los pazos de Ulloa»' })
    expect(placeholder).toHaveTextContent('Emilia Pardo Bazán')
    expect(within(main).getByText('Propuesto')).toBeInTheDocument()
    expect(within(main).getByText('Fechas de lectura desconocidas')).toBeInTheDocument()
    expect(within(main).queryByRole('term')).not.toBeInTheDocument()
    for (const label of ['Publicación', 'Editorial', 'ISBN', 'Páginas']) expect(main).not.toHaveTextContent(label)
    expect(region('Plan de lectura')).toHaveTextContent('Este libro no tiene un plan de lectura semanal.')
    expect(region('Reuniones')).toHaveTextContent('Todavía no hay reuniones sobre este libro.')
    expect(screen.queryByRole('link', { name: /votación/i })).not.toBeInTheDocument()
    expect(main.textContent).not.toMatch(/null|undefined|Invalid Date|NaN/)
  })

  it('shows a cover image, a single known date and approximate dates', async () => {
    const { main } = await openBook('b1')
    expect(within(main).getByRole('img', { name: 'Portada de «Niebla»' })).toHaveAttribute('src', '/covers/niebla.svg')
    expect(within(main).getByText('1 de marzo de 2025 – 12 de abril de 2025')).toBeInTheDocument()
    expect(within(main).getAllByRole('term').map((t) => t.textContent)).toEqual(['Publicación'])
  })

  it.each([
    ['b6', 'Hasta junio de 2023 (aprox.)'],
    ['b2', 'octubre de 2024 – noviembre de 2024 (aprox.)'],
  ])('marks approximate dates for %s', async (bookId, dates) => {
    const { main } = await openBook(bookId)
    expect(within(main).getByText(dates)).toBeInTheDocument()
  })

  it('shows the description as plain text', async () => {
    const state = createClubState()
    state.books[2] = { ...state.books[2], description: 'Un libro con <b>texto</b> marcado.' }
    const { main } = await openBook('b3', { state })

    expect(within(main).getByText('Un libro con <b>texto</b> marcado.')).toBeInTheDocument()
    expect(main.querySelector('b')).toBeNull()
  })

  it('asks only for the book, never for ratings or summaries', async () => {
    const { tracked } = await openBook('b3')
    expect(tracked.clubDataCalls()).toEqual(['getBook'])
  })

  it('looks the same for a member and an admin, with no edit controls', async () => {
    const asAdmin = await openBook('b3', { session: 'admin' })
    const adminText = asAdmin.main.textContent
    expect(within(asAdmin.main).queryByRole('button')).not.toBeInTheDocument()
    asAdmin.unmount()

    const asMember = await openBook('b3', { session: 'member' })
    expect(asMember.main.textContent).toBe(adminText)
    expect(within(asMember.main).queryByRole('button')).not.toBeInTheDocument()
    expect(asMember.main).not.toHaveTextContent('He terminado el libro')
  })

  it('shows a friendly page for an unknown book', async () => {
    renderApp({ path: '/biblioteca/no-existe' })

    expect(await screen.findByRole('heading', { level: 1, name: 'No encontramos este libro' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Volver a la biblioteca' })).toHaveAttribute('href', '/biblioteca')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.queryByText('No se ha podido cargar esta página.')).not.toBeInTheDocument()
  })

  it('shows a loading message, and a retry when the book cannot be loaded', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient({ failures: { getBook: 1 } }))
    const held = holdCalls(tracked.client, 'getBook')
    renderApp({ path: '/biblioteca/b3', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    held.release()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'La Regenta' })).toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['getBook', 'getBook'])
  })

  it('returns to the sign-in screen when getBook gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getBook')
    renderApp({ path: '/biblioteca/b3', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('No se ha podido cargar esta página.')).not.toBeInTheDocument()
  })

  it('opens the current book from Inicio', async () => {
    const user = userEvent.setup()
    const { router } = renderApp()

    await user.click(await screen.findByRole('link', { name: 'Ver ficha del libro' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'La Regenta' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/biblioteca/b3')
  })

  it('opens the vote placeholder from the vote link', async () => {
    const user = userEvent.setup()
    await openBook('b3')

    await user.click(screen.getByRole('link', { name: /votación/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Votación' })).toBeInTheDocument()
  })
})
