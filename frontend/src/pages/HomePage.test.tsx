import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { createEmptyState } from '../api/mock/fixtures'
import { createMockClient } from '../api/mock/mockClient'
import { renderApp } from '../test/renderApp'

describe('Inicio', () => {
  it('shows the current book and this week’s reading prominently', async () => {
    renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'La Regenta' })).toBeInTheDocument()
    const week = screen.getByRole('region', { name: 'Lectura de esta semana' })
    expect(within(week).getByText('Semana 3')).toBeInTheDocument()
    expect(within(week).getByText('25–40 %')).toBeInTheDocument()
    expect(within(week).getByText('páginas 205–330')).toBeInTheDocument()
    expect(within(week).getByText('Para la reunión del jueves 15')).toBeInTheDocument()
  })

  it('lets the member mark the week as read and undo it', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(await screen.findByRole('button', { name: 'Marcar como leído' }))
    const undo = await screen.findByRole('button', { name: 'Desmarcar' })
    expect(undo).toHaveAttribute('aria-pressed', 'true')

    await user.click(undo)
    expect(await screen.findByRole('button', { name: 'Marcar como leído' })).toBeInTheDocument()
  })

  it('shows a gentle message when saving fails', async () => {
    const client = createMockClient()
    vi.spyOn(client, 'setWeekCompleted').mockRejectedValue(new ApiError(500, 'boom'))
    renderApp({ client })

    await userEvent.click(await screen.findByRole('button', { name: 'Marcar como leído' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar')
  })

  it('shows who has finished this week without ranking anyone', async () => {
    renderApp()

    const progress = await screen.findByRole('region', { name: 'Cómo va el club esta semana' })
    expect(within(progress).getAllByRole('listitem')).toHaveLength(7)
    expect(within(progress).getAllByText('✓ Leído')).toHaveLength(2)
  })

  it('shows the next meeting, stats, activity and a quote', async () => {
    renderApp()

    const meeting = await screen.findByRole('region', { name: 'Próxima reunión' })
    expect(within(meeting).getByText(/15 de octubre, 19:30/i)).toBeInTheDocument()
    const stats = screen.getByRole('region', { name: 'El club en números' })
    const terms = within(stats).getAllByRole('term').map((el) => el.textContent)
    const values = within(stats).getAllByRole('definition').map((el) => el.textContent)
    expect(terms).toEqual(['libros leídos', 'valoraciones', 'miembros'])
    expect(values).toEqual(['2', '12', '7'])
    expect(screen.getByText('«La Regenta» es el nuevo libro del club.')).toBeInTheDocument()
    expect(screen.getByText(/Miguel de Cervantes/)).toBeInTheDocument()
  })

  it('has friendly empty states for a brand-new club', async () => {
    renderApp({ client: createMockClient({ state: createEmptyState() }) })

    expect(await screen.findByText(/Todavía no hay un libro en curso/)).toBeInTheDocument()
    expect(screen.getByText('No hay ninguna reunión programada.')).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay actividad en el club.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar como leído' })).not.toBeInTheDocument()
  })

  it('offers a retry when the page cannot load', async () => {
    const client = createMockClient()
    vi.spyOn(client, 'getHome').mockRejectedValueOnce(new ApiError(500, 'boom'))
    renderApp({ client })

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'La Regenta' })).toBeInTheDocument()
  })
})
