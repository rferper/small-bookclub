import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../api/client'
import { createClubState, createEmptyState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import type { CriterionScores } from '../api/types'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

// «Gustos en común» on Estadísticas (#93), with the figures in
// frontend/README.md «Fixture taste compatibility».

const SECTION = 'Gustos en común'
const EXPLANATION =
  'Compara tus valoraciones con las de otro miembro, solo en los libros que habéis valorado los dos y que ya puedes ver.'
const INSUFFICIENT = 'Aún no hay suficientes libros en común.'
const THRESHOLD = 'Para comparar hacen falta al menos 3 libros valorados por los dos.'
const METRIC_EXPLANATION =
  'En cada libro comparamos vuestra nota global (de 1 a 5). La diferencia media va de 0, si coincidís siempre, a 4, la mayor diferencia posible.'
const NO_MEMBERS = 'Todavía no hay otros miembros con quien comparar tus valoraciones.'

const flat = (value: number): CriterionScores => ({ disfrute: value, estilo: value, personajes: value, trama: value, huella: value })

async function openStatistics(options: MockOptions = {}, wrap: (client: ApiClient) => ApiClient = (c) => c) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: '/estadisticas', client: wrap(tracked.client) })
  await screen.findByRole('heading', { level: 1, name: 'Estadísticas' })
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

const section = () => screen.getByRole('region', { name: SECTION })
const select = () => within(section()).getByRole('combobox', { name: 'Comparar con' })
const options = () =>
  within(select())
    .getAllByRole('option')
    .map((option) => [option.textContent, (option as HTMLOptionElement).value])
const countLine = () => within(section()).getByText(/^Libros en común:/).textContent
const table = (caption: string) => within(section()).getByRole('table', { name: caption })
const rows = (t: HTMLElement) =>
  within(t)
    .getAllByRole('row')
    .slice(1)
    .map((row) => [
      within(row).getByRole('rowheader').textContent,
      ...within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ])
const columns = (t: HTMLElement) =>
  within(t)
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent)
const metric = () => {
  const term = within(section()).getByText('Diferencia media en la nota global', { selector: 'dt' })
  return term.nextElementSibling!.textContent
}

function expectInsufficient(count: string) {
  expect(countLine()).toBe(`Libros en común: ${count}`)
  expect(within(section()).getByText(INSUFFICIENT)).toBeInTheDocument()
  expect(within(section()).getByText(THRESHOLD)).toBeInTheDocument()
  expect(within(section()).queryByRole('table')).not.toBeInTheDocument()
  expect(within(section()).queryByRole('link')).not.toBeInTheDocument()
  expect(within(section()).queryByText('Diferencia media en la nota global')).not.toBeInTheDocument()
  expect(section().textContent).not.toMatch(/NaN|0,0|null|undefined|Infinity|puntos/)
}

// Warm, never ranking or pressuring (§4).
function expectLowPressureCopy() {
  expect(section().textContent).not.toMatch(/%|compatib|afín|afines|incompatible|peor|mejor|valora más|valorar más/i)
}

describe('Gustos en común: the default admin (Lucía)', () => {
  it('compares her with Carmen by default: count, metric, criteria and shared books', async () => {
    const { main } = await openStatistics()

    expect(within(section()).getByRole('heading', { level: 2 })).toHaveTextContent(SECTION)
    expect(within(section()).getByText(EXPLANATION)).toBeInTheDocument()
    expect(options()).toEqual([
      ['Carmen', 'm3'],
      ['Elena', 'm7'],
      ['Inés', 'm5'],
      ['Jordi', 'm6'],
      ['Mateo', 'm2'],
      ['Pablo', 'm4'],
    ])
    expect(select()).toHaveValue('m3')
    expect(countLine()).toBe('Libros en común: 3')
    expect(metric()).toBe('0,9 puntos, en 3 libros en común')
    expect(within(section()).getByText(METRIC_EXPLANATION)).toBeInTheDocument()

    const criteria = table('Diferencia media por criterio (3 libros en común)')
    expect(columns(criteria)).toEqual(['Criterio', 'Diferencia media'])
    expect(rows(criteria)).toEqual([
      ['Disfrute', '1,3'],
      ['Estilo', '0,7'],
      ['Personajes', '1,3'],
      ['Trama', '0,8'],
      ['Huella', '1,8'],
    ])

    const books = table('Libros en común con Carmen')
    expect(columns(books)).toEqual(['Libro', 'Tu nota', 'Nota de Carmen', 'Diferencia'])
    expect(rows(books)).toEqual([
      ['Cumbres borrascosas', '3,8', '4,4', '0,6'],
      ['El sí de las niñas', '2,3', '4,3', '2,0'],
      ['Fortunata y Jacinta', '4,8', '4,6', '0,2'],
    ])
    expect(
      within(books)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/biblioteca/b2', '/biblioteca/b13', '/biblioteca/b12'])
    expect(within(section()).queryByText(INSUFFICIENT)).not.toBeInTheDocument()

    // Never a book she has not unlocked, nor a chart or anything animated.
    expect(section().textContent).not.toMatch(/Niebla|La Regenta|Quijote/)
    expect(within(section()).queryByRole('img')).not.toBeInTheDocument()
    expect(section().querySelector('svg, [data-bar], [data-scale]')).toBeNull()
    expect(section().innerHTML).not.toMatch(/animate|transition/)
    expectLowPressureCopy()
    expect(main.textContent).not.toMatch(/NaN|undefined|Infinity/)
  })

  it('shows Inés with 2 books and the insufficient text, and the others with 1', async () => {
    const user = userEvent.setup()
    const { tracked } = await openStatistics()

    await user.selectOptions(select(), 'Inés')
    expectInsufficient('2')
    expectLowPressureCopy()
    for (const name of ['Elena', 'Jordi', 'Mateo', 'Pablo']) {
      await user.selectOptions(select(), name)
      expectInsufficient('1')
    }
    await user.selectOptions(select(), 'Carmen')
    expect(metric()).toBe('0,9 puntos, en 3 libros en común')
    // Every change used the one response.
    expect(tracked.clubDataCalls()).toEqual(['getStatistics', 'getTasteCompatibility'])
  })

  it('reaches the select with Tab and changes it while focused, with no new call', async () => {
    const user = userEvent.setup()
    const { tracked } = await openStatistics()

    // Tab from the last #68 link reaches the select.
    within(screen.getByRole('region', { name: 'Media del club por libro' }))
      .getAllByRole('link')
      .at(-1)!
      .focus()
    await user.tab()
    expect(select()).toHaveFocus()
    // jsdom does not move a native select with the arrow keys, so the
    // focused select is changed directly here; the browser check covers the
    // arrow keys.
    await user.selectOptions(select(), 'Inés')
    expect(select()).toHaveValue('m5')
    expect(select()).toHaveFocus()
    expectInsufficient('2')
    expect(tracked.clubDataCalls()).toEqual(['getStatistics', 'getTasteCompatibility'])
  })

  it('does not remember the choice across reloads', async () => {
    const user = userEvent.setup()
    const { unmount } = await openStatistics()
    await user.selectOptions(select(), 'Inés')
    unmount()

    await openStatistics()
    expect(select()).toHaveValue('m3')
  })

  it('counts «Niebla» for Mateo, Pablo and Elena after she rates it', async () => {
    const user = userEvent.setup()
    const api = createMockClient()
    await api.saveMyReview('b1', { scores: flat(4), text: null })
    await openStatistics({}, () => api)

    for (const name of ['Mateo', 'Pablo', 'Elena']) {
      await user.selectOptions(select(), name)
      expectInsufficient('2')
    }
  })
})

describe('Gustos en común: other sessions', () => {
  it('shows the default member (Mateo) every member insufficient, with no book', async () => {
    const user = userEvent.setup()
    await openStatistics({ session: 'member' })

    expect(options().map(([name]) => name)).toEqual(['Carmen', 'Elena', 'Inés', 'Jordi', 'Lucía', 'Pablo'])
    expect(select()).toHaveValue('m3')
    // Carmen has nothing in common with him: «0» is shown as «0».
    expectInsufficient('0')
    const expected: Record<string, string> = { Elena: '1', Inés: '0', Jordi: '0', Lucía: '1', Pablo: '1' }
    for (const [name, count] of Object.entries(expected)) {
      await user.selectOptions(select(), name)
      expectInsufficient(count)
    }
    expect(section().textContent).not.toMatch(/Niebla|Quijote|Cumbres|Fortunata|El sí de las niñas|La Regenta/)
  })

  it('shows the comparison once the member shares 3 books with Lucía', async () => {
    const user = userEvent.setup()
    const api = createMockClient({ session: 'member' })
    for (const bookId of ['b12', 'b13']) {
      await api.setBookFinished(bookId, true)
      await api.saveMyReview(bookId, { scores: flat(4), text: null })
    }
    await openStatistics({}, () => api)

    await user.selectOptions(select(), 'Lucía')
    expect(countLine()).toBe('Libros en común: 3')
    expect(metric()).toBe('1,0 puntos, en 3 libros en común')
    expect(rows(table('Diferencia media por criterio (3 libros en común)'))).toEqual([
      ['Disfrute', '1,2'],
      ['Estilo', '1,0'],
      ['Personajes', '1,0'],
      ['Trama', '0,7'],
      ['Huella', '1,3'],
    ])
    expect(rows(table('Libros en común con Lucía'))).toEqual([
      ['El ingenioso hidalgo don Quijote de la Mancha', '3,8', '4,2', '0,4'],
      ['El sí de las niñas', '4,0', '2,3', '1,7'],
      ['Fortunata y Jacinta', '4,0', '4,8', '0,8'],
    ])
    expect(columns(table('Libros en común con Lucía'))).toEqual(['Libro', 'Tu nota', 'Nota de Lucía', 'Diferencia'])
  })

  it('has no section and makes no call when there are no ratings to show', async () => {
    const { main, tracked } = await openStatistics({ state: createEmptyState() })
    expect(screen.queryByRole('region', { name: SECTION })).not.toBeInTheDocument()
    expect(main.textContent).not.toMatch(/Gustos en común|Comparar con/)
    expect(tracked.clubDataCalls()).toEqual(['getStatistics'])
  })

  it('shows a calm empty state with no selector when there are no other members', async () => {
    const state = createClubState()
    state.members = state.members.filter((m) => m.id === 'm1')
    await openStatistics({ state })

    expect(within(section()).getByText(NO_MEMBERS)).toBeInTheDocument()
    expect(within(section()).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(section()).queryByText(/Libros en común/)).not.toBeInTheDocument()
  })
})

describe('Gustos en común: loading, errors and the session', () => {
  it('shows its own loading state while the rest of the page is shown', async () => {
    const held = holdCalls(createMockClient(), 'getTasteCompatibility')
    renderApp({ path: '/estadisticas', client: held.client })

    await screen.findByRole('region', { name: 'Media de cada miembro' })
    expect(within(section()).getByRole('status')).toHaveTextContent('Cargando…')
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(within(section()).queryByRole('combobox')).not.toBeInTheDocument()
    held.release()
    expect(await within(section()).findByRole('combobox', { name: 'Comparar con' })).toHaveValue('m3')
    expect(within(section()).queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows its own error state, and «Reintentar» retries only this call', async () => {
    const user = userEvent.setup()
    const { tracked } = await openStatistics({ failures: { getTasteCompatibility: 1 } })

    const alert = within(section()).getByRole('alert')
    expect(alert).toHaveTextContent('No se ha podido cargar la comparación de gustos.')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    // The rest of the page is still there.
    expect(screen.getByRole('region', { name: 'Destacados' })).toBeInTheDocument()

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await within(section()).findByRole('combobox', { name: 'Comparar con' })).toHaveValue('m3')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['getStatistics', 'getTasteCompatibility', 'getTasteCompatibility'])
  })

  it('returns to the sign-in screen when getTasteCompatibility gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getTasteCompatibility')
    renderApp({ path: '/estadisticas', client: held.client })

    await screen.findByRole('region', { name: SECTION })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('No se ha podido cargar la comparación de gustos.')).not.toBeInTheDocument()
  })
})
