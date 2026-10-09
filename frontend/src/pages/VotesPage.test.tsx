import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { applyVoteScenario, createClubState, createEmptyState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

async function openVotes(options: MockOptions = {}) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: '/votaciones', client: tracked.client })
  await screen.findByRole('region', { name: 'Votaciones anteriores' })
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

const region = (name: string) => screen.getByRole('region', { name })
const historyLinks = () => within(region('Votaciones anteriores')).queryAllByRole('link')

function expectNoBrokenValues(main: HTMLElement) {
  expect(main.textContent).not.toMatch(/null|undefined|NaN|Invalid Date/)
}

describe('Votaciones', () => {
  it('shows the curator, the open vote in full and the history, in an outline of headings', async () => {
    const { main, tracked } = await openVotes()

    expect(screen.getByRole('link', { name: 'Votaciones' })).toHaveAttribute('aria-current', 'page')
    expect(
      within(main)
        .getAllByRole('heading')
        .map((h) => [h.tagName, h.textContent]),
    ).toEqual([
      ['H1', 'Votaciones'],
      ['H2', 'Votación actual'],
      ['H3', 'Libros candidatos'],
      ['H2', 'Votaciones anteriores'],
    ])
    expect(main).toHaveTextContent('Curaduría actual: Jordi')

    const current = region('Votación actual')
    expect(within(current).getByRole('link', { name: 'Votación de Jordi' })).toHaveAttribute('href', '/votaciones/v2')
    expect(current).toHaveTextContent('EstadoAbierta')
    expect(current).toHaveTextContent('Abierta el30 de septiembre de 2026')
    expect(within(current).getAllByRole('checkbox')).toHaveLength(4)
    expect(within(current).getByRole('checkbox', { name: 'Votar por «Los pazos de Ulloa»' })).toBeChecked()
    expect(within(current).getByRole('list', { name: 'Votos de «Marianela»' })).toHaveTextContent('Carmen')
    expect(current).toHaveTextContent('5 votos')
    expect(tracked.clubDataCalls()).toEqual(['getVotes'])
    expectNoBrokenValues(main)
  })

  it('lists earlier votes most recently closed first, each as one link with the curator, date and winner', async () => {
    await openVotes()

    const items = within(region('Votaciones anteriores')).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    for (const item of items) expect(within(item).getAllByRole('link')).toHaveLength(1)
    expect(historyLinks().map((link) => [link.getAttribute('href'), link.textContent])).toEqual([
      ['/votaciones/v1', 'Votación de CarmenCerrada el 14 de septiembre de 2026Libro elegido: «La Regenta»'],
      ['/votaciones/v0', 'Votación de PabloCerrada el 26 de septiembre de 2024Libro elegido: «Cumbres borrascosas»'],
    ])
    expect(historyLinks()[0]).toHaveAccessibleName(/Votación de Carmen.*14 de septiembre de 2026/)
    expect(historyLinks()[0].querySelector('time')).toHaveAttribute('dateTime', '2026-09-14T21:00:00+02:00')
  })

  it('says warmly when nobody has been chosen as curator', async () => {
    const state = createClubState()
    state.curatorId = null
    const { main } = await openVotes({ state })

    expect(main).toHaveTextContent('Todavía no se ha elegido a nadie para proponer los próximos libros.')
    expect(main).not.toHaveTextContent('Curaduría actual')
    expectNoBrokenValues(main)
  })

  it('shows a draft current vote read-only', async () => {
    await openVotes({ state: applyVoteScenario(createClubState(), 'draft') })

    const current = region('Votación actual')
    expect(current).toHaveTextContent('EstadoEn preparación')
    expect(current).toHaveTextContent('La votación todavía no está abierta.')
    expect(current).toHaveTextContent('Marianela')
    expect(within(current).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(current).not.toHaveTextContent(/voto/)
  })

  it('says when there is no current vote', async () => {
    const { main } = await openVotes({ state: applyVoteScenario(createClubState(), 'none') })

    expect(region('Votación actual')).toHaveTextContent('Ahora mismo no hay ninguna votación abierta.')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(main).toHaveTextContent('Curaduría actual: Jordi')
    expect(historyLinks()).toHaveLength(2)
  })

  it('heads the history with a pending tie, in text', async () => {
    await openVotes({ state: applyVoteScenario(createClubState(), 'tie') })

    expect(region('Votación actual')).toHaveTextContent('Ahora mismo no hay ninguna votación abierta.')
    expect(historyLinks()[0]).toHaveTextContent('Votación de JordiCerrada el 7 de octubre de 2026Empate pendiente de decidir')
    expect(historyLinks()[0]).toHaveAttribute('href', '/votaciones/v2')
    expect(historyLinks()[0]).not.toHaveTextContent('Libro elegido')
  })

  it('shows calm messages for a club with no curator, no vote and no history', async () => {
    const { main } = await openVotes({ state: createEmptyState() })

    expect(main).toHaveTextContent('Todavía no se ha elegido a nadie para proponer los próximos libros.')
    expect(region('Votación actual')).toHaveTextContent('Ahora mismo no hay ninguna votación abierta.')
    expect(region('Votaciones anteriores')).toHaveTextContent(
      'Todavía no hay votaciones anteriores. Cuando se cierre la primera, aparecerá aquí.',
    )
    expect(within(main).queryByRole('list')).not.toBeInTheDocument()
    expect(within(main).queryByRole('link')).not.toBeInTheDocument()
    expectNoBrokenValues(main)
  })

  it('lets the user vote on the current vote', async () => {
    const user = userEvent.setup()
    const { tracked } = await openVotes({ session: 'member' })

    const current = region('Votación actual')
    await user.click(within(current).getByRole('checkbox', { name: 'Votar por «Marianela»' }))
    await waitFor(() => expect(current).toHaveTextContent('6 votos'))
    expect(within(current).getByRole('list', { name: 'Votos de «Marianela»' })).toHaveTextContent('Mateo')
    expect(within(current).getByRole('status')).toHaveTextContent('Has votado «Marianela». Ahora tiene 6 votos.')
    expect(tracked.clubDataCalls()).toEqual(['getVotes', 'setApproval'])
  })

  it('reloads calmly when the current vote closes before a change is saved', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    const { tracked } = await openVotes({ state })

    applyVoteScenario(state, 'tie')
    await user.click(screen.getByRole('checkbox', { name: 'Votar por «Marianela»' }))

    expect(
      await screen.findByText('Esta votación ya no está abierta, así que tu cambio no se ha guardado. Aquí tienes cómo ha quedado.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(region('Votación actual')).toHaveTextContent('Ahora mismo no hay ninguna votación abierta.'))
    expect(historyLinks()[0]).toHaveTextContent('Empate pendiente de decidir')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['getVotes', 'setApproval', 'getVotes'])
  })

  it('shows a loading message, and a retry when the votes cannot be loaded', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient({ failures: { getVotes: 1 } }))
    const held = holdCalls(tracked.client, 'getVotes')
    renderApp({ path: '/votaciones', client: held.client })

    expect(await screen.findByRole('heading', { level: 1, name: 'Votaciones' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    held.release()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('region', { name: 'Votaciones anteriores' })).toBeInTheDocument()
    expect(screen.queryByText('No se ha podido cargar esta página.')).not.toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['getVotes', 'getVotes'])
  })

  it('returns to the sign-in screen when getVotes gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getVotes')
    renderApp({ path: '/votaciones', client: held.client })

    await screen.findByRole('heading', { level: 1, name: 'Votaciones' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('Jordi', { exact: false })).not.toBeInTheDocument()
  })

  it('looks the same for a member, the curator and the admin, with no management controls', async () => {
    const texts: string[] = []
    for (const session of ['admin', 'member', 'curator'] as const) {
      const { main, unmount } = await openVotes({ session })
      texts.push(main.textContent!)
      expect(within(main).queryByRole('button')).not.toBeInTheDocument()
      unmount()
    }
    expect(texts[1]).toBe(texts[0])
    expect(texts[2]).toBe(texts[0])
  })
})
