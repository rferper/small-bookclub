import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClubState } from '../api/mock/fixtures'
import { createMockClient } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

const control = (week: number) => screen.getByRole('button', { name: new RegExp(`Semana ${week}:`) })

describe('book weekly completion controls', () => {
  it('saves a past week and persists when leaving and returning, without changing other weeks', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient())
    const { router } = renderApp({ path: '/biblioteca/b3', client: tracked.client })
    await screen.findByRole('heading', { name: 'Plan de lectura' })
    expect(control(1)).toHaveAttribute('aria-pressed', 'true')
    expect(control(2)).toHaveAttribute('aria-pressed', 'false')
    await user.click(control(2))
    await waitFor(() => expect(control(2)).toHaveAttribute('aria-pressed', 'true'))
    expect(control(1)).toHaveAttribute('aria-pressed', 'true')
    expect(control(3)).toHaveAttribute('aria-pressed', 'false')
    expect(tracked.calls.filter((call) => call === 'setWeekCompleted')).toHaveLength(1)
    await user.click(screen.getByRole('link', { name: '← Volver a la biblioteca' }))
    await act(() => router.navigate('/biblioteca/b3'))
    await screen.findByRole('heading', { name: 'Plan de lectura' })
    expect(control(2)).toHaveAttribute('aria-pressed', 'true')
    await user.click(control(2))
    await waitFor(() => expect(control(2)).toHaveAttribute('aria-pressed', 'false'))
  })

  it('disables only the saving week, keeps its confirmed state and sends no duplicate', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient(), 'setWeekCompleted')
    const tracked = trackCalls(held.client)
    renderApp({ path: '/biblioteca/b3', client: tracked.client })
    await screen.findByRole('heading', { name: 'Plan de lectura' })
    await user.click(control(2))
    expect(control(2)).toBeDisabled()
    expect(control(2)).toHaveAttribute('aria-pressed', 'false')
    expect(control(2)).toHaveTextContent('Guardando…')
    expect(control(3)).toBeEnabled()
    await user.click(control(2))
    expect(tracked.calls.filter((call) => call === 'setWeekCompleted')).toHaveLength(1)
    held.release()
    await waitFor(() => expect(control(2)).toBeEnabled())
    expect(control(2)).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps a confirmed completed state on failure with a local alert and retry', async () => {
    const user = userEvent.setup()
    renderApp({ path: '/biblioteca/b3', client: createMockClient({ failures: { setWeekCompleted: 1 } }) })
    await screen.findByRole('heading', { name: 'Plan de lectura' })
    await user.click(control(1))
    const week = control(1).closest('li')!
    expect(await within(week).findByRole('alert')).toHaveTextContent('No se ha podido guardar. Inténtalo de nuevo.')
    expect(control(1)).toHaveAttribute('aria-pressed', 'true')
    expect(control(1)).toBeEnabled()
    await user.click(control(1))
    await waitFor(() => expect(control(1)).toHaveAttribute('aria-pressed', 'false'))
    expect(within(week).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('handles an expired session through the existing sign-in handler', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    renderApp({ path: '/biblioteca/b3', client: createMockClient({ state }) })
    await screen.findByRole('heading', { name: 'Plan de lectura' })
    state.session = 'anonymous'
    await user.click(control(2))
    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(state.completions.w2).not.toContain('m1')
  })

  it('does not carry a pending action into another book with no schedule', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient(), 'setWeekCompleted')
    const { router } = renderApp({ path: '/biblioteca/b3', client: held.client })
    await screen.findByRole('heading', { name: 'Plan de lectura' })
    await user.click(control(2))
    await act(() => router.navigate('/biblioteca/b1'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Niebla' })).toBeInTheDocument()
    held.release()
    expect(screen.getByText('Este libro no tiene un plan de lectura semanal.')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Plan de lectura' })).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('Guardando…')).not.toBeInTheDocument()
  })
})
