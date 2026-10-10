import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../api/client'
import { createClubState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import type { BookRatings } from '../api/types'
import { RADAR_CHART, radarPoints } from '../lib/radar'
import { holdCalls, trackCalls } from '../test/clients'
import { renderApp } from '../test/renderApp'

const { center, radius } = RADAR_CHART
const points = (values: number[]) => radarPoints(center, radius, values)

// Fixture «Cumbres borrascosas» (b2): the admin's (Lucía's) and Carmen's
// scores, and the unrounded club means of its four reviews.
const LUCIA = [5, 4.5, 3, 4, 2.5]
const CARMEN = [4, 5, 4.5, 3.5, 5]
const B2_MEANS = [4, 4.25, 4.125, 4, 3.875]

const HEADING = 'Comparación con el club'
const ratingsRegion = () => screen.getByRole('region', { name: 'Valoraciones' })
const comparison = () => within(ratingsRegion()).getByRole('region', { name: HEADING })

async function openRatings(bookId: string, options: MockOptions = {}, wrap: (client: ApiClient) => ApiClient = (c) => c) {
  const tracked = trackCalls(createMockClient(options))
  const result = renderApp({ path: `/biblioteca/${bookId}`, client: wrap(tracked.client) })
  await screen.findByRole('heading', { level: 1 })
  await waitFor(() => expect(within(ratingsRegion()).queryByText('Cargando…')).not.toBeInTheDocument())
  return { tracked, ...result }
}

const chart = (section: HTMLElement) => within(section).getByRole('img')
const series = (section: HTMLElement, name: 'member' | 'club') =>
  chart(section).querySelector(`polygon[data-series="${name}"]`)!
const legend = (section: HTMLElement) =>
  within(section)
    .getAllByRole('listitem')
    .map((li) => li.textContent)
const tableRows = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => [
      within(row).getByRole('rowheader').textContent,
      ...within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ])

// Nothing of the comparison is in the section.
function expectNoComparison() {
  const region = ratingsRegion()
  expect(within(region).queryByRole('heading', { name: HEADING })).not.toBeInTheDocument()
  expect(region.querySelector('svg')).toBeNull()
  expect(within(region).queryByRole('combobox')).not.toBeInTheDocument()
  expect(within(region).queryByLabelText('Miembro')).not.toBeInTheDocument()
  expect(within(region).queryByRole('table')).not.toBeInTheDocument()
  expect(region.textContent).not.toMatch(/Comparación|Gráfico|Media del club/)
}

describe('«Comparación con el club» is shown only with visible ratings', () => {
  it.each([
    ['locked and not finished', 'b3', 'admin'],
    ['locked and finished', 'b1', 'admin'],
    ['locked and not finished (member)', 'b2', 'member'],
    ['not ratable', 'b4', 'admin'],
  ] as const)('is absent when %s', async (_case, bookId, session) => {
    await openRatings(bookId, { session })
    expectNoComparison()
  })

  it('is absent while loading and after a load error', async () => {
    const held = holdCalls(createMockClient(), 'getBookRatings')
    const { unmount } = renderApp({ path: '/biblioteca/b2', client: held.client })
    await screen.findByRole('heading', { level: 1, name: 'Cumbres borrascosas' })
    expect(within(ratingsRegion()).getByRole('status')).toHaveTextContent('Cargando…')
    expectNoComparison()
    unmount()

    await openRatings('b2', { failures: { getBookRatings: 1 } })
    expect(within(ratingsRegion()).getByRole('alert')).toHaveTextContent('No se han podido cargar las valoraciones.')
    expectNoComparison()
  })

  it('sits after «Media del club» and before «Valoraciones de los miembros», labelled by its heading', async () => {
    await openRatings('b2')
    const headings = within(ratingsRegion())
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(headings).toEqual(['Tu valoración', 'Media del club', HEADING, 'Valoraciones de los miembros'])
    const section = comparison()
    expect(section.tagName).toBe('SECTION')
    expect(within(section).getByRole('heading', { level: 3, name: HEADING }).id).toBe(
      section.getAttribute('aria-labelledby'),
    )
  })
})

describe('«Comparación con el club» once visible', () => {
  it('defaults to the user’s own review and offers every member who rated, in the server’s order', async () => {
    await openRatings('b2')
    const section = comparison()
    const select = within(section).getByRole('combobox', { name: 'Miembro' })
    expect(select.tagName).toBe('SELECT')
    expect(within(section).getByText('Miembro').tagName).toBe('LABEL')
    const options = within(select).getAllByRole('option') as HTMLOptionElement[]
    expect(options.map((o) => o.textContent)).toEqual(['Lucía (tú)', 'Carmen', 'Inés', 'Jordi'])
    expect(options.map((o) => o.value)).toEqual(['m1', 'm3', 'm5', 'm6'])
    expect(select).toHaveValue('m1')
    expect(within(select).getByRole('option', { name: 'Lucía (tú)' })).toHaveProperty('selected', true)
  })

  it('draws the radar from the unrounded scores and means, with its accessible name', async () => {
    await openRatings('b2')
    const section = comparison()
    const svg = chart(section)
    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(svg).toHaveAccessibleName(
      'Gráfico radar: puntuaciones de Lucía comparadas con la media del club. Los valores están en la tabla siguiente.',
    )
    expect(section.querySelectorAll('svg[role="img"]')).toHaveLength(1)

    expect(series(section, 'member')).toHaveAttribute('points', points(LUCIA))
    expect(series(section, 'club')).toHaveAttribute('points', points(B2_MEANS))
    // Personajes 4.125 is drawn as 4.125, not as the displayed 4,1.
    expect(series(section, 'club').getAttribute('points')).not.toBe(points([4, 4.3, 4.1, 4, 3.9]))

    expect([...svg.querySelectorAll('[data-axis]')].map((t) => t.textContent)).toEqual([
      'Disfrute',
      'Estilo',
      'Personajes',
      'Trama',
      'Huella',
    ])
    expect(svg.querySelectorAll('line')).toHaveLength(5)
    expect([...svg.querySelectorAll('polygon[data-ring]')].map((p) => p.getAttribute('data-ring'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ])
    expect(
      [...svg.querySelectorAll('text:not([data-axis])')].map((t) => t.textContent),
    ).toEqual(['1', '2', '3', '4', '5'])
  })

  it('tells the two series apart by more than colour, and has nothing focusable or animated', async () => {
    await openRatings('b2')
    const section = comparison()
    const svg = chart(section)
    const member = series(section, 'member')
    const club = series(section, 'club')
    expect(member).not.toHaveAttribute('stroke-dasharray')
    expect(club).toHaveAttribute('stroke-dasharray')
    expect(Number(member.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(2)
    expect(Number(club.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(2)
    expect(club).toHaveAttribute('fill', 'none')
    expect(member.getAttribute('class')).toMatch(/fill-forest\/10/)
    expect(svg.querySelectorAll('circle[data-marker="member"]')).toHaveLength(5)
    expect(svg.querySelectorAll('rect[data-marker="club"]')).toHaveLength(5)

    expect(svg.querySelectorAll('a, button, input, select, [tabindex], title, animate, animateTransform')).toHaveLength(0)
    expect(section.innerHTML).not.toMatch(/transition|animate/)
  })

  it('shows a visible legend with both series', async () => {
    await openRatings('b2')
    expect(legend(comparison())).toEqual(['Lucía (tú)', 'Media del club'])
  })

  it('shows the same values in a table, with scores and means formatted', async () => {
    await openRatings('b2')
    const section = comparison()
    const table = within(section).getByRole('table', {
      name: 'Puntuaciones de Lucía y media del club por criterio (4 valoraciones)',
    })
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Criterio',
      'Lucía',
      'Media del club',
    ])
    expect(tableRows(table)).toEqual([
      ['Disfrute', '5', '4,0'],
      ['Estilo', '4,5', '4,3'],
      ['Personajes', '3', '4,1'],
      ['Trama', '4', '4,0'],
      ['Huella', '2,5', '3,9'],
    ])
    expect(section.textContent).not.toMatch(/NaN|null|undefined|Infinity|(^|[^,\d])0 ?\/ ?5/)
  })

  it('updates the chart, legend, name and table when another member is chosen, keeping focus', async () => {
    const user = userEvent.setup()
    await openRatings('b2')
    const select = within(comparison()).getByRole('combobox', { name: 'Miembro' })
    select.focus()

    await user.selectOptions(select, 'Carmen')

    const section = comparison()
    expect(select).toHaveFocus()
    expect(select).toHaveValue('m3')
    expect(series(section, 'member')).toHaveAttribute('points', points(CARMEN))
    expect(series(section, 'club')).toHaveAttribute('points', points(B2_MEANS))
    expect(chart(section)).toHaveAccessibleName(
      'Gráfico radar: puntuaciones de Carmen comparadas con la media del club. Los valores están en la tabla siguiente.',
    )
    expect(legend(section)).toEqual(['Carmen', 'Media del club'])
    const table = within(section).getByRole('table', {
      name: 'Puntuaciones de Carmen y media del club por criterio (4 valoraciones)',
    })
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Criterio',
      'Carmen',
      'Media del club',
    ])
    expect(tableRows(table)).toEqual([
      ['Disfrute', '4', '4,0'],
      ['Estilo', '5', '4,3'],
      ['Personajes', '4,5', '4,1'],
      ['Trama', '3,5', '4,0'],
      ['Huella', '5', '3,9'],
    ])
  })

  it('makes no client call when choosing members', async () => {
    const user = userEvent.setup()
    const alone = await openRatings('b2')
    const callsAlone = alone.tracked.clubDataCalls()
    expect(callsAlone).toEqual(['getBook', 'getBookRatings'])
    alone.unmount()

    const { tracked } = await openRatings('b2')
    const select = within(comparison()).getByRole('combobox', { name: 'Miembro' })
    for (const option of ['Carmen', 'Inés', 'Jordi', 'Lucía (tú)']) {
      await user.selectOptions(select, option)
      expect(within(select).getByRole('option', { name: option })).toHaveProperty('selected', true)
    }
    expect(tracked.clubDataCalls()).toEqual(callsAlone)
  })

  it('offers the member’s own review first on «Niebla», in the server’s order', async () => {
    await openRatings('b1', { session: 'member' })
    const section = comparison()
    const select = within(section).getByRole('combobox', { name: 'Miembro' })
    expect(select).toHaveValue('m2')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Mateo (tú)', 'Elena', 'Pablo'])
    expect(legend(section)).toEqual(['Mateo (tú)', 'Media del club'])
    expect(series(section, 'member')).toHaveAttribute('points', points([4, 4.5, 3.5, 3, 4]))
    expect(within(section).getByRole('table')).toHaveAccessibleName(
      'Puntuaciones de Mateo y media del club por criterio (3 valoraciones)',
    )
  })

  it('shows no selector with n = 1, and draws both shapes on the same points', async () => {
    const state = createClubState()
    state.finished.b6 = ['m1']
    state.reviews.push({
      bookId: 'b6',
      userId: 'm1',
      scores: { disfrute: 4, estilo: 3.5, personajes: 5, trama: 2, huella: 4.5 },
      text: null,
      submittedAt: state.now,
      editedAt: null,
    })
    await openRatings('b6', { state })
    const section = comparison()
    expect(within(section).queryByRole('combobox')).not.toBeInTheDocument()
    expect(section).toHaveTextContent('Por ahora solo está tu valoración, así que coincide con la media del club.')
    const values = [4, 3.5, 5, 2, 4.5]
    expect(series(section, 'member')).toHaveAttribute('points', points(values))
    expect(series(section, 'club')).toHaveAttribute('points', points(values))
    expect(legend(section)).toEqual(['Lucía (tú)', 'Media del club'])
    const table = within(section).getByRole('table', {
      name: 'Puntuaciones de Lucía y media del club por criterio (1 valoración)',
    })
    expect(tableRows(table)).toEqual([
      ['Disfrute', '4', '4,0'],
      ['Estilo', '3,5', '3,5'],
      ['Personajes', '5', '5,0'],
      ['Trama', '2', '2,0'],
      ['Huella', '4,5', '4,5'],
    ])
  })

  it('goes back to the user’s own review after the section reloads', async () => {
    const user = userEvent.setup()
    const { router } = await openRatings('b2')
    await user.selectOptions(within(comparison()).getByRole('combobox', { name: 'Miembro' }), 'Carmen')
    expect(within(comparison()).getByRole('combobox', { name: 'Miembro' })).toHaveValue('m3')

    await user.click(within(ratingsRegion()).getByRole('link', { name: 'Editar mi valoración' }))
    await user.click(await screen.findByRole('button', { name: 'Guardar valoración' }))

    expect(await screen.findByText('Tu valoración se ha guardado.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/biblioteca/b2')
    const section = comparison()
    expect(within(section).getByRole('combobox', { name: 'Miembro' })).toHaveValue('m1')
    expect(series(section, 'member')).toHaveAttribute('points', points(LUCIA))
  })

  it('is identical for the admin and a member given the same visible ratings', async () => {
    // One visible result, served to both sessions: the subsection has no role input.
    const fixture: BookRatings = await createMockClient().getBookRatings('b2')
    const withFixture = (session: 'admin' | 'member') => {
      const client = createMockClient({ session })
      return new Proxy(client, {
        get: (target, property, receiver) =>
          property === 'getBookRatings' ? async () => fixture : Reflect.get(target, property, receiver),
      })
    }

    const admin = renderApp({ path: '/biblioteca/b2', client: withFixture('admin') })
    const asAdmin = (await screen.findByRole('region', { name: HEADING })).innerHTML.replace(/_r_\w+_/g, '')
    expect(asAdmin).toContain('Lucía (tú)')
    admin.unmount()

    renderApp({ path: '/biblioteca/b2', client: withFixture('member') })
    const asMember = (await screen.findByRole('region', { name: HEADING })).innerHTML.replace(/_r_\w+_/g, '')
    expect(asMember).toBe(asAdmin)
  })
})
