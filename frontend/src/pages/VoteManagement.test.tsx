import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { applyVoteScenario, createClubState, createEmptyState, type VoteScenario } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { VOTE_CHANGED_MEANWHILE } from '../lib/votes'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

// Vote management on the vote page and Votaciones (#91). Fixture v2 is
// Jordi's open vote: «Marianela» (5 votes), «Los pazos de Ulloa» (2), «La
// gaviota» (0) and the long «Buscón» title (1). «Doña Perfecta» and
// «Sotileza» are the «Propuesto» books that are in no vote.

const BUSCON = 'La vida del Buscón llamado don Pablos, ejemplo de vagamundos y espejo de tacaños'

const stateFor = (scenario?: VoteScenario) => {
  const state = createClubState()
  return scenario ? applyVoteScenario(state, scenario) : state
}

async function openVote(voteId: string, options: MockOptions = {}) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: `/votaciones/${voteId}`, client: tracked.client })
  await screen.findByRole('link', { name: '← Volver a Votaciones' })
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

// Opens a vote the user manages, once the books to add have loaded.
async function openManaged(voteId: string, options: MockOptions = {}) {
  const opened = await openVote(voteId, options)
  await waitFor(() => expect(addRegion()).not.toHaveTextContent('Cargando'))
  return opened
}

async function openVotes(options: MockOptions = {}) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: '/votaciones', client: tracked.client })
  await screen.findByRole('region', { name: 'Votaciones anteriores' })
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

const region = (name: string) => screen.getByRole('region', { name })
const manage = () => region('Gestionar la votación')
const queryManage = () => screen.queryByRole('region', { name: 'Gestionar la votación' })
const addRegion = () => within(manage()).getByRole('region', { name: 'Añadir libros' })
const shortlistRegion = () => within(manage()).getByRole('region', { name: 'Lista de libros' })
// Titles in the management shortlist, in order.
const shortlist = () =>
  within(shortlistRegion())
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('p span')?.textContent?.replace(/^\d+\. /, ''))
// Titles in the #66 view of the vote, in order.
const viewTitles = () =>
  within(region('Libros candidatos'))
    .getAllByRole('listitem')
    .filter((li) => li.querySelector('a'))
    .map((li) => within(li).getAllByRole('link')[0].textContent)
const addable = () =>
  within(addRegion())
    .queryAllByRole('button')
    .map((b) => b.textContent)
const button = (name: string) => screen.getByRole('button', { name })
const status = () => within(manage()).getAllByRole('status')[0]
const facts = (main: HTMLElement) =>
  within(main)
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent])
const managementCalls = (calls: string[]) =>
  calls.filter((c) =>
    ['createVote', 'addCandidate', 'removeCandidate', 'reorderCandidates', 'openVote', 'closeVote', 'recordTieWinner'].includes(c),
  )

describe('Vote management: who sees the controls', () => {
  it('never shows management controls to a member, in any scenario', async () => {
    for (const scenario of [undefined, 'draft', 'tie', 'none', 'open-tie'] as const) {
      const votes = await openVotes({ session: 'member', state: stateFor(scenario) })
      expect(screen.queryByRole('button', { name: 'Preparar una votación' })).not.toBeInTheDocument()
      expect(votes.main).not.toHaveTextContent(/primero hay que asignar la curaduría/)
      votes.unmount()

      for (const voteId of scenario === 'none' ? ['v1', 'v0'] : ['v2', 'v1', 'v0']) {
        const { main, unmount, tracked } = await openVote(voteId, { session: 'member', state: stateFor(scenario) })
        expect(queryManage()).not.toBeInTheDocument()
        expect(within(main).queryByRole('button')).not.toBeInTheDocument()
        expect(within(main).queryByRole('radio')).not.toBeInTheDocument()
        expect(within(main).queryByRole('dialog')).not.toBeInTheDocument()
        expect(main).not.toHaveTextContent(/Registrar el libro elegido|la administración registrará|Gestionar/)
        expect(tracked.clubDataCalls()).toEqual(['getVote'])
        unmount()
      }
    }
  })

  it('shows the management section to the curator and the admin only on a draft or open vote', async () => {
    for (const session of ['curator', 'admin'] as const) {
      for (const [scenario, voteId, shown] of [
        [undefined, 'v2', true],
        ['draft', 'v2', true],
        ['open-tie', 'v2', true],
        ['tie', 'v2', false],
        [undefined, 'v1', false],
        [undefined, 'v0', false],
      ] as const) {
        const { unmount } = await openVote(voteId, { session, state: stateFor(scenario) })
        if (shown) expect(manage()).toBeInTheDocument()
        else expect(queryManage()).not.toBeInTheDocument()
        unmount()
      }
    }
  })

  it('shows no management controls on Votaciones, only the link to the vote page', async () => {
    const { main } = await openVotes({ session: 'curator' })
    expect(queryManage()).not.toBeInTheDocument()
    expect(within(main).queryByRole('button')).not.toBeInTheDocument()
    expect(within(region('Votación actual')).getByRole('link', { name: 'Votación de Jordi' })).toHaveAttribute(
      'href',
      '/votaciones/v2',
    )
  })
})

describe('Vote management: starting a vote', () => {
  it.each(['admin', 'curator'] as const)('lets the %s prepare a vote and opens its page', async (session) => {
    const user = userEvent.setup()
    const { tracked, router } = await openVotes({ session, state: stateFor('none') })

    const current = region('Votación actual')
    expect(current).toHaveTextContent('Ahora mismo no hay ninguna votación abierta.')
    await user.click(within(current).getByRole('button', { name: 'Preparar una votación' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Votación de Jordi' })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/votaciones\/v\d+$/)
    expect(router.state.location.pathname).not.toMatch(/\/v[01]$/)
    expect(managementCalls(tracked.calls)).toEqual(['createVote'])
    expect(facts(screen.getByRole('main'))).toEqual([['Estado', 'En preparación']])
    expect(await within(manage()).findByText('Todavía no hay libros en la lista.')).toBeInTheDocument()
    // Members see a matching empty message instead of an empty list.
    expect(region('Libros candidatos')).toHaveTextContent('Todavía no hay libros en la lista.')
    expect(within(region('Libros candidatos')).queryByRole('list')).not.toBeInTheDocument()
  })

  it('disables the button while the vote is being created', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient({ state: stateFor('none') }), 'createVote')
    renderApp({ path: '/votaciones', client: held.client })

    await user.click(await screen.findByRole('button', { name: 'Preparar una votación' }))
    expect(button('Preparar una votación')).toBeDisabled()
    held.release()
    expect(await screen.findByRole('heading', { level: 1, name: 'Votación de Jordi' })).toBeInTheDocument()
  })

  it('shows an alert next to the button and stays on Votaciones when creating fails', async () => {
    const user = userEvent.setup()
    const { router } = await openVotes({ state: stateFor('none'), failures: { createVote: 1 } })

    await user.click(button('Preparar una votación'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se ha podido preparar la votación. Inténtalo de nuevo.')
    expect(region('Votación actual')).toContainElement(alert)
    expect(router.state.location.pathname).toBe('/votaciones')
    expect(button('Preparar una votación')).toBeEnabled()
  })

  it('offers no button while a vote is draft or open', async () => {
    for (const scenario of [undefined, 'draft'] as const) {
      const { unmount } = await openVotes({ state: stateFor(scenario) })
      expect(screen.queryByRole('button', { name: 'Preparar una votación' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('tells the admin to assign a curator first when there is none, with no button', async () => {
    const { main } = await openVotes({ state: createEmptyState() })
    expect(screen.queryByRole('button', { name: 'Preparar una votación' })).not.toBeInTheDocument()
    expect(main).toHaveTextContent('Para preparar una votación, primero hay que asignar la curaduría en Administración.')
  })

  it('does not show that hint to a member when there is no curator', async () => {
    const state = createClubState()
    state.curatorId = null
    state.votes = state.votes.filter((v) => v.id !== 'v2')
    const { main } = await openVotes({ session: 'member', state })
    expect(main).not.toHaveTextContent(/asignar la curaduría/)
    expect(screen.queryByRole('button', { name: 'Preparar una votación' })).not.toBeInTheDocument()
  })
})

describe('Vote management: the shortlist', () => {
  it('lists the candidates in order, with move and remove buttons named by title', async () => {
    const { main } = await openManaged('v2', { session: 'curator' })

    expect(shortlist()).toEqual(['Marianela', 'Los pazos de Ulloa', 'La gaviota', BUSCON])
    expect(within(shortlistRegion()).getByRole('list').tagName).toBe('OL')
    for (const title of ['Marianela', 'Los pazos de Ulloa', 'La gaviota', BUSCON]) {
      for (const action of ['Subir', 'Bajar', 'Quitar']) expect(button(`${action} «${title}»`)).toBeInTheDocument()
    }
    expect(button('Subir «Marianela»')).toBeDisabled()
    expect(button(`Bajar «${BUSCON}»`)).toBeDisabled()
    expect(button('Bajar «Marianela»')).toBeEnabled()
    expect(button(`Subir «${BUSCON}»`)).toBeEnabled()
    expect(
      within(main)
        .getAllByRole('heading')
        .map((h) => [h.tagName, h.textContent]),
    ).toEqual([
      ['H1', 'Votación de Jordi'],
      ['H2', 'Libros candidatos'],
      ['H2', 'Gestionar la votación'],
      ['H3', 'Lista de libros'],
      ['H3', 'Añadir libros'],
    ])
  })

  it('moves a candidate up and down with one call each, announcing the new position', async () => {
    const user = userEvent.setup()
    const { tracked } = await openManaged('v2', { session: 'curator' })

    await user.click(button('Subir «La gaviota»'))
    await waitFor(() => expect(shortlist()).toEqual(['Marianela', 'La gaviota', 'Los pazos de Ulloa', BUSCON]))
    expect(viewTitles()).toEqual(['Marianela', 'La gaviota', 'Los pazos de Ulloa', BUSCON])
    expect(status()).toHaveTextContent('«La gaviota» está ahora en el puesto 2 de 4.')
    expect(button('Subir «La gaviota»')).toHaveFocus()
    expect(managementCalls(tracked.calls)).toEqual(['reorderCandidates'])

    // Reaching the top, focus moves to the button that can still be used.
    await user.click(button('Subir «La gaviota»'))
    await waitFor(() => expect(shortlist()[0]).toBe('La gaviota'))
    expect(button('Subir «La gaviota»')).toBeDisabled()
    expect(button('Bajar «La gaviota»')).toHaveFocus()
    expect(status()).toHaveTextContent('«La gaviota» está ahora en el puesto 1 de 4.')

    await user.click(button('Bajar «Los pazos de Ulloa»'))
    await waitFor(() => expect(shortlist()).toEqual(['La gaviota', 'Marianela', BUSCON, 'Los pazos de Ulloa']))
    expect(button('Subir «Los pazos de Ulloa»')).toHaveFocus()
    expect(status()).toHaveTextContent('«Los pazos de Ulloa» está ahora en el puesto 4 de 4.')
    expect(managementCalls(tracked.calls)).toEqual(['reorderCandidates', 'reorderCandidates', 'reorderCandidates'])
    // Approvals move with their book.
    expect(within(region('Libros candidatos')).getAllByRole('listitem').find((li) => li.textContent?.includes('Los pazos'))).toHaveTextContent(
      '2 votos',
    )
  })

  it('works with the keyboard alone', async () => {
    const user = userEvent.setup()
    await openManaged('v2', { session: 'curator' })

    button('Bajar «Marianela»').focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(shortlist()[1]).toBe('Marianela'))
    expect(button('Bajar «Marianela»')).toHaveFocus()
    await user.keyboard(' ')
    await waitFor(() => expect(shortlist()[2]).toBe('Marianela'))
  })
})

describe('Vote management: adding books', () => {
  it('offers only «Propuesto» books that are not candidates, with their authors', async () => {
    await openManaged('v2', { session: 'curator' })

    expect(addable()).toEqual(['Añadir «Doña Perfecta»', 'Añadir «Sotileza»'])
    expect(within(addRegion()).getByRole('list').tagName).toBe('UL')
    expect(addRegion()).toHaveTextContent('Benito Pérez Galdós')
    expect(addRegion()).toHaveTextContent('José María de Pereda')
    for (const title of ['La Regenta', 'Niebla', 'Pepita Jiménez', 'Marianela', 'Cumbres borrascosas']) {
      expect(addRegion()).not.toHaveTextContent(title)
    }
  })

  it('adds a book at the end with one call, removing it from the list to add', async () => {
    const user = userEvent.setup()
    const { tracked } = await openManaged('v2', { session: 'curator' })

    await user.click(button('Añadir «Doña Perfecta»'))
    await waitFor(() => expect(shortlist()).toEqual(['Marianela', 'Los pazos de Ulloa', 'La gaviota', BUSCON, 'Doña Perfecta']))
    expect(viewTitles().at(-1)).toBe('Doña Perfecta')
    expect(addable()).toEqual(['Añadir «Sotileza»'])
    expect(status()).toHaveTextContent('Se ha añadido «Doña Perfecta» al final de la lista.')
    expect(button('Añadir «Sotileza»')).toHaveFocus()
    expect(managementCalls(tracked.calls)).toEqual(['addCandidate'])

    await user.click(button('Añadir «Sotileza»'))
    await waitFor(() => expect(shortlist()).toHaveLength(6))
    expect(addRegion()).toHaveTextContent('No quedan libros propuestos en la Biblioteca. La administración puede añadir más.')
    expect(within(addRegion()).getByRole('heading', { name: 'Añadir libros' })).toHaveFocus()
  })
})

describe('Vote management: removing books', () => {
  it('removes a candidate of a draft at once, with no dialog', async () => {
    const user = userEvent.setup()
    const { tracked } = await openManaged('v2', { state: stateFor('draft') })

    await user.click(button('Quitar «La gaviota»'))
    await waitFor(() => expect(shortlist()).toEqual(['Marianela', 'Los pazos de Ulloa', BUSCON]))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(viewTitles()).toEqual(['Marianela', 'Los pazos de Ulloa', BUSCON])
    expect(status()).toHaveTextContent('Se ha quitado «La gaviota» de la lista.')
    // Focus moves to the book that took its place.
    expect(button(`Subir «${BUSCON}»`)).toHaveFocus()
    expect(managementCalls(tracked.calls)).toEqual(['removeCandidate'])
    // A removed «Propuesto» book can be added again.
    expect(addable()).toContain('Añadir «La gaviota»')
  })

  it('removes a candidate with no votes of an open vote at once', async () => {
    const user = userEvent.setup()
    await openManaged('v2')

    await user.click(button('Quitar «La gaviota»'))
    await waitFor(() => expect(shortlist()).toEqual(['Marianela', 'Los pazos de Ulloa', BUSCON]))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks before removing a candidate with votes, and cancelling changes nothing', async () => {
    const user = userEvent.setup()
    const { tracked } = await openManaged('v2')

    await user.click(button('Quitar «Los pazos de Ulloa»'))
    const dialog = screen.getByRole('dialog', { name: '¿Quitar «Los pazos de Ulloa» de la lista?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent('Quitar «Los pazos de Ulloa» borrará sus 2 votos.')
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button('Quitar «Los pazos de Ulloa»')).toHaveFocus()
    expect(managementCalls(tracked.calls)).toEqual([])

    await user.click(button('Quitar «Los pazos de Ulloa»'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Quitar' }))
    await waitFor(() => expect(shortlist()).toEqual(['Marianela', 'La gaviota', BUSCON]))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Votos de «Los pazos de Ulloa»' })).not.toBeInTheDocument()
    expect(region('Libros candidatos')).not.toHaveTextContent('Los pazos de Ulloa')
    expect(status()).toHaveTextContent('Se ha quitado «Los pazos de Ulloa» de la lista.')
    expect(button('Subir «La gaviota»')).toHaveFocus()
    expect(managementCalls(tracked.calls)).toEqual(['removeCandidate'])
  })

  it('names a single vote in the singular', async () => {
    const user = userEvent.setup()
    await openManaged('v2')
    await user.click(button(`Quitar «${BUSCON}»`))
    expect(screen.getByRole('dialog')).toHaveTextContent(`Quitar «${BUSCON}» borrará su voto.`)
  })

  it('offers no «Quitar» in an open vote with only two candidates, and says why', async () => {
    const state = createClubState()
    state.votes[0].candidates = state.votes[0].candidates.slice(0, 2)
    await openManaged('v2', { state })

    expect(shortlist()).toEqual(['Marianela', 'Los pazos de Ulloa'])
    expect(within(manage()).queryByRole('button', { name: /^Quitar/ })).not.toBeInTheDocument()
    expect(shortlistRegion()).toHaveTextContent('Una votación abierta necesita al menos dos libros')
  })
})

describe('Vote management: opening', () => {
  it('opens a draft with at least two books in one call, without confirmation', async () => {
    const user = userEvent.setup()
    const { tracked, main } = await openManaged('v2', { session: 'curator', state: stateFor('draft') })

    await user.click(button('Abrir votación'))
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(4))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(facts(main)).toEqual([
      ['Estado', 'Abierta'],
      ['Abierta el', '9 de octubre de 2026'],
    ])
    expect(status()).toHaveTextContent('La votación está abierta. Ya se puede votar.')
    expect(within(manage()).getByRole('heading', { level: 2 })).toHaveFocus()
    expect(button('Cerrar votación')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir votación' })).not.toBeInTheDocument()
    expect(managementCalls(tracked.calls)).toEqual(['openVote'])
  })

  it('explains that two books are needed instead of offering to open', async () => {
    const state = stateFor('draft')
    state.votes[0].candidates = state.votes[0].candidates.slice(0, 1)
    await openManaged('v2', { state })

    expect(screen.queryByRole('button', { name: 'Abrir votación' })).not.toBeInTheDocument()
    expect(manage()).toHaveTextContent('Para abrir la votación hacen falta al menos dos libros en la lista.')
  })
})

describe('Vote management: closing', () => {
  it('asks for confirmation in an accessible dialog that keeps focus inside', async () => {
    const user = userEvent.setup()
    const { tracked } = await openManaged('v2', { session: 'curator' })

    await user.click(button('Cerrar votación'))
    const dialog = screen.getByRole('dialog', { name: '¿Cerrar la votación?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent('nadie podrá cambiar sus votos')
    expect(dialog).toHaveTextContent('Si hay un empate, el club decidirá')
    const cancel = within(dialog).getByRole('button', { name: 'Cancelar' })
    const confirm = within(dialog).getByRole('button', { name: 'Cerrar votación' })
    expect(cancel).toHaveFocus()

    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
    await user.tab({ shift: true })
    expect(cancel).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button('Cerrar votación')).toHaveFocus()

    await user.click(button('Cerrar votación'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button('Cerrar votación')).toHaveFocus()
    expect(managementCalls(tracked.calls)).toEqual([])
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
  })

  it('closes with one call and shows the winner read-only', async () => {
    const user = userEvent.setup()
    const { tracked, main } = await openManaged('v2', { session: 'curator' })

    await user.click(button('Cerrar votación'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar votación' }))

    await waitFor(() => expect(queryManage()).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(facts(main)).toEqual([
      ['Estado', 'Cerrada'],
      ['Abierta el', '30 de septiembre de 2026'],
      ['Cerrada el', '9 de octubre de 2026'],
    ])
    expect(region('Resultado')).toHaveTextContent('Libro elegido: «Marianela»')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(main).queryByRole('button')).not.toBeInTheDocument()
    const notice = screen.getByText('Se ha cerrado la votación. Libro elegido: «Marianela».').closest('[role="status"]')
    expect(notice).toHaveFocus()
    expect(managementCalls(tracked.calls)).toEqual(['closeVote'])
  })

  it('closes with a pending tie, which the admin can then resolve', async () => {
    const user = userEvent.setup()
    await openManaged('v2', { state: stateFor('open-tie') })

    await user.click(button('Cerrar votación'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar votación' }))

    await waitFor(() => expect(region('Resultado')).toHaveTextContent('Hay un empate entre «Marianela» y «Los pazos de Ulloa».'))
    expect(screen.getByText(/Se ha cerrado la votación con un empate/).closest('[role="status"]')).toHaveFocus()
    expect(screen.getByRole('region', { name: 'Registrar el libro elegido' })).toBeInTheDocument()
  })

  it('shows the closed vote first in the history, and offers a new vote again', async () => {
    const user = userEvent.setup()
    await openManaged('v2', { session: 'curator' })

    await user.click(button('Cerrar votación'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar votación' }))
    await waitFor(() => expect(queryManage()).not.toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: '← Volver a Votaciones' }))
    const history = await screen.findByRole('region', { name: 'Votaciones anteriores' })
    expect(within(history).getAllByRole('link')[0]).toHaveTextContent('Votación de JordiCerrada el 9 de octubre de 2026Libro elegido: «Marianela»')
    expect(region('Votación actual')).toHaveTextContent('Ahora mismo no hay ninguna votación abierta.')
    expect(button('Preparar una votación')).toBeInTheDocument()
  })

  it('disables the confirm button while closing', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient(), 'closeVote')
    renderApp({ path: '/votaciones/v2', client: held.client })
    await waitFor(() => expect(addRegion()).not.toHaveTextContent('Cargando'))

    await user.click(button('Cerrar votación'))
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar votación' })
    await user.click(confirm)
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    held.release()
    await waitFor(() => expect(queryManage()).not.toBeInTheDocument())
  })

  it('keeps the dialog open with an alert when closing fails, and the vote unchanged', async () => {
    const user = userEvent.setup()
    const { main } = await openManaged('v2', { failures: { closeVote: 1 } })

    await user.click(button('Cerrar votación'))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar votación' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('No se ha podido cerrar la votación. Inténtalo de nuevo.')
    expect(within(dialog).getByRole('button', { name: 'Cerrar votación' })).toBeEnabled()
    expect(facts(main)[0]).toEqual(['Estado', 'Abierta'])
    expect(manage()).toBeInTheDocument()
  })

  it('says calmly when the vote was closed meanwhile, and shows it', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    const { tracked } = await openManaged('v2', { state })

    applyVoteScenario(state, 'tie')
    await user.click(button('Cerrar votación'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar votación' }))

    expect(await screen.findByText(VOTE_CHANGED_MEANWHILE)).toBeInTheDocument()
    await waitFor(() => expect(queryManage()).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(region('Resultado')).toHaveTextContent('Hay un empate')
    expect(screen.getByText(VOTE_CHANGED_MEANWHILE).closest('[role="status"]')).toHaveFocus()
    expect(tracked.clubDataCalls()).toEqual(['getVote', 'listBooks', 'closeVote', 'getVote'])
  })
})

describe('Vote management: errors on any action', () => {
  it('disables only the control in use while its call is pending', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient(), 'addCandidate')
    renderApp({ path: '/votaciones/v2', client: held.client })
    await waitFor(() => expect(addRegion()).not.toHaveTextContent('Cargando'))

    await user.click(button('Añadir «Doña Perfecta»'))
    expect(button('Añadir «Doña Perfecta»')).toBeDisabled()
    expect(button('Añadir «Sotileza»')).toBeEnabled()
    expect(button('Subir «La gaviota»')).toBeEnabled()
    expect(button('Quitar «La gaviota»')).toBeEnabled()
    expect(button('Cerrar votación')).toBeEnabled()
    held.release()
    await waitFor(() => expect(shortlist()).toHaveLength(5))
  })

  it('reloads calmly on a 409', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    const { tracked } = await openManaged('v2', { state, session: 'curator' })

    // The admin closed the vote meanwhile.
    applyVoteScenario(state, 'tie')
    await user.click(button('Subir «La gaviota»'))

    expect(await screen.findByText(VOTE_CHANGED_MEANWHILE)).toBeInTheDocument()
    await waitFor(() => expect(queryManage()).not.toBeInTheDocument())
    expect(screen.getByRole('main')).toHaveTextContent('EstadoCerrada')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['getVote', 'listBooks', 'reorderCandidates', 'getVote'])
  })

  it('reloads calmly on a 403, hiding the controls the server no longer offers', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    await openManaged('v2', { state, session: 'curator' })

    // Someone else became the curator meanwhile.
    state.curatorId = 'm3'
    await user.click(button('Añadir «Doña Perfecta»'))

    expect(await screen.findByText(VOTE_CHANGED_MEANWHILE)).toBeInTheDocument()
    await waitFor(() => expect(queryManage()).not.toBeInTheDocument())
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(state.votes[0].candidates).toHaveLength(4)
  })

  it('shows an alert next to the control on any other failure and keeps the last saved vote', async () => {
    const user = userEvent.setup()
    await openManaged('v2', { failures: { reorderCandidates: 1, addCandidate: 1, removeCandidate: 1 } })

    await user.click(button('Subir «La gaviota»'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se ha podido mover «La gaviota». Inténtalo de nuevo.')
    expect(within(shortlistRegion()).getAllByRole('listitem')[2]).toContainElement(alert)
    expect(shortlist()).toEqual(['Marianela', 'Los pazos de Ulloa', 'La gaviota', BUSCON])

    await user.click(button('Añadir «Sotileza»'))
    expect(await within(addRegion()).findByRole('alert')).toHaveTextContent('No se ha podido añadir «Sotileza». Inténtalo de nuevo.')

    await user.click(button('Quitar «La gaviota»'))
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(3))
    expect(shortlist()).toHaveLength(4)

    // Trying again works and clears the alert.
    await user.click(button('Subir «La gaviota»'))
    await waitFor(() => expect(shortlist()[1]).toBe('La gaviota'))
    expect(within(shortlistRegion()).queryByText(/No se ha podido mover/)).not.toBeInTheDocument()
  })

  it('shows an alert in the dialog when removing a candidate with votes fails', async () => {
    const user = userEvent.setup()
    await openManaged('v2', { failures: { removeCandidate: 1 } })

    await user.click(button('Quitar «Marianela»'))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se ha podido quitar «Marianela». Inténtalo de nuevo.')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(shortlist()).toHaveLength(4)
  })

  it('returns to the sign-in screen on a 401', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    await openManaged('v2', { state })

    state.session = 'anonymous'
    await user.click(button('Añadir «Doña Perfecta»'))

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(state.votes[0].candidates).toHaveLength(4)
  })
})

describe('Vote management: the tie-break', () => {
  const tieForm = () => screen.getByRole('region', { name: 'Registrar el libro elegido' })

  it('offers the admin a form with the tied books only, none chosen', async () => {
    await openVote('v2', { state: stateFor('tie') })

    const form = tieForm()
    expect(region('Resultado')).toContainElement(form)
    expect(within(form).getByRole('heading', { level: 3 })).toHaveTextContent('Registrar el libro elegido')
    const group = within(form).getByRole('group', { name: '¿Qué libro ha elegido el club?' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual(['Marianela', 'Los pazos de Ulloa'])
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true)
    const note = within(form).getByRole('textbox', { name: 'Nota del desempate (opcional)' })
    expect(note).toHaveAttribute('maxLength', '1000')
    expect(within(form).getByRole('button', { name: 'Guardar libro elegido' })).toBeInTheDocument()
  })

  it('asks for a choice before saving, and calls nothing', async () => {
    const user = userEvent.setup()
    const { tracked } = await openVote('v2', { state: stateFor('tie') })

    await user.click(button('Guardar libro elegido'))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Elige el libro que ha decidido el club.')
    expect(screen.getByRole('group', { name: '¿Qué libro ha elegido el club?' })).toHaveAccessibleDescription(
      'Elige el libro que ha decidido el club.',
    )
    expect(screen.getByRole('radio', { name: 'Marianela' })).toHaveFocus()
    expect(managementCalls(tracked.calls)).toEqual([])
  })

  it('records the chosen book with a plain-text note, keeping its line breaks', async () => {
    const user = userEvent.setup()
    const { tracked, main } = await openVote('v2', { state: stateFor('tie') })

    await user.click(screen.getByRole('radio', { name: 'Los pazos de Ulloa' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Nota del desempate (opcional)' }),
      'Lo echamos a suertes.{Enter}Con <b>negrita</b> y <script>alert(1)</script>.',
    )
    await user.click(button('Guardar libro elegido'))

    await waitFor(() => expect(region('Resultado')).toHaveTextContent('Libro elegido: «Los pazos de Ulloa»'))
    expect(screen.queryByRole('region', { name: 'Registrar el libro elegido' })).not.toBeInTheDocument()
    const note = within(region('Resultado')).getByText(/^Lo echamos a suertes/)
    expect(note.textContent).toBe('Lo echamos a suertes.\nCon <b>negrita</b> y <script>alert(1)</script>.')
    expect(note).toHaveClass('whitespace-pre-line')
    expect(main.querySelector('b')).toBeNull()
    expect(main.querySelector('script')).toBeNull()
    const winner = within(region('Libros candidatos'))
      .getAllByRole('listitem')
      .find((li) => li.querySelector('a')?.textContent === 'Los pazos de Ulloa')
    expect(winner).toHaveTextContent('Libro elegido')
    expect(screen.getByText('Se ha guardado «Los pazos de Ulloa» como libro elegido.').closest('[role="status"]')).toHaveFocus()
    expect(managementCalls(tracked.calls)).toEqual(['recordTieWinner'])
    expect(within(main).queryByRole('button')).not.toBeInTheDocument()
  })

  it('records the chosen book without a note, choosing with the arrow keys', async () => {
    const user = userEvent.setup()
    await openVote('v2', { state: stateFor('tie') })

    screen.getByRole('radio', { name: 'Marianela' }).focus()
    await user.keyboard(' ')
    expect(screen.getByRole('radio', { name: 'Marianela' })).toBeChecked()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Los pazos de Ulloa' })).toBeChecked()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('radio', { name: 'Marianela' })).toBeChecked()
    await user.click(button('Guardar libro elegido'))

    await waitFor(() => expect(region('Resultado')).toHaveTextContent('Libro elegido: «Marianela»'))
    expect(region('Resultado')).not.toHaveTextContent('Nota del desempate')
  })

  it('disables the button while saving, and shows an alert when saving fails', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient({ state: stateFor('tie'), failures: { recordTieWinner: 1 } }), 'recordTieWinner')
    renderApp({ path: '/votaciones/v2', client: held.client })
    await screen.findByRole('region', { name: 'Registrar el libro elegido' })

    await user.click(screen.getByRole('radio', { name: 'Marianela' }))
    await user.click(button('Guardar libro elegido'))
    expect(button('Guardar libro elegido')).toBeDisabled()
    held.release()

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar el libro elegido. Inténtalo de nuevo.')
    expect(button('Guardar libro elegido')).toBeEnabled()
    expect(region('Resultado')).toHaveTextContent('Hay un empate')
  })

  it('reloads calmly when the tie was resolved meanwhile', async () => {
    const user = userEvent.setup()
    const state = stateFor('tie')
    await openVote('v2', { state })

    state.votes[0].outcome = { winnerBookId: 'b7', tieNote: null }
    await user.click(screen.getByRole('radio', { name: 'Los pazos de Ulloa' }))
    await user.click(button('Guardar libro elegido'))

    expect(await screen.findByText(VOTE_CHANGED_MEANWHILE)).toBeInTheDocument()
    await waitFor(() => expect(region('Resultado')).toHaveTextContent('Libro elegido: «Marianela»'))
    expect(screen.queryByRole('region', { name: 'Registrar el libro elegido' })).not.toBeInTheDocument()
  })

  it('tells the curator that the admin records the choice, with no form', async () => {
    const { main } = await openVote('v2', { session: 'curator', state: stateFor('tie') })

    expect(region('Resultado')).toHaveTextContent(
      'Hay un empate entre «Marianela» y «Los pazos de Ulloa». El club decidirá cuál se lee.Cuando lo acordéis, la administración registrará el libro elegido.',
    )
    expect(screen.queryByRole('region', { name: 'Registrar el libro elegido' })).not.toBeInTheDocument()
    expect(within(main).queryByRole('radio')).not.toBeInTheDocument()
    expect(within(main).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows a member the pending tie unchanged from #66', async () => {
    await openVote('v2', { session: 'member', state: stateFor('tie') })
    expect(region('Resultado')).toHaveTextContent(
      /^ResultadoHay un empate entre «Marianela» y «Los pazos de Ulloa». El club decidirá cuál se lee.$/,
    )
  })

  it('never offers to edit a recorded winner', async () => {
    const { main } = await openVote('v1')
    expect(region('Resultado')).toHaveTextContent('Libro elegido: «La Regenta»')
    expect(within(main).queryByRole('button')).not.toBeInTheDocument()
    expect(within(main).queryByRole('textbox')).not.toBeInTheDocument()
  })
})
