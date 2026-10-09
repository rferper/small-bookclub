import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { applyVoteScenario, createClubState } from '../api/mock/fixtures'
import { createMockClient, type MockOptions } from '../api/mock/mockClient'
import { holdCalls, trackCalls } from '../test/clients'
import { expectNoClubContent } from '../test/expectations'
import { renderApp } from '../test/renderApp'

const BUSCON = 'La vida del Buscón llamado don Pablos, ejemplo de vagamundos y espejo de tacaños'

async function openVote(voteId: string, options: MockOptions = {}) {
  const tracked = trackCalls(createMockClient(options))
  const rendered = renderApp({ path: `/votaciones/${voteId}`, client: tracked.client })
  await screen.findByRole('link', { name: '← Volver a Votaciones' })
  return { ...rendered, tracked, main: screen.getByRole('main') }
}

const region = (name: string) => screen.getByRole('region', { name })
const candidates = () => within(region('Libros candidatos')).getAllByRole('listitem').filter((li) => li.querySelector('a'))
const candidate = (title: string) => candidates().find((li) => within(li).queryByRole('link', { name: title }))!
const checkbox = (title: string) => screen.getByRole('checkbox', { name: `Votar por «${title}»` })
const voters = (title: string) =>
  within(screen.getByRole('list', { name: `Votos de «${title}»` }))
    .getAllByRole('listitem')
    .map((li) => li.textContent?.slice(1))
const announcement = () => within(region('Libros candidatos')).getByRole('status')

function expectNoBrokenValues(main: HTMLElement) {
  expect(main.textContent).not.toMatch(/null|undefined|NaN|Invalid Date/)
}

describe('Vote page: open vote', () => {
  it('shows the curator, status, opening date, a way back and the candidates in shortlist order', async () => {
    const { main, tracked } = await openVote('v2')

    expect(screen.getByRole('heading', { level: 1, name: 'Votación de Jordi' })).toBeInTheDocument()
    const facts = within(main)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent])
    expect(facts).toEqual([
      ['Estado', 'Abierta'],
      ['Abierta el', '30 de septiembre de 2026'],
    ])
    expect(main.querySelector('time')).toHaveAttribute('dateTime', '2026-09-30T20:00:00+02:00')
    expect(screen.getByRole('link', { name: '← Volver a Votaciones' })).toHaveAttribute('href', '/votaciones')
    expect(screen.getByRole('link', { name: 'Votaciones' })).toHaveAttribute('aria-current', 'page')
    expect(
      within(main)
        .getAllByRole('heading')
        .map((h) => [h.tagName, h.textContent]),
    ).toEqual([
      ['H1', 'Votación de Jordi'],
      ['H2', 'Libros candidatos'],
    ])
    expect(candidates().map((li) => within(li).getAllByRole('link')[0].textContent)).toEqual([
      'Marianela',
      'Los pazos de Ulloa',
      'La gaviota',
      BUSCON,
    ])
    expect(tracked.clubDataCalls()).toEqual(['getVote'])
    expectNoBrokenValues(main)
  })

  it('shows each candidate’s cover, title link, authors and only the metadata it has', async () => {
    await openVote('v2')

    const marianela = candidate('Marianela')
    expect(within(marianela).getByRole('img', { name: 'Portada de «Marianela»' })).toHaveAttribute('src', '/covers/marianela.svg')
    expect(within(marianela).getByRole('link', { name: 'Marianela' })).toHaveAttribute('href', '/biblioteca/b7')
    expect(marianela).toHaveTextContent('Benito Pérez Galdós')
    expect(marianela).toHaveTextContent('1878 · 256 páginas')

    const pazos = candidate('Los pazos de Ulloa')
    expect(within(pazos).getByRole('img', { name: 'Portada de «Los pazos de Ulloa»' })).toBeInTheDocument()
    expect(pazos).toHaveTextContent('Emilia Pardo Bazán')
    expect(pazos).not.toHaveTextContent(/página|·/)
  })

  it('explains approval voting and offers a checkbox per candidate, checked for the user’s own votes', async () => {
    await openVote('v2')

    expect(region('Libros candidatos')).toHaveTextContent('Puedes votar por todos los libros que te apetezca leer, y cada voto cuenta lo mismo.')
    expect(screen.getByRole('group', { name: 'Elige los libros que te gustaría leer' })).toBeInTheDocument()
    // The default session is the admin, who approved «Los pazos de Ulloa».
    expect(screen.getAllByRole('checkbox').map((box) => [box.getAttribute('aria-describedby') !== null, (box as HTMLInputElement).checked])).toEqual([
      [true, false],
      [true, true],
      [true, false],
      [true, false],
    ])
    expect(checkbox(BUSCON)).not.toBeChecked()
  })

  it('shows each count in text with Spanish plurals, matching the names of everyone who voted', async () => {
    await openVote('v2')

    expect(candidate('Marianela')).toHaveTextContent('5 votos')
    expect(voters('Marianela')).toEqual(['Carmen', 'Pablo', 'Inés', 'Jordi', 'Elena'])
    expect(candidate('Los pazos de Ulloa')).toHaveTextContent('2 votos')
    expect(voters('Los pazos de Ulloa')).toEqual(['Lucía', 'Pablo'])
    expect(candidate('La gaviota')).toHaveTextContent('Sin votos todavía')
    expect(screen.queryByRole('list', { name: 'Votos de «La gaviota»' })).not.toBeInTheDocument()
    expect(candidate(BUSCON)).toHaveTextContent('1 voto')
    expect(voters(BUSCON)).toEqual(['Mateo'])
    // Screen readers hear the count with each checkbox.
    expect(checkbox('Marianela')).toHaveAccessibleDescription('5 votos')
    expect(checkbox('La gaviota')).toHaveAccessibleDescription('Sin votos todavía')
  })

  it('gives voter photos Spanish alt text', async () => {
    const state = createClubState()
    state.members[2] = { ...state.members[2], avatarUrl: '/avatars/carmen.png' }
    await openVote('v2', { state })

    expect(within(candidate('Marianela')).getByRole('img', { name: 'Foto de Carmen' })).toBeInTheDocument()
  })
})

describe('Vote page: changing an approval', () => {
  it('approves and withdraws with one call each, updating the count, the names and the status message', async () => {
    const user = userEvent.setup()
    const { tracked } = await openVote('v2')

    await user.click(checkbox('Marianela'))
    await waitFor(() => expect(candidate('Marianela')).toHaveTextContent('6 votos'))
    expect(checkbox('Marianela')).toBeChecked()
    expect(voters('Marianela')).toEqual(['Carmen', 'Pablo', 'Inés', 'Jordi', 'Elena', 'Lucía'])
    expect(checkbox('Marianela')).toHaveAccessibleDescription('6 votos')
    expect(announcement()).toHaveTextContent('Has votado «Marianela». Ahora tiene 6 votos.')
    expect(tracked.clubDataCalls()).toEqual(['getVote', 'setApproval'])

    await user.click(checkbox('Los pazos de Ulloa'))
    await waitFor(() => expect(candidate('Los pazos de Ulloa')).toHaveTextContent('1 voto'))
    expect(checkbox('Los pazos de Ulloa')).not.toBeChecked()
    expect(voters('Los pazos de Ulloa')).toEqual(['Pablo'])
    expect(announcement()).toHaveTextContent('Has retirado tu voto de «Los pazos de Ulloa».')
    expect(tracked.clubDataCalls()).toEqual(['getVote', 'setApproval', 'setApproval'])

    // Never reordered by count while the vote is open.
    expect(candidates().map((li) => within(li).getAllByRole('link')[0].textContent)).toEqual([
      'Marianela',
      'Los pazos de Ulloa',
      'La gaviota',
      BUSCON,
    ])
  })

  it('works with the keyboard: Space toggles the focused checkbox', async () => {
    const user = userEvent.setup()
    await openVote('v2', { session: 'member' })

    checkbox('La gaviota').focus()
    await user.keyboard(' ')
    await waitFor(() => expect(candidate('La gaviota')).toHaveTextContent('1 voto'))
    expect(voters('La gaviota')).toEqual(['Mateo'])
    expect(checkbox('La gaviota')).toHaveFocus()
    expect(announcement()).toHaveTextContent('Has votado «La gaviota». Ahora tiene 1 voto.')
  })

  it('disables only the checkbox being saved while the call is in flight', async () => {
    const user = userEvent.setup()
    const held = holdCalls(createMockClient(), 'setApproval')
    renderApp({ path: '/votaciones/v2', client: held.client })
    await screen.findByRole('heading', { level: 1, name: 'Votación de Jordi' })

    await user.click(checkbox('La gaviota'))
    expect(checkbox('La gaviota')).toBeDisabled()
    expect(checkbox('La gaviota')).toBeChecked()
    for (const title of ['Marianela', 'Los pazos de Ulloa', BUSCON]) expect(checkbox(title)).toBeEnabled()
    expect(candidate('La gaviota')).toHaveTextContent('Sin votos todavía')

    held.release()
    await waitFor(() => expect(checkbox('La gaviota')).toBeEnabled())
    expect(checkbox('La gaviota')).toBeChecked()
    expect(candidate('La gaviota')).toHaveTextContent('1 voto')
  })

  it('says calmly when the vote is no longer open and shows its closed state', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    const { tracked } = await openVote('v2', { state })

    // Someone closes the vote with a tie while the page is open.
    applyVoteScenario(state, 'tie')
    await user.click(checkbox('La gaviota'))

    expect(await screen.findByText(/Esta votación ya no está abierta/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('checkbox')).not.toBeInTheDocument())
    expect(screen.getByText('Esta votación ya no está abierta, así que tu cambio no se ha guardado. Aquí tienes cómo ha quedado.').closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(region('Resultado')).toHaveTextContent('Hay un empate')
    expect(screen.getByRole('main')).toHaveTextContent('EstadoCerrada')
    expect(tracked.clubDataCalls()).toEqual(['getVote', 'setApproval', 'getVote'])
    expect(state.votes[0].candidates[2].approverIds).toEqual([])
  })

  it('puts the checkbox back and shows an alert next to it when saving fails', async () => {
    const user = userEvent.setup()
    await openVote('v2', { failures: { setApproval: 1 } })

    await user.click(checkbox('Los pazos de Ulloa'))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se ha podido guardar tu voto. Inténtalo de nuevo.')
    expect(candidate('Los pazos de Ulloa')).toContainElement(alert)
    expect(checkbox('Los pazos de Ulloa')).toBeChecked()
    expect(checkbox('Los pazos de Ulloa')).toBeEnabled()
    expect(candidate('Los pazos de Ulloa')).toHaveTextContent('2 votos')
    expect(announcement()).toHaveTextContent('')

    // Trying again works and clears the alert.
    await user.click(checkbox('Los pazos de Ulloa'))
    await waitFor(() => expect(candidate('Los pazos de Ulloa')).toHaveTextContent('1 voto'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('returns to the sign-in screen when setApproval gets a 401', async () => {
    const user = userEvent.setup()
    const state = createClubState()
    await openVote('v2', { state })

    state.session = 'anonymous'
    await user.click(checkbox('Marianela'))

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('Marianela', { exact: false })).not.toBeInTheDocument()
  })
})

describe('Vote page: draft and closed votes', () => {
  it('shows a draft shortlist read-only, with no checkboxes, counts or voters', async () => {
    const { main } = await openVote('v2', { state: applyVoteScenario(createClubState(), 'draft') })

    expect(within(main).getAllByRole('term').map((t) => [t.textContent, t.nextElementSibling?.textContent])).toEqual([
      ['Estado', 'En preparación'],
    ])
    expect(region('Libros candidatos')).toHaveTextContent('La votación todavía no está abierta.')
    expect(candidates()).toHaveLength(4)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(main).not.toHaveTextContent(/voto/)
    expect(screen.queryByRole('list', { name: /Votos de/ })).not.toBeInTheDocument()
    expect(main.querySelector('time')).toBeNull()
    expectNoBrokenValues(main)
  })

  it('shows a closed vote with its winner, tie note, every candidate’s final count and the user’s own votes', async () => {
    const { main } = await openVote('v1')

    expect(screen.getByRole('heading', { level: 1, name: 'Votación de Carmen' })).toBeInTheDocument()
    expect(within(main).getAllByRole('term').map((t) => [t.textContent, t.nextElementSibling?.textContent])).toEqual([
      ['Estado', 'Cerrada'],
      ['Abierta el', '1 de septiembre de 2026'],
      ['Cerrada el', '14 de septiembre de 2026'],
    ])
    expect([...main.querySelectorAll('time')].map((t) => t.getAttribute('dateTime'))).toEqual([
      '2026-09-01T20:00:00+02:00',
      '2026-09-14T21:00:00+02:00',
    ])
    expect(
      within(main)
        .getAllByRole('heading')
        .map((h) => [h.tagName, h.textContent]),
    ).toEqual([
      ['H1', 'Votación de Carmen'],
      ['H2', 'Resultado'],
      ['H2', 'Libros candidatos'],
    ])

    const result = region('Resultado')
    expect(result).toHaveTextContent('Libro elegido: «La Regenta»')
    expect(within(result).getByRole('link', { name: '«La Regenta»' })).toHaveAttribute('href', '/biblioteca/b3')
    expect(result).toHaveTextContent('Nota del desempate')
    const note = within(result).getByText(/^Empate a cuatro votos/)
    expect(note.textContent).toBe(
      'Empate a cuatro votos entre «La Regenta» y «Pepita Jiménez».\nLo decidimos entre todos a mano alzada. «Pepita Jiménez» queda elegida para después.',
    )
    expect(note).toHaveClass('whitespace-pre-line')

    // Shortlist order, losers included, the winner marked in text.
    expect(candidates().map((li) => within(li).getAllByRole('link')[0].textContent)).toEqual([
      'Pepita Jiménez',
      'La Regenta',
      'Los pazos de Ulloa',
    ])
    expect(candidate('La Regenta')).toHaveTextContent('Libro elegido')
    expect(candidate('Pepita Jiménez')).not.toHaveTextContent('Libro elegido')
    expect(candidate('Pepita Jiménez')).toHaveTextContent('4 votos')
    expect(voters('Pepita Jiménez')).toEqual(['Mateo', 'Pablo', 'Jordi', 'Elena'])
    expect(candidate('Los pazos de Ulloa')).toHaveTextContent('1 voto')
    // The admin voted only for «La Regenta».
    expect(candidate('La Regenta')).toHaveTextContent('Votaste por este libro')
    expect(main.textContent?.match(/Votaste por este libro/g)).toHaveLength(1)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(main).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('status').every((s) => s.textContent === '')).toBe(true)
    expectNoBrokenValues(main)
  })

  it('shows a closed vote with a clear winner and no tie note', async () => {
    const { main } = await openVote('v0', { session: 'member' })

    expect(screen.getByRole('heading', { level: 1, name: 'Votación de Pablo' })).toBeInTheDocument()
    expect(region('Resultado')).toHaveTextContent('Libro elegido: «Cumbres borrascosas»')
    expect(region('Resultado')).not.toHaveTextContent('Nota del desempate')
    expect(candidates()).toHaveLength(3)
    expect(candidate('Niebla')).toHaveTextContent('2 votos')
    expect(candidate('La gaviota')).toHaveTextContent('1 voto')
    expect(candidate('La gaviota')).toHaveTextContent('Votaste por este libro')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expectNoBrokenValues(main)
  })

  it('shows the tie note as plain text', async () => {
    const state = createClubState()
    state.votes[1].outcome = { winnerBookId: 'b3', tieNote: 'Una nota con <b>texto</b> y <script>alert(1)</script>.' }
    const { main } = await openVote('v1', { state })

    expect(region('Resultado')).toHaveTextContent('Una nota con <b>texto</b> y <script>alert(1)</script>.')
    expect(main.querySelector('b')).toBeNull()
    expect(main.querySelector('script')).toBeNull()
  })

  it('names the tied books of a pending tie and chooses nothing', async () => {
    const { main } = await openVote('v2', { state: applyVoteScenario(createClubState(), 'tie') })

    expect(region('Resultado')).toHaveTextContent(
      'Hay un empate entre «Marianela» y «Los pazos de Ulloa». El club decidirá cuál se lee.',
    )
    expect(main).not.toHaveTextContent('Libro elegido')
    expect(candidate('Marianela')).toHaveTextContent('En empate')
    expect(candidate('Los pazos de Ulloa')).toHaveTextContent('En empate')
    expect(candidate('La gaviota')).not.toHaveTextContent('En empate')
    expect(candidate('Marianela')).toHaveTextContent('5 votos')
    expect(candidate('Los pazos de Ulloa')).toHaveTextContent('5 votos')
    expect(candidate('La gaviota')).toHaveTextContent('Sin votos')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expectNoBrokenValues(main)
  })

  it('looks the same for a member, the curator and the admin, with no management controls', async () => {
    for (const voteId of ['v2', 'v1']) {
      const texts: string[] = []
      for (const session of ['admin', 'member', 'curator'] as const) {
        const { main, unmount } = await openVote(voteId, { session })
        // Only the user's own approvals differ.
        texts.push(main.textContent!.replaceAll('Votaste por este libro', ''))
        expect(within(main).queryByRole('button')).not.toBeInTheDocument()
        expect(main).not.toHaveTextContent(/Cerrar votación|Abrir votación|desempate:|Añadir/)
        expect(within(main).queryAllByRole('checkbox')).toHaveLength(voteId === 'v2' ? 4 : 0)
        unmount()
      }
      expect(texts[1]).toBe(texts[0])
      expect(texts[2]).toBe(texts[0])
    }
  })
})

describe('Vote page: other states', () => {
  it('shows a friendly page for an unknown vote', async () => {
    renderApp({ path: '/votaciones/no-existe' })

    expect(await screen.findByRole('heading', { level: 1, name: 'No encontramos esta votación' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Volver a Votaciones' })).toHaveAttribute('href', '/votaciones')
    expect(screen.getByRole('link', { name: 'Votaciones' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.queryByText('No se ha podido cargar esta página.')).not.toBeInTheDocument()
  })

  it('shows a loading message, and a retry when the vote cannot be loaded', async () => {
    const user = userEvent.setup()
    const tracked = trackCalls(createMockClient({ failures: { getVote: 1 } }))
    const held = holdCalls(tracked.client, 'getVote')
    renderApp({ path: '/votaciones/v1', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    held.release()

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Votación de Carmen' })).toBeInTheDocument()
    expect(tracked.clubDataCalls()).toEqual(['getVote', 'getVote'])
  })

  it('returns to the sign-in screen when getVote gets a 401', async () => {
    const state = createClubState()
    const held = holdCalls(createMockClient({ state }), 'getVote')
    renderApp({ path: '/votaciones/v2', client: held.client })

    await screen.findByRole('navigation', { name: 'Principal' })
    state.session = 'anonymous'
    held.release()

    expect(await screen.findByRole('button', { name: 'Entrar con Discord' })).toBeInTheDocument()
    expectNoClubContent()
    expect(screen.queryByText('Marianela', { exact: false })).not.toBeInTheDocument()
  })
})

describe('Opening a vote', () => {
  it('opens the vote a book came from, from its book page', async () => {
    const user = userEvent.setup()
    for (const [bookId, title, heading] of [
      ['b3', 'La Regenta', 'Votación de Carmen'],
      ['b2', 'Cumbres borrascosas', 'Votación de Pablo'],
    ]) {
      const { router, unmount } = renderApp({ path: `/biblioteca/${bookId}` })
      await screen.findByRole('heading', { level: 1, name: title })
      await user.click(screen.getByRole('link', { name: 'Ver la votación en la que se eligió' }))

      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe(bookId === 'b3' ? '/votaciones/v1' : '/votaciones/v0')
      expect(region('Resultado')).toHaveTextContent(`Libro elegido: «${title}»`)
      unmount()
    }
  })

  it('opens an earlier vote from the history list', async () => {
    const user = userEvent.setup()
    const { router } = renderApp({ path: '/votaciones' })

    const history = await screen.findByRole('region', { name: 'Votaciones anteriores' })
    await user.click(within(history).getByRole('link', { name: /Votación de Pablo/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Votación de Pablo' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/votaciones/v0')
  })
})
