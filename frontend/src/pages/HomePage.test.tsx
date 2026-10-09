import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState, createEmptyState } from '../api/mock/fixtures'
import { createMockClient } from '../api/mock/mockClient'
import { renderApp } from '../test/renderApp'

// Each member's name and status as shown in the member progress section.
function progressEntries() {
  const progress = screen.getByRole('region', { name: 'Cómo va el club esta semana' })
  return within(progress)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')
}

describe('Inicio', () => {
  it('shows a loading message until the data arrives', async () => {
    renderApp()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    expect(screen.queryByRole('region', { name: 'Lectura de esta semana' })).not.toBeInTheDocument()

    expect(await screen.findByRole('heading', { name: 'La Regenta' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the sections in the homepage priority order, each with a heading', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'La Regenta' })
    const sections = within(screen.getByRole('main'))
      .getAllByRole('region')
      .map((section) => document.getElementById(section.getAttribute('aria-labelledby') ?? '')?.textContent)
    expect(sections).toEqual([
      'Leyendo ahora',
      'Lectura de esta semana',
      'Próxima reunión',
      'Cómo va el club esta semana',
      'Actividad reciente',
      'El club en números',
      'Una cita para hoy',
    ])
  })

  it('shows the current book with a link to its page', async () => {
    renderApp()

    const book = await screen.findByRole('region', { name: 'Leyendo ahora' })
    expect(within(book).getByRole('heading', { name: 'La Regenta' })).toBeInTheDocument()
    expect(book).toHaveTextContent('Leopoldo Alas «Clarín»')
    expect(within(book).getByRole('link', { name: 'Ver ficha del libro' })).toHaveAttribute('href', '/biblioteca/b3')
  })

  it('shows this week’s reading prominently', async () => {
    renderApp()

    const week = await screen.findByRole('region', { name: 'Lectura de esta semana' })
    expect(within(week).getByText('Semana 3')).toBeInTheDocument()
    expect(within(week).getByText('25–40 %')).toBeInTheDocument()
    expect(within(week).getByText('páginas 205–330')).toBeInTheDocument()
    expect(within(week).getByText('Para la reunión del jueves 15')).toBeInTheDocument()
  })

  it('marking the week read changes only the signed-in member', async () => {
    const user = userEvent.setup()
    renderApp()

    await screen.findByRole('heading', { name: 'La Regenta' })
    const before = progressEntries()
    // The fixture has other members both completed (Carmen, Jordi) and not.
    expect(before).toEqual([
      expect.stringContaining('LucíaLeyendo'),
      expect.stringContaining('MateoLeyendo'),
      expect.stringContaining('Carmen✓ Leído'),
      expect.stringContaining('PabloLeyendo'),
      expect.stringContaining('InésLeyendo'),
      expect.stringContaining('Jordi✓ Leído'),
      expect.stringContaining('ElenaLeyendo'),
    ])

    await user.click(screen.getByRole('button', { name: 'Marcar como leído' }))
    const undo = await screen.findByRole('button', { name: 'Desmarcar' })
    expect(undo).toHaveAttribute('aria-pressed', 'true')
    const after = progressEntries()
    expect(after[0]).toContain('Lucía✓ Leído')
    expect(after.slice(1)).toEqual(before.slice(1))

    await user.click(undo)
    expect(await screen.findByRole('button', { name: 'Marcar como leído' })).toHaveAttribute('aria-pressed', 'false')
    expect(progressEntries()).toEqual(before)
  })

  it('keeps the previous state and shows a gentle message when saving fails', async () => {
    const user = userEvent.setup()
    renderApp({ client: createMockClient({ random: () => 0, failures: { setWeekCompleted: Infinity } }) })

    await user.click(await screen.findByRole('button', { name: 'Marcar como leído' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar. Inténtalo de nuevo.')
    expect(screen.getByRole('button', { name: 'Marcar como leído' })).toHaveAttribute('aria-pressed', 'false')
    expect(progressEntries()[0]).toContain('LucíaLeyendo')
  })

  it('shows who has finished this week without ranking anyone', async () => {
    renderApp()

    await screen.findByRole('heading', { name: 'La Regenta' })
    const entries = progressEntries()
    expect(entries).toHaveLength(7)
    expect(entries.filter((entry) => entry.includes('✓ Leído'))).toHaveLength(2)
    expect(entries.join(' ')).not.toMatch(/\d/)
  })

  it('shows the next meeting with its date, assigned reading and link', async () => {
    renderApp()

    const meeting = await screen.findByRole('region', { name: 'Próxima reunión' })
    expect(within(meeting).getByText('jueves, 15 de octubre, 19:30')).toBeInTheDocument()
    expect(within(meeting).getByText('Semana 3 · 25–40 % · páginas 205–330')).toBeInTheDocument()
    expect(within(meeting).getByRole('link', { name: 'Ver reunión' })).toHaveAttribute('href', '/reuniones/mt3')
  })

  it('shows stats, newest activity first and a quote with its source', async () => {
    renderApp()

    const stats = await screen.findByRole('region', { name: 'El club en números' })
    const terms = within(stats).getAllByRole('term').map((el) => el.textContent)
    const values = within(stats).getAllByRole('definition').map((el) => el.textContent)
    expect(terms).toEqual(['libros leídos', 'valoraciones', 'miembros'])
    expect(values).toEqual(['2', '12', '7'])

    const activity = screen.getByRole('region', { name: 'Actividad reciente' })
    expect(within(activity).getAllByRole('listitem')[0]).toHaveTextContent(
      'Se ha publicado el resumen de la reunión de la semana 2.',
    )

    const quote = screen.getByRole('region', { name: 'Una cita para hoy' })
    expect(within(quote).getByText(/El que lee mucho y anda mucho/)).toBeInTheDocument()
    expect(within(quote).getByText('— Miguel de Cervantes, Don Quijote de la Mancha')).toBeInTheDocument()
  })

  it('says when there is no assignment this week while a book is being read', async () => {
    const state = createClubState()
    state.weeks = state.weeks.filter((week) => week.meetingId !== 'mt3')
    renderApp({ client: createMockClient({ state, random: () => 0 }) })

    expect(await screen.findByRole('heading', { name: 'La Regenta' })).toBeInTheDocument()
    const week = screen.getByRole('region', { name: 'Lectura de esta semana' })
    expect(within(week).getByText('Aún no se ha fijado la lectura de esta semana.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Marcar como leído|Desmarcar/ })).not.toBeInTheDocument()
    const meeting = screen.getByRole('region', { name: 'Próxima reunión' })
    expect(within(meeting).getByText('Todavía no hay lectura asignada para esta reunión.')).toBeInTheDocument()
  })

  it('has friendly empty states for a brand-new club', async () => {
    renderApp({ client: createMockClient({ state: createEmptyState() }) })

    expect(await screen.findByText(/Todavía no hay un libro en curso/)).toBeInTheDocument()
    expect(screen.getByText('Aún no se ha fijado la lectura de esta semana.')).toBeInTheDocument()
    expect(screen.getByText('No hay ninguna reunión programada.')).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay actividad en el club.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar como leído' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Una cita para hoy' })).not.toBeInTheDocument()
  })

  it('offers a retry when the page cannot load, keeping the navigation usable', async () => {
    const user = userEvent.setup()
    renderApp({ client: createMockClient({ random: () => 0, failures: { getHome: 1 } }) })

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido cargar esta página.')
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'La Regenta' })).toBeInTheDocument())
  })
})
