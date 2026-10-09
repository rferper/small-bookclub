import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState, createEmptyState } from '../api/mock/fixtures'
import { createMockClient } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

// Fixture books: b3 La Regenta (2026), b1 Niebla (2025), b2 Cumbres borrascosas
// (2024, approximate), b6 Ángel Guerra (2023, end date only), and b4 Pepita
// Jiménez, b5 Los pazos de Ulloa, b7 Marianela, b8 La gaviota and b9 La vida
// del Buscón (candidates of the open vote, #66) with no dates.

const bookIds = (container: HTMLElement) =>
  within(container)
    .getAllByRole('link')
    .map((link) => link.getAttribute('href')?.replace('/biblioteca/', ''))

const shelf = () => screen.getByRole('list', { name: 'Estantería' })

async function openLibrary(path = '/biblioteca', client = createMockClient()) {
  const user = userEvent.setup()
  const rendered = renderApp({ path, client })
  await screen.findByRole('heading', { level: 1, name: 'Biblioteca' })
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  return { user, ...rendered }
}

// Year headings of the timeline, in order, with the book ids under each.
function timeline() {
  return within(screen.getByRole('main'))
    .getAllByRole('region')
    .map((section) => [within(section).getByRole('heading', { level: 2 }).textContent, bookIds(section)])
}

describe('Biblioteca', () => {
  it('shows a loading message, then the shelf by default', async () => {
    const held = holdCalls(createMockClient(), 'listBooks')
    renderApp({ path: '/biblioteca', client: held.client })

    expect(await screen.findByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    held.release()

    expect(await screen.findByRole('list', { name: 'Estantería' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Estantería' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Cronología' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('link', { name: 'Biblioteca' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows each shelf book with its cover or placeholder, title, authors and status', async () => {
    await openLibrary()

    expect(within(shelf()).getAllByRole('listitem')).toHaveLength(9)
    const niebla = screen.getByRole('link', { name: /Niebla/ })
    expect(within(niebla).getByRole('img', { name: 'Portada de «Niebla»' })).toHaveAttribute('src', '/covers/niebla.svg')
    expect(niebla).toHaveTextContent('Miguel de Unamuno')
    expect(niebla).toHaveTextContent('Terminado')

    const regenta = screen.getByRole('link', { name: /La Regenta/ })
    const placeholder = within(regenta).getByRole('img', { name: 'Portada de «La Regenta»' })
    expect(placeholder.tagName).not.toBe('IMG')
    expect(placeholder).toHaveTextContent('La Regenta')
    expect(placeholder).toHaveTextContent('Leopoldo Alas «Clarín»')
    expect(regenta).toHaveTextContent('Leyendo')
  })

  it('makes each book a single link to its page, the same from both views', async () => {
    const { user } = await openLibrary()

    for (const item of within(shelf()).getAllByRole('listitem')) {
      expect(within(item).getAllByRole('link')).toHaveLength(1)
    }
    expect(screen.getByRole('link', { name: /La Regenta/ })).toHaveAttribute('href', '/biblioteca/b3')

    await user.click(screen.getByRole('button', { name: 'Cronología' }))
    for (const item of within(screen.getByRole('main')).getAllByRole('listitem')) {
      expect(within(item).getAllByRole('link')).toHaveLength(1)
    }
    expect(screen.getByRole('link', { name: /La Regenta/ })).toHaveAttribute('href', '/biblioteca/b3')
  })

  it('shows the timeline by year, newest first, with «Fecha desconocida» last', async () => {
    const tracked = trackCalls(createMockClient())
    const { user, router } = await openLibrary('/biblioteca', tracked.client)

    await user.click(screen.getByRole('button', { name: 'Cronología' }))

    expect(screen.getByRole('button', { name: 'Cronología' })).toHaveAttribute('aria-pressed', 'true')
    expect(router.state.location.search).toBe('?vista=cronologia')
    expect(timeline()).toEqual([
      ['2026', ['b3']],
      ['2025', ['b1']],
      ['2024', ['b2']],
      ['2023', ['b6']],
      ['Fecha desconocida', ['b8', 'b9', 'b5', 'b7', 'b4']],
    ])
    expect(screen.getByRole('link', { name: /La Regenta/ })).toHaveTextContent('Desde el 15 de septiembre de 2026')
    expect(screen.getByRole('link', { name: /Niebla/ })).toHaveTextContent('1 de marzo de 2025 – 12 de abril de 2025')
    expect(screen.getByRole('link', { name: /Cumbres/ })).toHaveTextContent('octubre de 2024 – noviembre de 2024 (aprox.)')
    expect(screen.getByRole('link', { name: /Pepita/ })).toHaveTextContent('Fechas de lectura desconocidas')
    expect(screen.getByRole('link', { name: /Pepita/ })).toHaveTextContent('Elegido')
    expect(within(screen.getByRole('link', { name: /Cumbres/ })).getByRole('img', { name: 'Portada de «Cumbres borrascosas»' })).toBeInTheDocument()
    // The sort only applies to the shelf.
    expect(screen.queryByRole('combobox', { name: 'Ordenar por' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Estantería' }))
    expect(router.state.location.search).toBe('')
    expect(tracked.clubDataCalls()).toEqual(['listBooks'])
  })

  it('groups approximate dates by their year and ignores the shelf sort in the timeline', async () => {
    await openLibrary('/biblioteca?vista=cronologia&orden=titulo')

    expect(timeline().map(([heading]) => heading)).toEqual(['2026', '2025', '2024', '2023', 'Fecha desconocida'])
  })

  it('sorts the shelf by reading date by default, undated books last', async () => {
    await openLibrary()

    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('fecha')
    expect(bookIds(shelf())).toEqual(['b3', 'b1', 'b2', 'b6', 'b8', 'b9', 'b5', 'b7', 'b4'])
  })

  it('sorts the shelf by title with Spanish collation', async () => {
    const { user, router } = await openLibrary()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), 'Título')

    // «Ángel Guerra» sorts with the A's, not after «Pepita Jiménez».
    expect(bookIds(shelf())).toEqual(['b6', 'b2', 'b8', 'b3', 'b9', 'b5', 'b7', 'b1', 'b4'])
    expect(router.state.location.search).toBe('?orden=titulo')
  })

  it('filters both views by status', async () => {
    const { user, router } = await openLibrary()
    const filter = screen.getByRole('combobox', { name: 'Estado' })
    expect(filter).toHaveValue('todos')
    expect(within(filter).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Todos',
      'Propuesto',
      'Elegido',
      'Leyendo',
      'Terminado',
      'Archivado',
    ])

    await user.selectOptions(filter, 'Terminado')
    expect(bookIds(shelf())).toEqual(['b1', 'b2'])

    await user.click(screen.getByRole('button', { name: 'Cronología' }))
    expect(timeline()).toEqual([
      ['2025', ['b1']],
      ['2024', ['b2']],
    ])
    expect(screen.queryByRole('heading', { name: 'Fecha desconocida' })).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('?estado=terminado&vista=cronologia')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'Propuesto')
    expect(timeline()).toEqual([['Fecha desconocida', ['b8', 'b9', 'b5', 'b7']]])
  })

  it('says when no book has the chosen status, and shows all books again with «Todos»', async () => {
    const state = createClubState()
    state.books = state.books.filter((book) => book.status !== 'archivado')
    const { user } = await openLibrary('/biblioteca', createMockClient({ state }))

    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'Archivado')
    expect(screen.getByText(/ningún libro tiene el estado «Archivado»/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Estantería' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cronología' }))
    expect(screen.getByText(/ningún libro tiene el estado «Archivado»/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'Todos')
    expect(timeline()).toHaveLength(4)
    expect(screen.queryByText(/ningún libro tiene/)).not.toBeInTheDocument()
  })

  it('restores the view, filter and sort after visiting a book and going back', async () => {
    const { user, router } = await openLibrary()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'Terminado')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), 'Título')
    await user.click(screen.getByRole('link', { name: /Niebla/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Niebla' })).toBeInTheDocument()

    await router.navigate(-1)
    await screen.findByRole('list', { name: 'Estantería' })
    expect(router.state.location.search).toBe('?estado=terminado&orden=titulo')
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('terminado')
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('titulo')
    expect(bookIds(shelf())).toEqual(['b2', 'b1'])

    await user.click(screen.getByRole('button', { name: 'Cronología' }))
    await user.click(screen.getByRole('link', { name: /Cumbres/ }))
    await screen.findByRole('heading', { level: 1, name: 'Cumbres borrascosas' })
    await router.navigate(-1)
    await screen.findByRole('heading', { level: 2, name: '2025' })
    expect(screen.getByRole('button', { name: 'Cronología' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('terminado')
  })

  it('falls back to the defaults for unknown query values', async () => {
    await openLibrary('/biblioteca?vista=lista&estado=leido&orden=autor')

    expect(screen.getByRole('button', { name: 'Estantería' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('todos')
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('fecha')
    expect(bookIds(shelf())).toEqual(['b3', 'b1', 'b2', 'b6', 'b8', 'b9', 'b5', 'b7', 'b4'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a warm message in both views when the library is empty', async () => {
    const user = userEvent.setup()
    renderApp({ path: '/biblioteca', client: createMockClient({ state: createEmptyState() }) })

    const message = 'Todavía no hay libros en la biblioteca del club.'
    expect(await screen.findByText(message, { exact: false })).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(within(main).queryByRole('list')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cronología' }))
    expect(screen.getByText(message, { exact: false })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    expect(within(main).queryByRole('list')).not.toBeInTheDocument()
  })

  it('offers a retry when the books cannot be loaded', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient({ failures: { listBooks: 1 } }))
    renderApp({ path: '/biblioteca', client: tracked.client })

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('list', { name: 'Estantería' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['listBooks', 'listBooks'])
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
  })

  it('keeps the navigation usable while the books cannot be loaded', async () => {
    const user = userEvent.setup()
    renderApp({ path: '/biblioteca', client: createMockClient({ failures: { listBooks: Infinity } }) })

    await screen.findByRole('button', { name: 'Reintentar' })
    await user.click(screen.getByRole('link', { name: 'Inicio' }))
    expect(await screen.findByRole('heading', { name: 'La Regenta' })).toBeInTheDocument()
  })

  it('returns to the sign-in screen when listBooks gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'listBooks')
    renderApp({ path: '/biblioteca', client: held.client })

    await screen.findByRole('heading', { level: 1, name: 'Biblioteca' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('No se ha podido cargar esta página.')).not.toBeInTheDocument()
  })

  it('can be used with the keyboard only', async () => {
    const { user, router } = await openLibrary()

    screen.getByRole('button', { name: 'Estantería' }).focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cronología' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(router.state.location.search).toBe('?vista=cronologia')

    await user.tab()
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: /La Regenta/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/biblioteca/b3'))
  })
})
