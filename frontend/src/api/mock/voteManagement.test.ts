import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../client'
import type { Vote } from '../types'
import { withUnauthorizedHandler } from '../unauthorized'
import { applyVoteScenario, createClubState, createEmptyState, type MockState } from './fixtures'
import { createMockClient, type MockSession } from './mockClient'

// Fixture ids: v2 is Jordi's open vote (b7 Marianela 5 votes, b5 Los pazos de
// Ulloa 2, b8 La gaviota 0, b9 Buscón 1); v1 and v0 are closed. b10 Doña
// Perfecta and b11 Sotileza are «Propuesto» and in no vote; b1 Niebla is
// «Terminado» and b3 La Regenta «Leyendo».

const ids = (vote: Vote) => vote.candidates.map((c) => c.book.id)
const counts = (vote: Vote) => vote.candidates.map((c) => c.approvals.length)
const snapshot = (state: MockState) => JSON.stringify(state)

// Every management call, with arguments that would succeed for the admin on
// the given vote (draft or open).
const managementCalls = (voteId: string): [string, (api: ApiClient) => Promise<unknown>][] => [
  ['addCandidate', (api) => api.addCandidate(voteId, 'b10')],
  ['removeCandidate', (api) => api.removeCandidate(voteId, 'b8')],
  ['reorderCandidates', (api) => api.reorderCandidates(voteId, ['b9', 'b8', 'b5', 'b7'])],
  ['openVote', (api) => api.openVote(voteId)],
  ['closeVote', (api) => api.closeVote(voteId)],
]

const draftState = () => applyVoteScenario(createClubState(), 'draft')
const noneState = () => applyVoteScenario(createClubState(), 'none')
const tieState = () => applyVoteScenario(createClubState(), 'tie')

describe('mock vote management: permission flags', () => {
  it('lets the admin and the current curator manage the current vote, never a member', async () => {
    for (const [session, expected] of [
      ['admin', true],
      ['curator', true],
      ['member', false],
    ] as const) {
      const api = createMockClient({ session })
      expect((await api.getVote('v2')).canManage).toBe(expected)
      expect((await api.getVotes()).current?.canManage).toBe(expected)
      expect((await createMockClient({ session, state: draftState() }).getVote('v2')).canManage).toBe(expected)
      // Never on a closed vote.
      expect((await api.getVote('v1')).canManage).toBe(false)
      expect((await createMockClient({ session, state: tieState() }).getVote('v2')).canManage).toBe(false)
    }
  })

  it('offers creating a vote only to the curator or admin, with a curator and no draft or open vote', async () => {
    for (const [session, expected] of [
      ['admin', true],
      ['curator', true],
      ['member', false],
    ] as const) {
      expect((await createMockClient({ session, state: noneState() }).getVotes()).canCreateVote).toBe(expected)
      expect((await createMockClient({ session, state: tieState() }).getVotes()).canCreateVote).toBe(expected)
      expect((await createMockClient({ session }).getVotes()).canCreateVote).toBe(false)
      expect((await createMockClient({ session, state: draftState() }).getVotes()).canCreateVote).toBe(false)
    }
    // No curator assigned: nobody may create one, the admin included.
    expect((await createMockClient({ state: createEmptyState() }).getVotes()).canCreateVote).toBe(false)
  })

  it('lets only the admin record a tie-break, only while the tie is pending', async () => {
    for (const [session, expected] of [
      ['admin', true],
      ['curator', false],
      ['member', false],
    ] as const) {
      expect((await createMockClient({ session, state: tieState() }).getVote('v2')).canRecordTieWinner).toBe(expected)
      const api = createMockClient({ session })
      for (const voteId of ['v2', 'v1', 'v0']) expect((await api.getVote(voteId)).canRecordTieWinner).toBe(false)
    }
  })

  it('tells only the vote’s curator that it is theirs', async () => {
    expect((await createMockClient({ session: 'curator' }).getVote('v2')).curatedByMe).toBe(true)
    expect((await createMockClient({ session: 'curator' }).getVote('v1')).curatedByMe).toBe(false)
    expect((await createMockClient({ session: 'admin' }).getVote('v2')).curatedByMe).toBe(false)
    expect((await createMockClient({ session: 'member' }).getVote('v2')).curatedByMe).toBe(false)
  })
})

describe('mock vote management: success paths', () => {
  it('creates an empty draft for the current curator, even when the admin creates it', async () => {
    const state = noneState()
    const api = createMockClient({ state })

    const vote = await api.createVote()
    expect(vote).toMatchObject({
      status: 'draft',
      curator: { id: 'm6', displayName: 'Jordi' },
      openedAt: null,
      closedAt: null,
      candidates: [],
      outcome: null,
      canManage: true,
    })
    expect(['v0', 'v1']).not.toContain(vote.id)
    expect(await api.getVote(vote.id)).toEqual(vote)
    const votes = await api.getVotes()
    expect(votes.current?.id).toBe(vote.id)
    expect(votes.canCreateVote).toBe(false)

    const asCurator = await createMockClient({ session: 'curator', state: noneState() }).createVote()
    expect(asCurator).toMatchObject({ status: 'draft', curator: { id: 'm6' }, curatedByMe: true })
  })

  it('adds a book at the end of the shortlist with no approvals', async () => {
    const api = createMockClient({ session: 'curator' })
    const vote = await api.addCandidate('v2', 'b10')

    expect(ids(vote)).toEqual(['b7', 'b5', 'b8', 'b9', 'b10'])
    expect(vote.candidates[4]).toEqual({
      book: {
        id: 'b10',
        title: 'Doña Perfecta',
        authors: ['Benito Pérez Galdós'],
        coverUrl: null,
        publicationDate: '1876',
        pageCount: 288,
      },
      approvals: [],
      approvedByMe: false,
    })
    expect(counts(vote)).toEqual([5, 2, 0, 1, 0])
  })

  it('removes a candidate together with its approvals', async () => {
    const state = createClubState()
    const api = createMockClient({ state })

    const vote = await api.removeCandidate('v2', 'b5')
    expect(ids(vote)).toEqual(['b7', 'b8', 'b9'])
    expect(counts(vote)).toEqual([5, 0, 1])
    // Approving it again needs it back on the list, and it comes back with no votes.
    await expect(api.setApproval('v2', 'b5', true)).rejects.toMatchObject({ status: 404 })
    expect(counts(await api.addCandidate('v2', 'b5'))).toEqual([5, 0, 1, 0])
  })

  it('reorders the shortlist, keeping each candidate’s approvals', async () => {
    const api = createMockClient({ session: 'curator' })
    const vote = await api.reorderCandidates('v2', ['b9', 'b8', 'b5', 'b7'])

    expect(ids(vote)).toEqual(['b9', 'b8', 'b5', 'b7'])
    expect(counts(vote)).toEqual([1, 0, 2, 5])
    expect(ids(await api.getVote('v2'))).toEqual(['b9', 'b8', 'b5', 'b7'])
  })

  it('opens a draft with the server’s date', async () => {
    const api = createMockClient({ state: draftState() })
    const vote = await api.openVote('v2')

    expect(vote).toMatchObject({ status: 'open', openedAt: '2026-10-09T12:00:00+02:00', closedAt: null, canManage: true })
    // Approvals start now.
    expect((await api.setApproval('v2', 'b8', true)).candidates[2].approvedByMe).toBe(true)
  })

  it('closes with a winner when one candidate has strictly the most approvals', async () => {
    const api = createMockClient()
    const vote = await api.closeVote('v2')

    expect(vote).toMatchObject({
      status: 'closed',
      closedAt: '2026-10-09T12:00:00+02:00',
      canManage: false,
      canRecordTieWinner: false,
    })
    expect(vote.outcome).toEqual({
      status: 'winner',
      winner: { id: 'b7', title: 'Marianela', authors: ['Benito Pérez Galdós'], coverUrl: '/covers/marianela.svg' },
      tieNote: null,
    })
    // The final snapshot keeps every candidate and count.
    expect(counts(vote)).toEqual([5, 2, 0, 1])
    const votes = await api.getVotes()
    expect(votes.current).toBeNull()
    expect(votes.history.map((v) => v.id)).toEqual(['v2', 'v1', 'v0'])
    expect(votes.canCreateVote).toBe(true)
  })

  it('closes with a pending tie between every candidate sharing the top count', async () => {
    const vote = await createMockClient({ state: applyVoteScenario(createClubState(), 'open-tie') }).closeVote('v2')
    expect(vote.outcome).toEqual({ status: 'tiePending', tiedBookIds: ['b7', 'b5'] })
    expect(vote.canRecordTieWinner).toBe(true)
  })

  it('closes with a tie between all candidates when nobody voted', async () => {
    const state = draftState()
    const api = createMockClient({ state })
    await api.openVote('v2')
    const vote = await api.closeVote('v2')
    expect(vote.outcome).toEqual({ status: 'tiePending', tiedBookIds: ['b7', 'b5', 'b8', 'b9'] })
  })

  it('records the tie-break with a trimmed note, or none', async () => {
    const api = createMockClient({ state: tieState() })
    const vote = await api.recordTieWinner('v2', 'b5', '  Lo decidimos a mano alzada.\nGanó por poco.  ')

    expect(vote.outcome).toEqual({
      status: 'winner',
      winner: { id: 'b5', title: 'Los pazos de Ulloa', authors: ['Emilia Pardo Bazán'], coverUrl: null },
      tieNote: 'Lo decidimos a mano alzada.\nGanó por poco.',
    })
    expect(vote.canRecordTieWinner).toBe(false)
    expect((await api.getVotes()).history[0].outcome).toMatchObject({ status: 'winner', winner: { id: 'b5' } })

    const blank = await createMockClient({ state: tieState() }).recordTieWinner('v2', 'b7', '   \n ')
    expect(blank.outcome).toMatchObject({ status: 'winner', winner: { id: 'b7' }, tieNote: null })
  })

  it('never changes book statuses, origin votes or the curator when closing or recording a tie-break', async () => {
    const api = createMockClient({ state: applyVoteScenario(createClubState(), 'open-tie') })
    const books = await api.listBooks()
    const details = await Promise.all(books.map((b) => api.getBook(b.id)))
    const curator = (await api.getVotes()).curator

    await api.closeVote('v2')
    expect(await api.listBooks()).toEqual(books)
    expect((await api.getVotes()).curator).toEqual(curator)

    await api.recordTieWinner('v2', 'b5', 'Nota')
    expect(await api.listBooks()).toEqual(books)
    expect(await Promise.all(books.map((b) => api.getBook(b.id)))).toEqual(details)
    expect((await api.getVotes()).curator).toEqual(curator)
  })
})

describe('mock vote management: refusals', () => {
  it('refuses every management call by a member with a 403 and changes nothing', async () => {
    for (const state of [createClubState(), draftState()]) {
      const api = createMockClient({ session: 'member', state })
      const before = snapshot(state)
      for (const [name, call] of managementCalls('v2')) {
        await expect(call(api), name).rejects.toMatchObject({ status: 403 })
      }
      await expect(api.createVote()).rejects.toMatchObject({ status: 403 })
      expect(snapshot(state)).toBe(before)
    }
    const none = noneState()
    await expect(createMockClient({ session: 'member', state: none }).createVote()).rejects.toMatchObject({ status: 403 })
    expect(none.votes.map((v) => v.id)).toEqual(['v1', 'v0'])
  })

  it('answers 403 before 404 and 409', async () => {
    const api = createMockClient({ session: 'member' })
    await expect(api.addCandidate('no-existe', 'b10')).rejects.toMatchObject({ status: 403 })
    await expect(api.removeCandidate('v2', 'b1')).rejects.toMatchObject({ status: 403 })
    await expect(api.closeVote('v1')).rejects.toMatchObject({ status: 403 })
    await expect(api.recordTieWinner('v1', 'b3', '')).rejects.toMatchObject({ status: 403 })
  })

  it('refuses the tie-break to the curator and to members with a 403', async () => {
    for (const session of ['curator', 'member'] as const) {
      const state = tieState()
      const api = createMockClient({ session, state })
      const before = snapshot(state)
      await expect(api.recordTieWinner('v2', 'b7', '')).rejects.toMatchObject({ status: 403 })
      expect(snapshot(state)).toBe(before)
    }
  })

  describe.each(['anonymous', 'denied'] as const)('while the session is %s', (session: MockSession) => {
    it('refuses every new call with a 401, before 403, 404 and 409, and changes nothing', async () => {
      const state = createClubState()
      const api = createMockClient({ state, session })
      const before = snapshot(state)

      await expect(api.createVote()).rejects.toMatchObject({ status: 401 })
      for (const [name, call] of [...managementCalls('v2'), ...managementCalls('no-existe'), ...managementCalls('v1')]) {
        await expect(call(api), name).rejects.toMatchObject({ status: 401 })
      }
      await expect(api.recordTieWinner('v2', 'b7', '')).rejects.toMatchObject({ status: 401 })
      await expect(api.recordTieWinner('no-existe', 'b7', '')).rejects.toMatchObject({ status: 401 })
      expect(snapshot(state)).toBe(before)
    })
  })

  it('goes through the 401 handler for every new call', async () => {
    let unauthorized = 0
    const api = withUnauthorizedHandler(createMockClient({ session: 'anonymous' }), () => unauthorized++)

    await expect(api.createVote()).rejects.toMatchObject({ status: 401 })
    for (const [, call] of managementCalls('v2')) await expect(call(api)).rejects.toMatchObject({ status: 401 })
    await expect(api.recordTieWinner('v2', 'b7', '')).rejects.toMatchObject({ status: 401 })
    expect(unauthorized).toBe(7)
  })

  it('answers 404 for an unknown vote or book, and for removing a book that is not a candidate', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const before = snapshot(state)

    for (const [name, call] of managementCalls('no-existe')) {
      await expect(call(api), name).rejects.toMatchObject({ status: 404 })
    }
    await expect(api.addCandidate('v2', 'no-existe')).rejects.toMatchObject({ status: 404 })
    await expect(api.removeCandidate('v2', 'b10')).rejects.toMatchObject({ status: 404 })
    await expect(api.removeCandidate('v2', 'no-existe')).rejects.toMatchObject({ status: 404 })
    await expect(api.reorderCandidates('v2', ['b7', 'b5', 'b8', 'no-existe'])).rejects.toMatchObject({ status: 404 })
    await expect(api.recordTieWinner('no-existe', 'b7', '')).rejects.toMatchObject({ status: 404 })
    await expect(createMockClient({ state: tieState() }).recordTieWinner('v2', 'no-existe', '')).rejects.toMatchObject({
      status: 404,
    })
    expect(snapshot(state)).toBe(before)
  })

  it('answers 409 for creating a vote while one is draft or open, or with no curator', async () => {
    for (const state of [createClubState(), draftState(), createEmptyState()]) {
      const before = snapshot(state)
      await expect(createMockClient({ state }).createVote()).rejects.toMatchObject({ status: 409 })
      expect(snapshot(state)).toBe(before)
    }
  })

  it('answers 409 for shortlist changes on a closed vote', async () => {
    for (const [state, voteId] of [
      [createClubState(), 'v1'],
      [tieState(), 'v2'],
    ] as const) {
      const api = createMockClient({ state })
      const before = snapshot(state)
      const order = (await api.getVote(voteId)).candidates.map((c) => c.book.id)
      await expect(api.addCandidate(voteId, 'b10')).rejects.toMatchObject({ status: 409 })
      await expect(api.removeCandidate(voteId, order[0])).rejects.toMatchObject({ status: 409 })
      await expect(api.reorderCandidates(voteId, [...order].reverse())).rejects.toMatchObject({ status: 409 })
      await expect(api.openVote(voteId)).rejects.toMatchObject({ status: 409 })
      await expect(api.closeVote(voteId)).rejects.toMatchObject({ status: 409 })
      expect(snapshot(state)).toBe(before)
    }
  })

  it('answers 409 for opening anything but a draft with at least two candidates', async () => {
    const open = createClubState()
    const openBefore = snapshot(open)
    await expect(createMockClient({ state: open }).openVote('v2')).rejects.toMatchObject({ status: 409 })
    expect(snapshot(open)).toBe(openBefore)

    const state = noneState()
    const api = createMockClient({ state })
    const { id } = await api.createVote()
    await expect(api.openVote(id)).rejects.toMatchObject({ status: 409 })
    await api.addCandidate(id, 'b10')
    const before = snapshot(state)
    await expect(api.openVote(id)).rejects.toMatchObject({ status: 409 })
    expect(snapshot(state)).toBe(before)
    await api.addCandidate(id, 'b11')
    await expect(api.openVote(id)).resolves.toMatchObject({ status: 'open' })
  })

  it('answers 409 for removing a candidate that would leave an open vote with fewer than two', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    await api.removeCandidate('v2', 'b8')
    await api.removeCandidate('v2', 'b9')
    const before = snapshot(state)
    await expect(api.removeCandidate('v2', 'b5')).rejects.toMatchObject({ status: 409 })
    expect(snapshot(state)).toBe(before)

    // A draft may go down to none.
    const draft = createMockClient({ state: draftState() })
    for (const bookId of ['b7', 'b5', 'b8']) await draft.removeCandidate('v2', bookId)
    expect(ids(await draft.removeCandidate('v2', 'b9'))).toEqual([])
  })

  it('answers 409 for closing a vote that is not open', async () => {
    const state = draftState()
    const before = snapshot(state)
    await expect(createMockClient({ state }).closeVote('v2')).rejects.toMatchObject({ status: 409 })
    expect(snapshot(state)).toBe(before)
  })

  it('answers 409 for a tie-break without a pending tie or for a book that is not tied', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const before = snapshot(state)
    await expect(api.recordTieWinner('v2', 'b7', '')).rejects.toMatchObject({ status: 409 })
    await expect(api.recordTieWinner('v1', 'b4', '')).rejects.toMatchObject({ status: 409 })
    await expect(api.recordTieWinner('v0', 'b1', '')).rejects.toMatchObject({ status: 409 })
    expect(snapshot(state)).toBe(before)

    const tie = tieState()
    const tieBefore = snapshot(tie)
    // «La gaviota» is a candidate, but not tied; «Niebla» is not a candidate.
    await expect(createMockClient({ state: tie }).recordTieWinner('v2', 'b8', '')).rejects.toMatchObject({ status: 409 })
    await expect(createMockClient({ state: tie }).recordTieWinner('v2', 'b1', '')).rejects.toMatchObject({ status: 409 })
    expect(snapshot(tie)).toBe(tieBefore)
  })

  it('answers 409 for a reorder that is not exactly the current candidates', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const before = snapshot(state)
    for (const order of [
      ['b7', 'b5', 'b8'],
      ['b7', 'b5', 'b8', 'b9', 'b10'],
      ['b7', 'b5', 'b8', 'b8'],
      ['b7', 'b5', 'b8', 'b10'],
      [],
    ]) {
      await expect(api.reorderCandidates('v2', order), order.join()).rejects.toMatchObject({ status: 409 })
    }
    expect(snapshot(state)).toBe(before)
  })

  it('answers 409 for adding a book that is already a candidate or not «Propuesto»', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const before = snapshot(state)
    await expect(api.addCandidate('v2', 'b7')).rejects.toMatchObject({ status: 409 })
    // «La Regenta» (Leyendo), «Niebla» (Terminado) and «Pepita Jiménez» (Elegido).
    for (const bookId of ['b3', 'b1', 'b4']) await expect(api.addCandidate('v2', bookId)).rejects.toMatchObject({ status: 409 })
    expect(snapshot(state)).toBe(before)
  })

  it('answers 400 for a tie-break note longer than 1000 characters', async () => {
    const state = tieState()
    const api = createMockClient({ state })
    const before = snapshot(state)
    await expect(api.recordTieWinner('v2', 'b7', 'a'.repeat(1001))).rejects.toMatchObject({ status: 400 })
    expect(snapshot(state)).toBe(before)
    await expect(api.recordTieWinner('v2', 'b7', 'a'.repeat(1000))).resolves.toMatchObject({ outcome: { status: 'winner' } })
  })

  it('freezes a vote once closed or decided', async () => {
    const api = createMockClient({ state: applyVoteScenario(createClubState(), 'open-tie') })
    await api.closeVote('v2')
    await expect(api.setApproval('v2', 'b8', true)).rejects.toMatchObject({ status: 409 })
    await expect(api.addCandidate('v2', 'b10')).rejects.toMatchObject({ status: 409 })
    await expect(api.removeCandidate('v2', 'b8')).rejects.toMatchObject({ status: 409 })
    await expect(api.reorderCandidates('v2', ['b9', 'b8', 'b5', 'b7'])).rejects.toMatchObject({ status: 409 })

    await api.recordTieWinner('v2', 'b7', '')
    await expect(api.recordTieWinner('v2', 'b5', '')).rejects.toMatchObject({ status: 409 })
    await expect(api.setApproval('v2', 'b8', true)).rejects.toMatchObject({ status: 409 })
    await expect(api.addCandidate('v2', 'b10')).rejects.toMatchObject({ status: 409 })
    expect((await api.getVote('v2')).outcome).toMatchObject({ winner: { id: 'b7' } })
  })

  it('can fail each new call, changing nothing until it succeeds', async () => {
    const state = applyVoteScenario(createClubState(), 'open-tie')
    const api = createMockClient({
      state,
      failures: {
        addCandidate: 1,
        removeCandidate: 1,
        reorderCandidates: 1,
        closeVote: 1,
        recordTieWinner: 1,
      },
    })
    const before = snapshot(state)
    await expect(api.addCandidate('v2', 'b10')).rejects.toMatchObject({ status: 500 })
    await expect(api.removeCandidate('v2', 'b8')).rejects.toMatchObject({ status: 500 })
    await expect(api.reorderCandidates('v2', ['b9', 'b8', 'b5', 'b7'])).rejects.toMatchObject({ status: 500 })
    await expect(api.closeVote('v2')).rejects.toMatchObject({ status: 500 })
    expect(snapshot(state)).toBe(before)
    await api.addCandidate('v2', 'b10')
    await api.removeCandidate('v2', 'b8')
    await api.reorderCandidates('v2', ['b10', 'b9', 'b5', 'b7'])
    await api.closeVote('v2')
    await expect(api.recordTieWinner('v2', 'b7', '')).rejects.toMatchObject({ status: 500 })
    await expect(api.recordTieWinner('v2', 'b7', '')).resolves.toMatchObject({ outcome: { status: 'winner' } })

    const fresh = noneState()
    const creating = createMockClient({ state: fresh, failures: { createVote: 1, openVote: 1 } })
    await expect(creating.createVote()).rejects.toMatchObject({ status: 500 })
    expect(fresh.votes).toHaveLength(2)
    const { id } = await creating.createVote()
    await creating.addCandidate(id, 'b10')
    await creating.addCandidate(id, 'b11')
    await expect(creating.openVote(id)).rejects.toMatchObject({ status: 500 })
    await expect(creating.openVote(id)).resolves.toMatchObject({ status: 'open' })
  })

  it('answers 401 before a configured failure, and the failure before 403', async () => {
    const anonymous = createMockClient({ session: 'anonymous', failures: { closeVote: 1 } })
    await expect(anonymous.closeVote('v2')).rejects.toMatchObject({ status: 401 })
    const member = createMockClient({ session: 'member', failures: { closeVote: 1 } })
    await expect(member.closeVote('v2')).rejects.toMatchObject({ status: 500 })
    await expect(member.closeVote('v2')).rejects.toMatchObject({ status: 403 })
  })
})

describe('mock vote scenario open-tie', () => {
  it('keeps Jordi’s vote open with «Marianela» and «Los pazos de Ulloa» tied at the top', async () => {
    const vote = await createMockClient({ state: applyVoteScenario(createClubState(), 'open-tie') }).getVote('v2')
    expect(vote).toMatchObject({ status: 'open', closedAt: null, outcome: null })
    expect(ids(vote)).toEqual(['b7', 'b5', 'b8', 'b9'])
    expect(counts(vote)).toEqual([5, 5, 0, 1])
  })
})
