import { describe, expect, it } from 'vitest'
import { ApiError } from '../client'
import type { MemberDirectory, MemberProfile } from '../types'
import { createClubState, createEmptyState } from './fixtures'
import { createMockClient, type MockOptions } from './mockClient'

const listMembers = (options: MockOptions = {}) => createMockClient(options).listMembers()
const getMemberProfile = (memberId: string, options: MockOptions = {}) => createMockClient(options).getMemberProfile(memberId)
const keys = (value: object) => Object.keys(value).sort()
const rows = (directory: MemberDirectory) =>
  directory.members.map((e) => [e.member.displayName, e.isMe, e.completedCurrentWeek])
const ACTIVE_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']

// No role, Discord, revocation, approval, review, rating, score or mean data.
const FORBIDDEN = /role|admin|discord|revoked|approv|review|rating|score|mean|overall|valoraci|"n"/i

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    return error as ApiError
  }
  throw new Error('expected the call to reject')
}

describe('listMembers with the default fixtures', () => {
  it('lists the seven active members by name, the admin as «tú», with week 3 read by Carmen and Jordi', async () => {
    const directory = await listMembers()
    expect(directory.currentWeekNumber).toBe(3)
    expect(rows(directory)).toEqual([
      ['Carmen', false, true],
      ['Elena', false, false],
      ['Inés', false, false],
      ['Jordi', false, true],
      ['Lucía', true, false],
      ['Mateo', false, false],
      ['Pablo', false, false],
    ])
  })

  it('marks the default member (Mateo) as «tú»', async () => {
    const directory = await listMembers({ session: 'member' })
    expect(directory.members.filter((e) => e.isMe).map((e) => e.member.displayName)).toEqual(['Mateo'])
  })

  it('orders by name with Spanish collation, never by progress', async () => {
    const state = createClubState()
    state.members.push({ id: 'm9', displayName: 'Íñigo', avatarUrl: null, role: 'member' })
    state.completions.w3 = ['m4', 'm9']
    const directory = await listMembers({ state })
    expect(directory.members.map((e) => e.member.displayName)).toEqual([
      'Carmen',
      'Elena',
      'Inés',
      'Íñigo',
      'Jordi',
      'Lucía',
      'Mateo',
      'Pablo',
    ])
  })

  it('has no week number and null statuses when there is no current week', async () => {
    const state = createClubState()
    state.books.find((b) => b.id === 'b3')!.status = 'terminado'
    const directory = await listMembers({ state })
    expect(directory.currentWeekNumber).toBeNull()
    expect(directory.members).toHaveLength(7)
    expect(directory.members.every((e) => e.completedCurrentWeek === null)).toBe(true)
  })

  it('lists only the admin in the empty club, with no week', async () => {
    expect(await listMembers({ state: createEmptyState() })).toEqual({
      currentWeekNumber: null,
      members: [{ member: { id: 'm1', displayName: 'Lucía', avatarUrl: null }, isMe: true, completedCurrentWeek: null }],
    })
  })
})

describe('getMemberProfile with the default fixtures', () => {
  it('gives Carmen her full profile: two-line bio with literal markup, a quote and three favourites in order', async () => {
    const profile = await getMemberProfile('m3')
    expect(profile).toEqual({
      member: { id: 'm3', displayName: 'Carmen', avatarUrl: null },
      isMe: false,
      bio: expect.stringContaining('\n'),
      favouriteQuote: expect.any(String),
      favouriteBooks: [
        { id: 'b2', title: 'Cumbres borrascosas', authors: ['Emily Brontë'], coverUrl: null },
        { id: 'b12', title: 'Fortunata y Jacinta', authors: ['Benito Pérez Galdós'], coverUrl: null },
        { id: 'b14', title: 'El ingenioso hidalgo don Quijote de la Mancha', authors: ['Miguel de Cervantes'], coverUrl: null },
      ],
      currentWeek: { weekNumber: 3, completed: true },
    })
    expect(profile.bio).toContain('<b>')
    expect(profile.bio).toContain('<script>')
  })

  it('gives Inés a long bio with no quote', async () => {
    const profile = await getMemberProfile('m5')
    expect(profile.bio!.length).toBeGreaterThanOrEqual(400)
    expect(profile.favouriteQuote).toBeNull()
    expect(profile.currentWeek).toEqual({ weekNumber: 3, completed: false })
  })

  it('gives Pablo an empty profile', async () => {
    const profile = await getMemberProfile('m4')
    expect([profile.bio, profile.favouriteQuote, profile.favouriteBooks]).toEqual([null, null, []])
  })

  it('marks the viewer’s own profile with isMe', async () => {
    expect((await getMemberProfile('m1')).isMe).toBe(true)
    expect((await getMemberProfile('m1', { session: 'member' })).isMe).toBe(false)
    expect((await getMemberProfile('m2', { session: 'member' })).isMe).toBe(true)
  })

  it('gives the admin an empty profile in the empty club', async () => {
    expect(await getMemberProfile('m1', { state: createEmptyState() })).toEqual({
      member: { id: 'm1', displayName: 'Lucía', avatarUrl: null },
      isMe: true,
      bio: null,
      favouriteQuote: null,
      favouriteBooks: [],
      currentWeek: null,
    })
  })

  it('has only books the club has read as favourites, at most 5, and every avatar null', () => {
    const state = createClubState()
    const read = new Set(state.books.filter((b) => b.status === 'terminado' || b.status === 'archivado').map((b) => b.id))
    for (const profile of Object.values(state.profiles)) {
      expect(profile.favouriteBookIds.length).toBeLessThanOrEqual(5)
      for (const id of profile.favouriteBookIds) expect(read.has(id)).toBe(true)
    }
    expect([...state.members, ...state.revokedMembers].every((m) => m.avatarUrl === null)).toBe(true)
  })
})

describe('Revoked members', () => {
  it('leaves the revoked member out of the directory entirely', async () => {
    const json = JSON.stringify(await listMembers())
    expect(json).not.toContain('m8')
    expect(json).not.toContain('Tomás')
  })

  it('gives the same 404 for the revoked member as for an unknown id', async () => {
    const revoked = await rejection(getMemberProfile('m8'))
    const unknown = await rejection(getMemberProfile('no-existe'))
    expect(revoked).toBeInstanceOf(ApiError)
    expect(revoked.status).toBe(404)
    expect([revoked.status, revoked.message]).toEqual([unknown.status, unknown.message])
    expect(revoked.message).not.toContain('Tomás')
  })

  it('changes no other call: Inicio, Votaciones, Estadísticas and compatibility never mention them', async () => {
    const api = createMockClient({ random: () => 0 })
    const responses = await Promise.all([
      api.getHome(),
      api.getVotes(),
      api.getStatistics(),
      api.getTasteCompatibility(),
      api.listMeetings(),
      api.getMeeting('mt1'),
      api.getBookRatings('b12'),
    ])
    const home = responses[0]
    expect(home.memberProgress).toHaveLength(7)
    expect(home.stats.members).toBe(7)
    for (const response of responses) expect(JSON.stringify(response)).not.toMatch(/"m8"|Tomás/)
  })
})

describe('Weekly status consistency with Inicio', () => {
  it('agrees with getHome().memberProgress for every member', async () => {
    const api = createMockClient({ random: () => 0 })
    const home = await api.getHome()
    const directory = await api.listMembers()
    const fromHome = Object.fromEntries(home.memberProgress.map((p) => [p.member.id, p.completed]))
    const fromDirectory = Object.fromEntries(directory.members.map((e) => [e.member.id, e.completedCurrentWeek]))
    expect(fromDirectory).toEqual(fromHome)
    expect(directory.currentWeekNumber).toBe(home.currentWeek!.weekNumber)
  })

  it('follows setWeekCompleted for the current week without reloading the mock', async () => {
    const api = createMockClient()
    const mine = async () => (await api.listMembers()).members.find((e) => e.isMe)!.completedCurrentWeek
    expect(await mine()).toBe(false)
    expect((await api.getMemberProfile('m1')).currentWeek).toEqual({ weekNumber: 3, completed: false })

    await api.setWeekCompleted('w3', true)
    expect(await mine()).toBe(true)
    expect((await api.getMemberProfile('m1')).currentWeek).toEqual({ weekNumber: 3, completed: true })

    await api.setWeekCompleted('w3', false)
    expect(await mine()).toBe(false)
    expect((await api.getMemberProfile('m1')).currentWeek).toEqual({ weekNumber: 3, completed: false })
  })

  it('ignores the completion of other weeks', async () => {
    const api = createMockClient()
    await api.setWeekCompleted('w4', true)
    expect((await api.getMemberProfile('m1')).currentWeek).toEqual({ weekNumber: 3, completed: false })
  })
})

describe('Role parity', () => {
  it('gives the same viewer an identical answer from both calls whether they are admin or member', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const asAdmin = [await api.listMembers(), ...(await Promise.all(ACTIVE_IDS.map((id) => api.getMemberProfile(id))))]
    state.members.find((m) => m.id === 'm1')!.role = 'member'
    const asMember = [await api.listMembers(), ...(await Promise.all(ACTIVE_IDS.map((id) => api.getMemberProfile(id))))]
    expect(asMember).toEqual(asAdmin)
  })
})

describe('Response shapes', () => {
  const expectProfileShape = (profile: MemberProfile) => {
    expect(keys(profile)).toEqual(['bio', 'currentWeek', 'favouriteBooks', 'favouriteQuote', 'isMe', 'member'])
    expect(keys(profile.member)).toEqual(['avatarUrl', 'displayName', 'id'])
    if (profile.currentWeek) expect(keys(profile.currentWeek)).toEqual(['completed', 'weekNumber'])
    for (const book of profile.favouriteBooks) expect(keys(book)).toEqual(['authors', 'coverUrl', 'id', 'title'])
  }

  it('has exactly the documented keys in the directory, and no role or rating data', async () => {
    for (const session of ['admin', 'member'] as const) {
      const directory = await listMembers({ session })
      expect(keys(directory)).toEqual(['currentWeekNumber', 'members'])
      for (const entry of directory.members) {
        expect(keys(entry)).toEqual(['completedCurrentWeek', 'isMe', 'member'])
        expect(keys(entry.member)).toEqual(['avatarUrl', 'displayName', 'id'])
      }
      expect(JSON.stringify(directory)).not.toMatch(FORBIDDEN)
    }
  })

  it('has exactly the documented keys in every profile, and no role or rating data', async () => {
    for (const session of ['admin', 'member'] as const) {
      const api = createMockClient({ session })
      for (const id of ACTIVE_IDS) {
        const profile = await api.getMemberProfile(id)
        expectProfileShape(profile)
        // The keys, not the members' own words, must carry no rating data.
        const structure = JSON.stringify({ ...profile, bio: null, favouriteQuote: null })
        expect(structure).not.toMatch(FORBIDDEN)
      }
    }
    const state = createClubState()
    state.books.find((b) => b.id === 'b3')!.status = 'terminado'
    const noWeek = await getMemberProfile('m3', { state })
    expect(noWeek.currentWeek).toBeNull()
    expectProfileShape(noWeek)
  })

  it('returns a copy, so changing a response does not change the mock', async () => {
    const api = createMockClient()
    const profile = await api.getMemberProfile('m3')
    profile.favouriteBooks.pop()
    profile.member.displayName = 'Otra'
    expect((await api.getMemberProfile('m3')).favouriteBooks).toHaveLength(3)
    expect((await api.getMemberProfile('m3')).member.displayName).toBe('Carmen')
  })
})

describe('Errors', () => {
  it('gives 401 when nobody is signed in', async () => {
    for (const session of ['anonymous', 'denied'] as const) {
      await expect(listMembers({ session })).rejects.toMatchObject({ status: 401 })
      await expect(getMemberProfile('m3', { session })).rejects.toMatchObject({ status: 401 })
      // A 401 comes first, even for a revoked id.
      await expect(getMemberProfile('m8', { session })).rejects.toMatchObject({ status: 401 })
    }
  })

  it('supports the failures option', async () => {
    const api = createMockClient({ failures: { listMembers: 1, getMemberProfile: 1 } })
    await expect(api.listMembers()).rejects.toMatchObject({ status: 500 })
    await expect(api.listMembers()).resolves.toMatchObject({ currentWeekNumber: 3 })
    await expect(api.getMemberProfile('m3')).rejects.toMatchObject({ status: 500 })
    await expect(api.getMemberProfile('m3')).resolves.toMatchObject({ isMe: false })
  })
})
