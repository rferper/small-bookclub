import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../client'
import type { AdminMembers } from '../types'
import { createClubState, createEmptyState, type MockState } from './fixtures'
import { createMockClient, type MockOptions } from './mockClient'

const snapshot = (state: MockState) => JSON.stringify(state)
const keys = (value: object) => Object.keys(value).sort()
const rows = (data: AdminMembers) =>
  data.members.map((e) => [e.member.displayName, e.status, e.role, e.isMe, e.isCurator])

type AdminMethod = 'getAdminMembers' | 'addMember' | 'revokeMember' | 'restoreMember' | 'setCurator'
const ADMIN_METHODS: readonly AdminMethod[] = ['getAdminMembers', 'addMember', 'revokeMember', 'restoreMember', 'setCurator']

// One call per method with arguments that would succeed for the admin.
const CALLS: Record<AdminMethod, (api: ApiClient) => Promise<unknown>> = {
  getAdminMembers: (api) => api.getAdminMembers(),
  addMember: (api) => api.addMember({ discordId: '000000000000000999', displayName: 'Nora' }),
  revokeMember: (api) => api.revokeMember('m3'),
  restoreMember: (api) => api.restoreMember('m8'),
  setCurator: (api) => api.setCurator('m3'),
}

// Expects the call to reject with `status` and the state to be unchanged.
async function expectRefused(state: MockState, call: () => Promise<unknown>, status: number) {
  const before = snapshot(state)
  await expect(call()).rejects.toMatchObject({ status })
  expect(snapshot(state)).toBe(before)
}

const client = (options: MockOptions = {}) => {
  const state = options.state ?? createClubState()
  return { state, api: createMockClient({ random: () => 0, ...options, state }) }
}

describe('getAdminMembers with the default fixtures', () => {
  it('lists the seven active members by name, then the revoked Tomás, with the curator', async () => {
    const data = await client().api.getAdminMembers()
    expect(rows(data)).toEqual([
      ['Carmen', 'active', 'member', false, false],
      ['Elena', 'active', 'member', false, false],
      ['Inés', 'active', 'member', false, false],
      ['Jordi', 'active', 'member', false, true],
      ['Lucía', 'active', 'admin', true, false],
      ['Mateo', 'active', 'member', false, false],
      ['Pablo', 'active', 'member', false, false],
      ['Tomás', 'revoked', 'member', false, false],
    ])
    expect(data.curator).toEqual({ id: 'm6', displayName: 'Jordi', avatarUrl: null })
    const tomas = data.members[7]
    expect(tomas.revokedAt).toBe('2026-06-15T19:00:00+02:00')
    expect(data.members.slice(0, 7).every((e) => e.revokedAt === null)).toBe(true)
  })

  it('has exactly the documented keys, and no rating, review, score, bio, quote or favourite', async () => {
    const data = await client().api.getAdminMembers()
    expect(keys(data)).toEqual(['curator', 'members'])
    for (const entry of data.members) {
      expect(keys(entry)).toEqual(['addedAt', 'discordId', 'isCurator', 'isMe', 'member', 'revokedAt', 'role', 'status'])
      expect(keys(entry.member)).toEqual(['avatarUrl', 'displayName', 'id'])
    }
    expect(JSON.stringify(data)).not.toMatch(/rating|review|score|bio|quote|favourite|valoraci|overall|mean/i)
    expect(JSON.stringify(data)).not.toContain('Tomás ya no forma parte')
  })

  it('gives every member a distinct fictional 18-digit Discord id, Tomás included', async () => {
    const state = createClubState()
    const ids = [...state.members, ...state.revokedMembers].map((m) => state.accounts[m.id].discordId)
    expect(ids).toHaveLength(8)
    expect(new Set(ids).size).toBe(8)
    for (const id of ids) expect(id).toMatch(/^0{12}\d{6}$/)
    expect(Object.keys(state.accounts).sort()).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'])
  })

  it('lists only the admin in the empty club, with no curator', async () => {
    const data = await client({ state: createEmptyState() }).api.getAdminMembers()
    expect(rows(data)).toEqual([['Lucía', 'active', 'admin', true, false]])
    expect(data.curator).toBeNull()
  })
})

describe('Rule order and refusals', () => {
  it('gives 401 first when nobody is signed in, even with failures configured', async () => {
    for (const session of ['anonymous', 'denied'] as const) {
      for (const method of ADMIN_METHODS) {
        const { state, api } = client({ session, failures: { [method]: 1 } })
        await expectRefused(state, () => CALLS[method](api), 401)
      }
    }
  })

  it('applies the failures option before the 403, and then succeeds for the admin', async () => {
    for (const method of ADMIN_METHODS) {
      const member = client({ session: 'member', failures: { [method]: 1 } })
      await expectRefused(member.state, () => CALLS[method](member.api), 500)
      await expectRefused(member.state, () => CALLS[method](member.api), 403)
      const admin = client({ failures: { [method]: 1 } })
      await expectRefused(admin.state, () => CALLS[method](admin.api), 500)
      await expect(CALLS[method](admin.api)).resolves.toMatchObject({ members: expect.any(Array) })
    }
  })

  it('refuses every call with 403 as member and as the current curator', async () => {
    for (const session of ['member', 'curator'] as const) {
      for (const method of ADMIN_METHODS) {
        const { state, api } = client({ session })
        await expectRefused(state, () => CALLS[method](api), 403)
      }
    }
  })

  it('gives 403 before 404, 409 and 400', async () => {
    const { state, api } = client({ session: 'curator' })
    await expectRefused(state, () => api.revokeMember('no-existe'), 403)
    await expectRefused(state, () => api.setCurator('m8'), 403)
    await expectRefused(state, () => api.restoreMember('m3'), 403)
    await expectRefused(state, () => api.addMember({ discordId: '000000000000000103', displayName: '' }), 403)
    await expectRefused(state, () => api.addMember({ discordId: 'abc', displayName: '' }), 403)
  })

  it('gives 404 for unknown ids, and for a revoked member as curator', async () => {
    const { state, api } = client()
    await expectRefused(state, () => api.revokeMember('no-existe'), 404)
    await expectRefused(state, () => api.restoreMember('no-existe'), 404)
    await expectRefused(state, () => api.setCurator('no-existe'), 404)
    await expectRefused(state, () => api.setCurator('m8'), 404)
  })

  it('gives 409 for a duplicate id, revoking oneself or a revoked member, and restoring an active one', async () => {
    const { state, api } = client()
    // Active (Carmen) and revoked (Tomás) ids, with surrounding spaces.
    await expectRefused(state, () => api.addMember({ discordId: '000000000000000103', displayName: 'Otra' }), 409)
    await expectRefused(state, () => api.addMember({ discordId: '  000000000000000108 ', displayName: 'Otra' }), 409)
    await expectRefused(state, () => api.revokeMember('m1'), 409)
    await expectRefused(state, () => api.revokeMember('m8'), 409)
    await expectRefused(state, () => api.restoreMember('m3'), 409)
  })

  it('gives 409 for a duplicate id before 400 for an invalid name', async () => {
    const { state, api } = client()
    await expectRefused(state, () => api.addMember({ discordId: '000000000000000103', displayName: '' }), 409)
  })

  it('checks the Discord id: 17–20 ASCII digits after trimming', async () => {
    const invalid = ['', '   ', '1'.repeat(16), '1'.repeat(21), '1234567890123456a', '12345678901234567.', '１２３４５６７８９０１２３４５６７', '-12345678901234567', '123456789 01234567']
    for (const discordId of invalid) {
      const { state, api } = client()
      await expectRefused(state, () => api.addMember({ discordId, displayName: 'Nora' }), 400)
    }
    for (const discordId of ['1'.repeat(17), '2'.repeat(20), '  12345678901234567  ']) {
      const { state, api } = client()
      const data = await api.addMember({ discordId, displayName: 'Nora' })
      const added = data.members.find((e) => e.member.displayName === 'Nora')!
      expect(added.discordId).toBe(discordId.trim())
      expect(state.accounts[added.member.id].discordId).toBe(discordId.trim())
    }
  })

  it('checks the name with the #94 rules', async () => {
    for (const displayName of ['', '   ', 'a'.repeat(41), 'Nora\nRuiz', 'Nora\tRuiz', 'Nora Ruiz']) {
      const { state, api } = client()
      await expectRefused(state, () => api.addMember({ discordId: '12345678901234567', displayName }), 400)
    }
    const { api } = client()
    const data = await api.addMember({ discordId: '12345678901234567', displayName: `  ${'a'.repeat(40)}  ` })
    expect(data.members.some((e) => e.member.displayName === 'a'.repeat(40))).toBe(true)
  })

  it('refuses inputs of the wrong type with 400', async () => {
    const { state, api } = client()
    const raw = api.addMember as (input: unknown) => Promise<AdminMembers>
    await expectRefused(state, () => raw({ discordId: 1234567, displayName: 'Nora' }), 400)
    await expectRefused(state, () => raw({ discordId: '12345678901234567', displayName: null }), 400)
    await expectRefused(state, () => raw(null), 400)
  })
})

describe('Successful changes', () => {
  it('adds an active member with the member role, no avatar and an empty profile, stored trimmed', async () => {
    const { state, api } = client()
    const data = await api.addMember({ discordId: ' 123456789012345678 ', displayName: '  Nora  ' })
    const entry = data.members.find((e) => e.member.displayName === 'Nora')!
    expect(entry).toEqual({
      member: { id: entry.member.id, displayName: 'Nora', avatarUrl: null },
      discordId: '123456789012345678',
      role: 'member',
      status: 'active',
      addedAt: state.now,
      revokedAt: null,
      isMe: false,
      isCurator: false,
    })
    // Active members by name: Nora between Mateo and Pablo.
    expect(data.members.map((e) => e.member.displayName)).toEqual([
      'Carmen', 'Elena', 'Inés', 'Jordi', 'Lucía', 'Mateo', 'Nora', 'Pablo', 'Tomás',
    ])
    expect(state.profiles[entry.member.id]).toEqual({ bio: null, favouriteQuote: null, favouriteBookIds: [] })
    expect([...state.members, ...state.revokedMembers].filter((m) => m.id === entry.member.id)).toHaveLength(1)
  })

  it('revokes a member at the mock’s «now», and restores them', async () => {
    const { state, api } = client()
    const revoked = await api.revokeMember('m3')
    expect(revoked.members.at(-2)).toMatchObject({ member: { displayName: 'Carmen' }, status: 'revoked', revokedAt: state.now })
    expect(revoked.members.at(-1)).toMatchObject({ member: { displayName: 'Tomás' }, status: 'revoked' })
    const restored = await api.restoreMember('m3')
    expect(restored.members[0]).toMatchObject({ member: { displayName: 'Carmen' }, status: 'active', revokedAt: null })
    expect(restored).toEqual(await createMockClient().getAdminMembers())
  })

  it('assigns and clears the curator', async () => {
    const { state, api } = client()
    expect((await api.setCurator('m1')).curator).toEqual({ id: 'm1', displayName: 'Lucía', avatarUrl: null })
    expect((await api.getAdminMembers()).members.find((e) => e.isMe)!.isCurator).toBe(true)
    expect((await api.setCurator(null)).curator).toBeNull()
    expect(state.curatorId).toBeNull()
    // Saving the same value again is harmless.
    expect((await api.setCurator(null)).curator).toBeNull()
  })

  it('never changes anyone’s role', async () => {
    const { state, api } = client()
    const roles = () => [...state.members, ...state.revokedMembers].map((m) => [m.id, m.role]).sort()
    const before = roles()
    await api.addMember({ discordId: '12345678901234567', displayName: 'Nora' })
    await api.revokeMember('m2')
    await api.restoreMember('m2')
    await api.restoreMember('m8')
    await api.setCurator('m2')
    expect(roles()).toEqual([...before, ['m9', 'member']].sort())
  })

  it('returns a copy, so changing a response does not change the mock', async () => {
    const { api } = client()
    const data = await api.getAdminMembers()
    data.members[0].member.displayName = 'Otra'
    data.members.pop()
    expect(await api.getAdminMembers()).toEqual(await createMockClient().getAdminMembers())
  })
})

describe('Effects on the other calls', () => {
  it('shows an added member in Miembros, Inicio and «Comparar con», with an empty profile', async () => {
    const { api } = client()
    const data = await api.addMember({ discordId: '12345678901234567', displayName: 'Nora' })
    const id = data.members.find((e) => e.member.displayName === 'Nora')!.member.id
    const directory = await api.listMembers()
    expect(directory.members.find((e) => e.member.id === id)).toEqual({
      member: { id, displayName: 'Nora', avatarUrl: null },
      isMe: false,
      completedCurrentWeek: false,
    })
    expect(await api.getMemberProfile(id)).toEqual({
      member: { id, displayName: 'Nora', avatarUrl: null },
      isMe: false,
      bio: null,
      favouriteQuote: null,
      favouriteBooks: [],
      currentWeek: { weekNumber: 3, completed: false },
    })
    const home = await api.getHome()
    expect(home.memberProgress.find((p) => p.member.id === id)).toEqual({
      member: { id, displayName: 'Nora', avatarUrl: null },
      completed: false,
    })
    expect(home.stats.members).toBe(8)
    const compatibility = await api.getTasteCompatibility()
    expect(compatibility.members.find((c) => c.member.id === id)).toMatchObject({ sharedBookCount: 0 })
  })

  it('removes a revoked member from current lists but keeps their history under their name', async () => {
    const { api } = client()
    const before = {
      vote: await api.getVote('v2'),
      ratings: await api.getBookRatings('b2'),
      meeting: await api.getMeeting('mt1'),
      statistics: await api.getStatistics(),
      votes: await api.getVotes(),
    }
    await api.revokeMember('m3')

    expect((await api.listMembers()).members.map((e) => e.member.id)).not.toContain('m3')
    expect((await api.getHome()).memberProgress.map((p) => p.member.id)).not.toContain('m3')
    expect((await api.getTasteCompatibility()).members.map((c) => c.member.id)).not.toContain('m3')
    const revoked = await api.getMemberProfile('m3').catch((e: unknown) => e)
    const unknown = await api.getMemberProfile('no-existe').catch((e: unknown) => e)
    expect(revoked).toMatchObject({ status: 404 })
    expect([(revoked as Error).message]).toEqual([(unknown as Error).message])

    // Approvals in the open vote, a visible review, attendance, speakers and statistics stay.
    const vote = await api.getVote('v2')
    expect(vote).toEqual(before.vote)
    const marianela = vote.candidates.find((c) => c.book.id === 'b7')!
    expect(marianela.approvals.map((m) => m.displayName)).toContain('Carmen')
    expect(marianela.approvals).toHaveLength(5)
    expect(await api.getBookRatings('b2')).toEqual(before.ratings)
    const ratings = await api.getBookRatings('b2')
    expect(ratings.club.status === 'visible' && ratings.club.reviews.map((r) => r.member.displayName)).toContain('Carmen')
    expect(await api.getMeeting('mt1')).toEqual(before.meeting)
    expect(await api.getStatistics()).toEqual(before.statistics)
    expect(await api.getVotes()).toEqual(before.votes)
  })

  it('agrees on names and counts in every vote after a revocation', async () => {
    const { api } = client()
    for (const id of ['m3', 'm4', 'm7']) await api.revokeMember(id)
    for (const voteId of ['v0', 'v1', 'v2']) {
      for (const candidate of (await api.getVote(voteId)).candidates) {
        expect(new Set(candidate.approvals.map((m) => m.id)).size).toBe(candidate.approvals.length)
        expect(candidate.approvals.every((m) => m.displayName.length > 0)).toBe(true)
      }
    }
    const marianela = (await api.getVote('v2')).candidates.find((c) => c.book.id === 'b7')!
    expect(marianela.approvals.map((m) => m.displayName)).toEqual(['Carmen', 'Pablo', 'Inés', 'Jordi', 'Elena'])
  })

  it('clears the curator when revoking them; the open vote keeps its recorded curator', async () => {
    const { api } = client()
    const data = await api.revokeMember('m6')
    expect(data.curator).toBeNull()
    const votes = await api.getVotes()
    expect(votes.curator).toBeNull()
    expect(votes.canCreateVote).toBe(false)
    expect(votes.current!.curator).toEqual({ id: 'm6', displayName: 'Jordi', avatarUrl: null })
    // The admin still manages the open vote alone.
    expect(votes.current!.canManage).toBe(true)
    // Restoring does not give the assignment back.
    expect((await api.restoreMember('m6')).curator).toBeNull()
  })

  it('keeps a draft vote’s curator after revoking them', async () => {
    const state = createClubState()
    state.votes.find((v) => v.id === 'v2')!.status = 'draft'
    const { api } = client({ state })
    await api.revokeMember('m6')
    expect((await api.getVote('v2')).curator.displayName).toBe('Jordi')
  })

  it('lists a restored member again, with their profile as it was', async () => {
    const { api } = client()
    const profile = await api.getMemberProfile('m3')
    await api.revokeMember('m3')
    await api.restoreMember('m3')
    expect(await api.getMemberProfile('m3')).toEqual(profile)
    expect((await api.listMembers()).members.map((e) => e.member.displayName)).toContain('Carmen')
    expect((await api.getHome()).memberProgress).toHaveLength(7)
  })

  it('restores Tomás with his kept profile', async () => {
    const { api } = client()
    await api.restoreMember('m8')
    expect(await api.getMemberProfile('m8')).toMatchObject({ bio: 'Tomás ya no forma parte del club.' })
  })

  it('follows setCurator in getVotes and the #91 flags; existing votes keep their curator', async () => {
    const { api } = client()
    await api.setCurator('m3')
    const votes = await api.getVotes()
    expect(votes.curator).toEqual({ id: 'm3', displayName: 'Carmen', avatarUrl: null })
    expect(votes.current!.curator.displayName).toBe('Jordi')
    expect((await api.getVote('v1')).curator.displayName).toBe('Carmen')
    // Carmen now manages the open vote; Jordi no longer does.
    const shared = createClubState()
    const admin = createMockClient({ state: shared })
    await admin.setCurator('m3')
    shared.currentUserId = 'm3'
    expect((await admin.getVote('v2')).canManage).toBe(true)
    shared.currentUserId = 'm6'
    expect((await admin.getVote('v2')).canManage).toBe(false)
    expect((await admin.getVotes()).canCreateVote).toBe(false)
  })

  it('lets the admin prepare a vote in the empty club once a curator is assigned', async () => {
    const { api } = client({ state: createEmptyState() })
    expect((await api.getVotes()).canCreateVote).toBe(false)
    await api.setCurator('m1')
    const votes = await api.getVotes()
    expect(votes.curator).toEqual({ id: 'm1', displayName: 'Lucía', avatarUrl: null })
    expect(votes.canCreateVote).toBe(true)
  })
})

describe('No leaks to member-facing calls', () => {
  const DISCORD = /0{12}\d{6}|discord|revoked|"role"|"status":"(active|revoked)"/i

  it('never sends a Discord id, role, status or revocation to a member or the curator', async () => {
    for (const session of ['member', 'curator', 'admin'] as const) {
      const { api } = client({ session })
      const responses = await Promise.all([
        api.getHome(),
        api.listBooks(),
        api.getBook('b2'),
        api.listMeetings(),
        api.getMeeting('mt1'),
        api.getVotes(),
        api.getVote('v2'),
        api.getBookRatings('b2'),
        api.getStatistics(),
        api.getTasteCompatibility(),
        api.listMembers(),
        api.getMemberProfile('m3'),
        api.getMyProfile(),
        api.listMyReviews(),
      ])
      for (const response of responses) {
        const json = JSON.stringify(response)
        expect(json).not.toMatch(DISCORD)
        expect(json).not.toContain('Tomás')
      }
    }
  })

  it('sends no Discord id after adding, revoking and restoring', async () => {
    const state = createClubState()
    const admin = createMockClient({ state })
    await admin.addMember({ discordId: '98765432109876543', displayName: 'Nora' })
    await admin.revokeMember('m3')
    await admin.restoreMember('m8')
    state.currentUserId = 'm2'
    const responses = await Promise.all([admin.getHome(), admin.listMembers(), admin.getVotes(), admin.getStatistics(), admin.getTasteCompatibility()])
    for (const response of responses) expect(JSON.stringify(response)).not.toMatch(/98765432109876543|0{12}\d{6}|revoked/)
  })
})
