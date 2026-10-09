import { describe, expect, it } from 'vitest'
import { ApiError } from '../client'
import type { Vote } from '../types'
import { withUnauthorizedHandler } from '../unauthorized'
import { applyVoteScenario, createClubState, createEmptyState } from './fixtures'
import { createMockClient } from './mockClient'

// Approval counts per candidate book id, in shortlist order.
const counts = (vote: Vote) => vote.candidates.map((c) => [c.book.id, c.approvals.length])
const voterNames = (vote: Vote, bookId: string) =>
  vote.candidates.find((c) => c.book.id === bookId)!.approvals.map((m) => m.displayName)

describe('mock votes', () => {
  it('returns the curator, the open current vote and the closed history, most recently closed first', async () => {
    const votes = await createMockClient().getVotes()

    expect(votes.curator).toEqual({ id: 'm6', displayName: 'Jordi', avatarUrl: null })
    expect(votes.current).toMatchObject({
      id: 'v2',
      status: 'open',
      curator: { id: 'm6', displayName: 'Jordi' },
      openedAt: '2026-09-30T20:00:00+02:00',
      closedAt: null,
      outcome: null,
    })
    expect(votes.history).toEqual([
      {
        id: 'v1',
        curator: { id: 'm3', displayName: 'Carmen', avatarUrl: null },
        openedAt: '2026-09-01T20:00:00+02:00',
        closedAt: '2026-09-14T21:00:00+02:00',
        outcome: {
          status: 'winner',
          winner: { id: 'b3', title: 'La Regenta', authors: ['Leopoldo Alas «Clarín»'], coverUrl: null },
          tieNote: expect.stringContaining('Empate a cuatro votos'),
        },
        candidateCount: 3,
      },
      {
        id: 'v0',
        curator: { id: 'm4', displayName: 'Pablo', avatarUrl: null },
        openedAt: '2024-09-12T20:00:00+02:00',
        closedAt: '2024-09-26T21:00:00+02:00',
        outcome: {
          status: 'winner',
          winner: { id: 'b2', title: 'Cumbres borrascosas', authors: ['Emily Brontë'], coverUrl: null },
          tieNote: null,
        },
        candidateCount: 3,
      },
    ])
  })

  it('returns a vote with its candidates in shortlist order, their metadata, approvals and the user’s own', async () => {
    const vote = await createMockClient().getVote('v2')

    expect(vote.candidates.map((c) => c.book.title)).toEqual([
      'Marianela',
      'Los pazos de Ulloa',
      'La gaviota',
      'La vida del Buscón llamado don Pablos, ejemplo de vagamundos y espejo de tacaños',
    ])
    expect(vote.candidates[0]).toEqual({
      book: {
        id: 'b7',
        title: 'Marianela',
        authors: ['Benito Pérez Galdós'],
        coverUrl: '/covers/marianela.svg',
        publicationDate: '1878',
        pageCount: 256,
      },
      approvals: ['m3', 'm4', 'm5', 'm6', 'm7'].map((id) => expect.objectContaining({ id })),
      approvedByMe: false,
    })
    // «Los pazos de Ulloa» has no cover, publication date or page count.
    expect(vote.candidates[1].book).toMatchObject({ coverUrl: null, publicationDate: null, pageCount: null })
    expect(counts(vote)).toEqual([
      ['b7', 5],
      ['b5', 2],
      ['b8', 0],
      ['b9', 1],
    ])
    // The default session is the admin, who approved «Los pazos de Ulloa».
    expect(vote.candidates.map((c) => c.approvedByMe)).toEqual([false, true, false, false])
  })

  it('returns both outcome shapes for closed votes, and none for open ones', async () => {
    const api = createMockClient()
    const v1 = await api.getVote('v1')
    expect(v1).toMatchObject({ status: 'closed', closedAt: '2026-09-14T21:00:00+02:00' })
    expect(v1.outcome).toEqual({
      status: 'winner',
      winner: { id: 'b3', title: 'La Regenta', authors: ['Leopoldo Alas «Clarín»'], coverUrl: null },
      tieNote:
        'Empate a cuatro votos entre «La Regenta» y «Pepita Jiménez».\n' +
        'Lo decidimos entre todos a mano alzada. «Pepita Jiménez» queda elegida para después.',
    })
    // The losing candidates stay in the closed vote with their approvals.
    expect(counts(v1)).toEqual([
      ['b4', 4],
      ['b3', 4],
      ['b5', 1],
    ])
    expect((await api.getVote('v0')).outcome).toMatchObject({ status: 'winner', winner: { id: 'b2' }, tieNote: null })

    const tie = createMockClient({ state: applyVoteScenario(createClubState(), 'tie') })
    expect((await tie.getVote('v2')).outcome).toEqual({ status: 'tiePending', tiedBookIds: ['b7', 'b5'] })
  })

  it('gives every member the same vote data; only approvedByMe depends on who is signed in', async () => {
    const strip = (vote: Vote) => ({ ...vote, candidates: vote.candidates.map((c) => ({ ...c, approvedByMe: null })) })
    const asAdmin = await createMockClient({ session: 'admin' }).getVote('v2')
    const asMember = await createMockClient({ session: 'member' }).getVote('v2')
    const asCurator = await createMockClient({ session: 'curator' }).getVote('v2')

    expect(strip(asMember)).toEqual(strip(asAdmin))
    expect(strip(asCurator)).toEqual(strip(asAdmin))
    expect(asMember.candidates.map((c) => c.approvedByMe)).toEqual([false, false, false, true])
    expect(asCurator.candidates.map((c) => c.approvedByMe)).toEqual([true, false, false, false])
    // Closed votes keep every voter's name too.
    expect(await createMockClient({ session: 'member' }).getVotes()).toMatchObject({ history: [{ id: 'v1' }, { id: 'v0' }] })
    expect(voterNames(await createMockClient({ session: 'member' }).getVote('v1'), 'b3')).toEqual([
      'Lucía',
      'Carmen',
      'Inés',
      'Jordi',
    ])
  })

  it('approves and withdraws for the signed-in user, once per candidate', async () => {
    const state = createClubState()
    const api = createMockClient({ state, session: 'member' })

    let vote = await api.setApproval('v2', 'b7', true)
    expect(vote.candidates[0]).toMatchObject({ approvedByMe: true })
    expect(voterNames(vote, 'b7')).toEqual(['Carmen', 'Pablo', 'Inés', 'Jordi', 'Elena', 'Mateo'])

    // Approving twice leaves one approval.
    vote = await api.setApproval('v2', 'b7', true)
    expect(counts(vote)[0]).toEqual(['b7', 6])

    vote = await api.setApproval('v2', 'b7', false)
    expect(vote.candidates[0]).toMatchObject({ approvedByMe: false })
    expect(counts(vote)[0]).toEqual(['b7', 5])

    // Withdrawing an approval that does not exist changes nothing.
    vote = await api.setApproval('v2', 'b7', false)
    expect(counts(vote)[0]).toEqual(['b7', 5])
    expect(state.votes.find((v) => v.id === 'v2')!.candidates[0].approverIds).toEqual(['m3', 'm4', 'm5', 'm6', 'm7'])
    expect(await api.getVote('v2')).toEqual(vote)
  })

  it('counts each approval once: approving 3 of 4 candidates adds one to each of those 3', async () => {
    const api = createMockClient({ session: 'curator' })
    await api.setApproval('v2', 'b5', true)
    await api.setApproval('v2', 'b8', true)
    const vote = await api.setApproval('v2', 'b9', true)

    // The curator (Jordi) had already approved «Marianela», which is unchanged.
    expect(counts(vote)).toEqual([
      ['b7', 5],
      ['b5', 3],
      ['b8', 1],
      ['b9', 2],
    ])
    expect(vote.candidates.every((c) => c.approvedByMe)).toBe(true)
  })

  it('never changes another member’s approvals', async () => {
    const state = createClubState()
    const api = createMockClient({ state, session: 'member' })

    // Mateo withdrawing from «Los pazos de Ulloa», which Lucía and Pablo approved, changes nothing.
    await api.setApproval('v2', 'b5', false)
    expect(state.votes[0].candidates[1].approverIds).toEqual(['m1', 'm4'])
    await api.setApproval('v2', 'b9', false)
    expect(state.votes[0].candidates[3].approverIds).toEqual([])
  })

  it('refuses approvals on a draft or closed vote with a 409 and changes nothing', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const before = JSON.stringify(state.votes)
    await expect(api.setApproval('v1', 'b4', true)).rejects.toMatchObject({ status: 409 })
    await expect(api.setApproval('v1', 'b3', false)).rejects.toMatchObject({ status: 409 })
    expect(JSON.stringify(state.votes)).toBe(before)

    const draft = applyVoteScenario(createClubState(), 'draft')
    const draftApi = createMockClient({ state: draft })
    const error = await draftApi.setApproval('v2', 'b7', true).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409 })
    expect(counts(await draftApi.getVote('v2')).map(([, n]) => n)).toEqual([0, 0, 0, 0])
  })

  it('rejects an unknown vote and a book that is not a candidate with a 404', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const before = JSON.stringify(state.votes)

    await expect(api.getVote('no-existe')).rejects.toMatchObject({ status: 404 })
    await expect(api.setApproval('no-existe', 'b7', true)).rejects.toMatchObject({ status: 404 })
    // «Niebla» is a book, but not a candidate of the open vote.
    await expect(api.setApproval('v2', 'b1', true)).rejects.toMatchObject({ status: 404 })
    await expect(api.setApproval('v2', 'no-existe', true)).rejects.toMatchObject({ status: 404 })
    expect(JSON.stringify(state.votes)).toBe(before)
  })

  describe.each(['anonymous', 'denied'] as const)('while the session is %s', (session) => {
    it('refuses all vote calls with a 401, before 404 and 409, and changes nothing', async () => {
      const state = createClubState()
      const api = createMockClient({ state, session })
      const before = JSON.stringify(state.votes)

      await expect(api.getVotes()).rejects.toMatchObject({ status: 401 })
      await expect(api.getVote('v2')).rejects.toMatchObject({ status: 401 })
      await expect(api.getVote('no-existe')).rejects.toMatchObject({ status: 401 })
      await expect(api.setApproval('v2', 'b7', true)).rejects.toMatchObject({ status: 401 })
      await expect(api.setApproval('v1', 'b4', true)).rejects.toMatchObject({ status: 401 })
      await expect(api.setApproval('no-existe', 'b7', true)).rejects.toMatchObject({ status: 401 })
      await expect(api.setApproval('v2', 'b1', true)).rejects.toMatchObject({ status: 401 })
      expect(JSON.stringify(state.votes)).toBe(before)
    })
  })

  it('goes through the 401 handler for every vote call', async () => {
    let unauthorized = 0
    const api = withUnauthorizedHandler(createMockClient({ session: 'anonymous' }), () => unauthorized++)

    await expect(api.getVotes()).rejects.toMatchObject({ status: 401 })
    await expect(api.getVote('v2')).rejects.toMatchObject({ status: 401 })
    await expect(api.setApproval('v2', 'b7', true)).rejects.toMatchObject({ status: 401 })
    expect(unauthorized).toBe(3)
  })

  it('can fail the vote calls', async () => {
    const state = createClubState()
    const api = createMockClient({ state, failures: { getVotes: 1, getVote: 1, setApproval: 1 } })

    await expect(api.getVotes()).rejects.toMatchObject({ status: 500 })
    await expect(api.getVotes()).resolves.toMatchObject({ current: { id: 'v2' } })
    await expect(api.getVote('v2')).rejects.toMatchObject({ status: 500 })
    await expect(api.getVote('v2')).resolves.toMatchObject({ id: 'v2' })
    await expect(api.setApproval('v2', 'b7', true)).rejects.toMatchObject({ status: 500 })
    expect(state.votes[0].candidates[0].approverIds).not.toContain('m1')
    expect((await api.setApproval('v2', 'b7', true)).candidates[0].approvedByMe).toBe(true)
  })

  it('signs in as the current curator, with the member role', async () => {
    await expect(createMockClient({ session: 'curator' }).getSession()).resolves.toEqual({
      status: 'signedIn',
      user: { id: 'm6', displayName: 'Jordi', role: 'member', avatarUrl: null },
    })
    expect(() => createMockClient({ session: 'curator', state: createEmptyState() })).toThrow(/curator/)
  })

  it('has no curator, current vote or history in a new club', async () => {
    await expect(createMockClient({ state: createEmptyState() }).getVotes()).resolves.toEqual({
      curator: null,
      current: null,
      history: [],
    })
  })

  describe('vote scenarios', () => {
    it('draft: the current vote has its shortlist, no approvals and no opening date', async () => {
      const votes = await createMockClient({ state: applyVoteScenario(createClubState(), 'draft') }).getVotes()

      expect(votes.current).toMatchObject({ id: 'v2', status: 'draft', openedAt: null, closedAt: null, outcome: null })
      expect(votes.current!.candidates).toHaveLength(4)
      expect(votes.current!.candidates.every((c) => c.approvals.length === 0 && !c.approvedByMe)).toBe(true)
      expect(votes.history.map((v) => v.id)).toEqual(['v1', 'v0'])
    })

    it('tie: there is no current vote and the pending tie heads the history', async () => {
      const votes = await createMockClient({ state: applyVoteScenario(createClubState(), 'tie') }).getVotes()

      expect(votes.curator?.displayName).toBe('Jordi')
      expect(votes.current).toBeNull()
      expect(votes.history.map((v) => v.id)).toEqual(['v2', 'v1', 'v0'])
      expect(votes.history[0]).toMatchObject({
        closedAt: '2026-10-07T21:00:00+02:00',
        outcome: { status: 'tiePending', tiedBookIds: ['b7', 'b5'] },
        candidateCount: 4,
      })
    })

    it('none: a curator but no current vote', async () => {
      const votes = await createMockClient({ state: applyVoteScenario(createClubState(), 'none') }).getVotes()

      expect(votes.curator?.displayName).toBe('Jordi')
      expect(votes.current).toBeNull()
      expect(votes.history.map((v) => v.id)).toEqual(['v1', 'v0'])
    })
  })
})
