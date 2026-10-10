import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../api/client'
import { createClubState, createEmptyState, type MockState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import type { CriterionScores } from '../api/types'
import { barPercent } from '../lib/bars'
import { formatMean } from '../lib/ratings'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

async function openStatistics(options: MockOptions = {}, wrap: (client: ApiClient) => ApiClient = (c) => c) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: '/estadisticas', client: wrap(tracked.client) })
  await screen.findByRole('heading', { level: 1, name: 'Estadísticas' })
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

const region = (name: string) => screen.getByRole('region', { name })
const figures = () => {
  const dl = region('El club en cifras').querySelector('dl')!
  return [...dl.children].map((item) => [
    item.querySelector('dt')!.textContent,
    item.querySelector('dd')!.textContent,
  ])
}
const highlight = (label: string) => {
  const term = within(region('Destacados')).getByText(label, { selector: 'dt' })
  return term.nextElementSibling as HTMLElement
}
const highlightLines = (label: string) =>
  within(highlight(label))
    .queryAllByRole('listitem')
    .map((item) => item.textContent)
const tableRows = (section: HTMLElement) =>
  within(within(section).getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => [
      within(row).getByRole('rowheader').textContent,
      ...within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ])
const columnHeaders = (section: HTMLElement) =>
  within(within(section).getByRole('table'))
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent)
const chartOf = (section: HTMLElement) => within(section).getByRole('img')
const barRows = (chart: HTMLElement) =>
  [...chart.querySelectorAll<HTMLElement>('[data-bar-row]')].map((row) => ({
    label: row.firstElementChild!.textContent,
    width: row.querySelector<HTMLElement>('[data-bar]')!.style.width,
    value: row.querySelector('[data-bar-value]')!.textContent,
  }))

const flat = (value: number): CriterionScores => ({ disfrute: value, estilo: value, personajes: value, trama: value, huella: value })
const setScores = (state: MockState, bookId: string, userId: string, scores: CriterionScores) => {
  state.reviews.find((r) => r.bookId === bookId && r.userId === userId)!.scores = scores
}

const BOOK_CHART = 'Gráfico de barras: media del club por libro. Los valores están en la tabla siguiente.'
const MEMBER_CHART = 'Gráfico de barras: media de cada miembro. Los valores están en la tabla siguiente.'
const NOTE =
  'Solo se cuentan las valoraciones de los libros que ya has terminado y valorado, para no desvelarte nada antes de tiempo.'
const EMPTY =
  'Aún no hay valoraciones que puedas ver aquí. Cuando termines un libro y lo valores, sus valoraciones aparecerán en estas estadísticas.'
const NOT_ENOUGH_BOOKS =
  'Aún no hay suficientes valoraciones: hace falta que al menos dos libros tengan 3 valoraciones o más.'
const NOT_ENOUGH_MEMBERS =
  'Aún no hay suficientes valoraciones: hace falta que al menos dos miembros tengan 3 valoraciones o más.'

// Nothing that could show a broken or invented number.
function expectNoBrokenValues(main: HTMLElement) {
  expect(main.textContent).not.toMatch(/NaN|null|undefined|0\/5|Infinity/)
}

describe('Estadísticas: the default admin (README «Fixture statistics»)', () => {
  it('shows the headings outline, the note and the club figures', async () => {
    const { main, tracked } = await openStatistics()

    expect(screen.getByRole('link', { name: 'Estadísticas' })).toHaveAttribute('aria-current', 'page')
    expect(within(main).getAllByRole('heading').map((h) => [h.tagName, h.textContent])).toEqual([
      ['H1', 'Estadísticas'],
      ['H2', 'El club en cifras'],
      ['H2', 'Destacados'],
      ['H2', 'Media del club por libro'],
      ['H2', 'Media por criterio'],
      ['H2', 'Media de cada miembro'],
    ])
    expect(within(main).getByText(NOTE)).toBeInTheDocument()
    expect(figures()).toEqual([
      ['Libros leídos', '6'],
      ['Reuniones celebradas', '5'],
      ['Libros valorados', '4'],
      ['Valoraciones', '13'],
      ['Media de todas las valoraciones', '4,0 · 13 valoraciones'],
    ])
    expect(tracked.clubDataCalls()).toEqual(['getStatistics'])
    expectNoBrokenValues(main)
  })

  it('shows every highlight with its value and denominator, books linking to their page', async () => {
    await openStatistics()

    expect(within(region('Destacados')).getByText(/Solo tienen en cuenta los libros con 3 valoraciones o más/)).toBeInTheDocument()
    expect(highlightLines('Libro mejor valorado')).toEqual(['Fortunata y Jacinta · 4,5 · 4 valoraciones'])
    expect(highlightLines('Libro menos valorado')).toEqual(['El sí de las niñas · 3,2 · 3 valoraciones'])
    expect(highlightLines('Libro que más divide')).toEqual(['El sí de las niñas · desviación típica 0,8 · 3 valoraciones'])
    expect(highlightLines('Puntuación más generosa')).toEqual(['Carmen · media 4,4 en 3 valoraciones'])
    expect(highlightLines('Puntuación más exigente')).toEqual(['Lucía (tú) · media 3,8 en 4 valoraciones'])
    expect(within(highlight('Libro mejor valorado')).getByRole('link', { name: 'Fortunata y Jacinta' })).toHaveAttribute(
      'href',
      '/biblioteca/b12',
    )
    expect(within(highlight('Libro que más divide')).getByRole('link', { name: 'El sí de las niñas' })).toHaveAttribute(
      'href',
      '/biblioteca/b13',
    )
  })

  it('shows the books chart and table with the same entries, including books under the threshold', async () => {
    await openStatistics()
    const section = region('Media del club por libro')

    expect(columnHeaders(section)).toEqual(['Libro', 'Valoraciones', 'Media', 'Desviación típica'])
    expect(within(section).getByRole('table')).toHaveAccessibleName('Media y desviación típica de cada libro')
    expect(tableRows(section)).toEqual([
      ['Fortunata y Jacinta', '4', '4,5', '0,3'],
      ['Cumbres borrascosas', '4', '4,1', '0,2'],
      ['El ingenioso hidalgo don Quijote de la Mancha', '2', '4,0', '0,2'],
      ['El sí de las niñas', '3', '3,2', '0,8'],
    ])
    expect(within(section).getByRole('link', { name: 'Cumbres borrascosas' })).toHaveAttribute('href', '/biblioteca/b2')
    expect(chartOf(section)).toHaveAccessibleName(BOOK_CHART)
    expect(barRows(chartOf(section)).map(({ label, value }) => [label, value])).toEqual(
      tableRows(section).map(([title, , mean]) => [title, mean]),
    )
  })

  it('shows the criterion means over every counted rating', async () => {
    await openStatistics()
    const section = region('Media por criterio')

    expect(within(section).getByRole('table')).toHaveAccessibleName('Media de cada criterio (13 valoraciones)')
    expect(columnHeaders(section)).toEqual(['Criterio', 'Media'])
    // 52,5 / 13, 53 / 13, 52 / 13, 50 / 13 and 52 / 13.
    expect(tableRows(section)).toEqual([
      ['Disfrute', '4,0'],
      ['Estilo', '4,1'],
      ['Personajes', '4,0'],
      ['Trama', '3,8'],
      ['Huella', '4,0'],
    ])
  })

  it('shows the members chart and table, the viewer first and then by name', async () => {
    await openStatistics()
    const section = region('Media de cada miembro')

    expect(columnHeaders(section)).toEqual(['Miembro', 'Valoraciones', 'Media'])
    expect(tableRows(section)).toEqual([
      ['Lucía (tú)', '4', '3,8'],
      ['Carmen', '3', '4,4'],
      ['Elena', '1', '4,6'],
      ['Inés', '2', '3,5'],
      ['Jordi', '1', '4,0'],
      ['Mateo', '1', '3,8'],
      ['Pablo', '1', '4,1'],
    ])
    expect(chartOf(section)).toHaveAccessibleName(MEMBER_CHART)
    expect(barRows(chartOf(section)).map(({ label, value }) => [label, value])).toEqual(
      tableRows(section).map(([name, , mean]) => [name, mean]),
    )
  })

  it('never shows «La Regenta» or «Niebla», which she has not unlocked', async () => {
    const { main } = await openStatistics()
    expect(main.textContent).not.toMatch(/La Regenta|Niebla/)
  })
})

describe('Estadísticas: the charts', () => {
  it('draws each bar proportional to its unrounded value, in the response order', async () => {
    const statistics = await createMockClient().getStatistics()
    if (statistics.ratings.status !== 'available') throw new Error('expected ratings')
    await openStatistics()

    const books = barRows(chartOf(region('Media del club por libro')))
    expect(books).toEqual(
      statistics.ratings.books.map((entry) => ({
        label: entry.book.title,
        width: `${barPercent(entry.overallMean)}%`,
        value: formatMean(entry.overallMean),
      })),
    )
    // 4,525 is drawn as 4,525, not as the 4,5 shown.
    expect(books[0].width).toBe(`${(4.525 / 5) * 100}%`)
    const members = barRows(chartOf(region('Media de cada miembro')))
    expect(members.map((m) => m.width)).toEqual(statistics.ratings.members.map((e) => `${barPercent(e.overallMean)}%`))
  })

  it('has a labelled 0–5 scale, nothing focusable, no tooltip and no animation', async () => {
    const { main } = await openStatistics()
    for (const name of ['Media del club por libro', 'Media de cada miembro']) {
      const chart = chartOf(region(name))
      expect([...chart.querySelector('[data-scale]')!.children].map((tick) => tick.textContent)).toEqual([
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
      ])
      expect(chart.querySelectorAll('a, button, input, select, [tabindex], [title]')).toHaveLength(0)
      // The bars use the forest token; labels use text tokens only.
      for (const bar of chart.querySelectorAll('[data-bar]')) expect(bar).toHaveClass('bg-forest')
      expect(chart.innerHTML).not.toMatch(/soft-green|text-wood|fill-wood/)
    }
    expect(main.innerHTML).not.toMatch(/animate|transition/)
  })
})

describe('Estadísticas: ties', () => {
  it('names every tied book in collation order', async () => {
    const state = createClubState()
    for (const userId of ['m1', 'm3', 'm5', 'm6']) setScores(state, 'b2', userId, flat(4.5))
    for (const userId of ['m1', 'm3', 'm4', 'm7']) setScores(state, 'b12', userId, flat(4.5))
    await openStatistics({ state })

    expect(highlightLines('Libro mejor valorado')).toEqual([
      'Cumbres borrascosas · 4,5 · 4 valoraciones',
      'Fortunata y Jacinta · 4,5 · 4 valoraciones',
    ])
    expect(within(highlight('Libro mejor valorado')).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/biblioteca/b2',
      '/biblioteca/b12',
    ])
    // Equal means in the table: by title.
    expect(tableRows(region('Media del club por libro')).map(([title]) => title).slice(0, 2)).toEqual([
      'Cumbres borrascosas',
      'Fortunata y Jacinta',
    ])
  })

  it('names every tied member in collation order', async () => {
    const state = createClubState()
    for (const review of state.reviews) {
      if ((review.userId === 'm1' || review.userId === 'm3') && review.bookId !== 'b3') review.scores = flat(4)
    }
    // Inés finishes and rates «Fortunata y Jacinta», so she qualifies too.
    state.finished.b12.push('m5')
    state.reviews.push({ bookId: 'b12', userId: 'm5', scores: flat(1), text: null, submittedAt: state.now, editedAt: null })
    await openStatistics({ state })

    expect(highlightLines('Puntuación más generosa')).toEqual([
      'Carmen · media 4,0 en 3 valoraciones',
      'Lucía (tú) · media 4,0 en 4 valoraciones',
    ])
    expect(highlightLines('Puntuación más exigente')).toEqual(['Inés · media 2,7 en 3 valoraciones'])
  })

  it('explains when the qualifying entries cannot be told apart', async () => {
    const state = createClubState()
    for (const review of state.reviews) {
      if (['b2', 'b12', 'b13', 'b14'].includes(review.bookId)) review.scores = flat(4)
    }
    await openStatistics({ state })

    for (const label of ['Libro mejor valorado', 'Libro menos valorado']) {
      expect(highlight(label)).toHaveTextContent('Por ahora, los libros con 3 valoraciones o más tienen la misma media.')
    }
    expect(highlight('Libro que más divide')).toHaveTextContent(
      'Por ahora, en los libros con 3 valoraciones o más todas las valoraciones coinciden.',
    )
    for (const label of ['Puntuación más generosa', 'Puntuación más exigente']) {
      expect(highlight(label)).toHaveTextContent('Por ahora, los miembros con 3 valoraciones o más tienen la misma media.')
    }
  })
})

describe('Estadísticas: the default member (README «Fixture statistics»)', () => {
  it('shows his own figures and the insufficient-data texts', async () => {
    const { main } = await openStatistics({ session: 'member' })

    expect(figures()).toEqual([
      ['Libros leídos', '6'],
      ['Reuniones celebradas', '5'],
      ['Libros valorados', '2'],
      ['Valoraciones', '5'],
      ['Media de todas las valoraciones', '4,0 · 5 valoraciones'],
    ])
    for (const label of ['Libro mejor valorado', 'Libro menos valorado', 'Libro que más divide']) {
      expect(highlight(label)).toHaveTextContent(NOT_ENOUGH_BOOKS)
      expect(within(highlight(label)).queryByRole('link')).not.toBeInTheDocument()
    }
    for (const label of ['Puntuación más generosa', 'Puntuación más exigente']) {
      expect(highlight(label)).toHaveTextContent(NOT_ENOUGH_MEMBERS)
    }
    expect(tableRows(region('Media del club por libro'))).toEqual([
      ['El ingenioso hidalgo don Quijote de la Mancha', '2', '4,0', '0,2'],
      ['Niebla', '3', '3,9', '0,6'],
    ])
    expect(tableRows(region('Media de cada miembro'))).toEqual([
      ['Mateo (tú)', '2', '3,8'],
      ['Elena', '1', '3,3'],
      ['Lucía', '1', '4,2'],
      ['Pablo', '1', '4,7'],
    ])
    expect(within(region('Media por criterio')).getByRole('table')).toHaveAccessibleName(
      'Media de cada criterio (5 valoraciones)',
    )
    expect(main.textContent).not.toMatch(/La Regenta|Cumbres|Fortunata|El sí de las niñas|Carmen|Inés/)
    expectNoBrokenValues(main)
  })
})

describe('Estadísticas: no ratings to show', () => {
  function expectEmptyRatings(main: HTMLElement, booksRead: string, meetingsHeld: string) {
    expect(figures()).toEqual([
      ['Libros leídos', booksRead],
      ['Reuniones celebradas', meetingsHeld],
    ])
    expect(within(main).getByText(EMPTY)).toBeInTheDocument()
    expect(within(main).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Estadísticas', 'El club en cifras'])
    expect(within(main).queryByRole('img')).not.toBeInTheDocument()
    expect(within(main).queryByRole('table')).not.toBeInTheDocument()
    expect(main.querySelector('[data-bar], [data-scale]')).toBeNull()
    expect(main.textContent).not.toMatch(/Destacados|Media|Valoraciones|valorados/)
    expectNoBrokenValues(main)
  }

  it('shows the two counts as «0» and one warm empty state for a new club', async () => {
    const { main } = await openStatistics({ state: createEmptyState() })
    expectEmptyRatings(main, '0', '0')
  })

  it('shows the same copy when others have rated but the viewer has unlocked nothing', async () => {
    const state = createClubState()
    state.reviews = state.reviews.filter((r) => r.userId !== 'm1')
    const { main } = await openStatistics({ state })
    expectEmptyRatings(main, '6', '5')
    expect(main.textContent).not.toMatch(/Cumbres|Niebla|Fortunata|Regenta|Carmen/)
  })
})

describe('Estadísticas: loading, errors and the session', () => {
  it('shows the loading state until the call returns', async () => {
    const held = holdCalls(createMockClient(), 'getStatistics')
    renderApp({ path: '/estadisticas', client: held.client })

    await screen.findByRole('heading', { level: 1, name: 'Estadísticas' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    expect(screen.queryByRole('region', { name: 'El club en cifras' })).not.toBeInTheDocument()
    held.release()
    expect(await screen.findByRole('region', { name: 'El club en cifras' })).toBeInTheDocument()
  })

  it('shows the error state and retries the call with «Reintentar»', async () => {
    const user = userEvent.setup()
    const { tracked } = await openStatistics({ failures: { getStatistics: 1 } })

    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido cargar esta página.')
    expect(screen.queryByRole('region', { name: 'El club en cifras' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('region', { name: 'Destacados' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['getStatistics', 'getStatistics'])
  })

  it('returns to the sign-in screen when getStatistics gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getStatistics')
    renderApp({ path: '/estadisticas', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('No se ha podido cargar esta página.')).not.toBeInTheDocument()
  })

  it('shows the figures after the admin rates «Niebla», with a new call', async () => {
    const api = createMockClient()
    await api.saveMyReview('b1', { scores: flat(4), text: null })
    await openStatistics({}, () => api)

    expect(figures().slice(2)).toEqual([
      ['Libros valorados', '5'],
      ['Valoraciones', '17'],
      ['Media de todas las valoraciones', '4,0 · 17 valoraciones'],
    ])
    expect(tableRows(region('Media del club por libro'))[3]).toEqual(['Niebla', '4', '4,0', '0,5'])
  })
})

describe('Estadísticas: keyboard', () => {
  it('reaches every link in reading order with Tab', async () => {
    const user = userEvent.setup()
    const { main } = await openStatistics()
    const links = within(main).getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual([
      'Fortunata y Jacinta',
      'El sí de las niñas',
      'El sí de las niñas',
      'Fortunata y Jacinta',
      'Cumbres borrascosas',
      'El ingenioso hidalgo don Quijote de la Mancha',
      'El sí de las niñas',
    ])

    screen.getByRole('button', { name: 'Cerrar sesión' }).focus()
    for (const link of links) {
      await user.tab()
      expect(link).toHaveFocus()
    }
  })
})
