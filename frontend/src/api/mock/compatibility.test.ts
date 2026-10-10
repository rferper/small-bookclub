import { describe, expect, it } from 'vitest'
import type { CriterionScores, MemberCompatibility, TasteComparison, TasteCompatibility } from '../types'
import { createClubState, createEmptyState } from './fixtures'
import { createMockClient, type MockOptions } from './mockClient'

const getTasteCompatibility = (options: MockOptions = {}) => createMockClient(options).getTasteCompatibility()
const flat = (value: number): CriterionScores => ({ disfrute: value, estilo: value, personajes: value, trama: value, huella: value })
const close = (value: number) => expect.closeTo(value, 9)

const entryOf = (result: TasteCompatibility, name: string): MemberCompatibility => {
  const entry = result.members.find((e) => e.member.displayName === name)
  if (!entry) throw new Error(`no entry for ${name}`)
  return entry
}
const counts = (result: TasteCompatibility) => result.members.map((e) => [e.member.displayName, e.sharedBookCount])
const available = (comparison: TasteComparison) => {
  if (comparison.status !== 'available') throw new Error('expected an available comparison')
  return comparison
}

// Every catalogue book's id and title, to look for them in the serialized response.
const catalogue = () => createClubState().books.map((b) => ({ id: b.id, title: b.title }))
const mentions = (json: string, book: { id: string; title: string }) =>
  json.includes(`"${book.id}"`) || json.includes(book.title)

// The exact figures in frontend/README.md «Fixture taste compatibility».
describe('getTasteCompatibility with the default fixtures', () => {
  it('gives the default admin (Lucía) Carmen available and every other member insufficient', async () => {
    const result = await getTasteCompatibility()
    expect(result.minSharedBooks).toBe(3)
    expect(counts(result)).toEqual([
      ['Carmen', 3],
      ['Elena', 1],
      ['Inés', 2],
      ['Jordi', 1],
      ['Mateo', 1],
      ['Pablo', 1],
    ])
    const carmen = available(entryOf(result, 'Carmen').comparison)
    expect(carmen.overallDifference).toEqual(close(2.8 / 3))
    expect(carmen.criterionDifferences).toEqual({
      disfrute: close(4 / 3),
      estilo: close(2 / 3),
      personajes: close(4 / 3),
      trama: close(2.5 / 3),
      huella: close(5.5 / 3),
    })
    expect(carmen.books.map((e) => [e.book.id, e.myOverall, e.theirOverall, e.difference])).toEqual([
      ['b2', close(3.8), close(4.4), close(0.6)],
      ['b13', close(2.3), close(4.3), close(2)],
      ['b12', close(4.8), close(4.6), close(0.2)],
    ])
    for (const name of ['Elena', 'Inés', 'Jordi', 'Mateo', 'Pablo']) {
      expect(entryOf(result, name).comparison).toEqual({ status: 'insufficient' })
    }
  })

  it('gives the default member (Mateo) every member insufficient', async () => {
    const result = await getTasteCompatibility({ session: 'member' })
    expect(result.members.map((e) => [e.member.displayName, e.sharedBookCount, e.comparison])).toEqual([
      ['Carmen', 0, { status: 'insufficient' }],
      ['Elena', 1, { status: 'insufficient' }],
      ['Inés', 0, { status: 'insufficient' }],
      ['Jordi', 0, { status: 'insufficient' }],
      ['Lucía', 1, { status: 'insufficient' }],
      ['Pablo', 1, { status: 'insufficient' }],
    ])
  })

  it('gives the curator (Jordi) Lucía, Carmen and Inés 1 and the others 0', async () => {
    const result = await getTasteCompatibility({ session: 'curator' })
    expect(counts(result)).toEqual([
      ['Carmen', 1],
      ['Elena', 0],
      ['Inés', 1],
      ['Lucía', 1],
      ['Mateo', 0],
      ['Pablo', 0],
    ])
    expect(result.members.every((e) => e.comparison.status === 'insufficient')).toBe(true)
  })

  it('lists nobody in a club with only the admin', async () => {
    expect(await getTasteCompatibility({ state: createEmptyState() })).toEqual({ minSharedBooks: 3, members: [] })
  })
})

describe('getTasteCompatibility spoiler gating', () => {
  it('leaves out every book that is not shared with a member whose comparison is available', async () => {
    const json = JSON.stringify(await getTasteCompatibility())
    const shown = catalogue().filter((book) => mentions(json, book))
    expect(shown.map((book) => book.id).sort()).toEqual(['b12', 'b13', 'b2'])
    for (const id of ['b1', 'b3', 'b14']) {
      expect(json).not.toContain(`"${id}"`)
    }
    expect(json).not.toMatch(/La Regenta|Niebla|Quijote/)
  })

  it('sends the default member no book id or title at all', async () => {
    const json = JSON.stringify(await getTasteCompatibility({ session: 'member' }))
    expect(catalogue().filter((book) => mentions(json, book))).toEqual([])
    expect(json).not.toMatch(/"book"|"books"/)
  })

  it('never counts a finished book the other member has not rated', async () => {
    const result = await getTasteCompatibility()
    // Elena finished «Cumbres borrascosas» (b2) without rating it: only b12.
    expect(entryOf(result, 'Elena').sharedBookCount).toBe(1)
    // Jordi finished «Fortunata y Jacinta» (b12) without rating it: only b2.
    expect(entryOf(result, 'Jordi').sharedBookCount).toBe(1)
  })

  it('never counts a book the viewer has rated without a finished flag', async () => {
    const state = createClubState()
    // Lucía keeps her rating of «Fortunata y Jacinta» (b12) but is no longer
    // marked as finished: the book is locked for her.
    state.finished.b12 = state.finished.b12.filter((id) => id !== 'm1')
    const result = await getTasteCompatibility({ state })
    expect(counts(result)).toEqual([
      ['Carmen', 2],
      ['Elena', 0],
      ['Inés', 2],
      ['Jordi', 1],
      ['Mateo', 1],
      ['Pablo', 0],
    ])
    expect(JSON.stringify(result)).not.toMatch(/"b12"|Fortunata/)
  })

  it('gives the same answer for the same user whether their role is admin or member', async () => {
    const state = createClubState()
    const api = createMockClient({ state })
    const asAdmin = await api.getTasteCompatibility()
    state.members.find((m) => m.id === 'm1')!.role = 'member'
    const asMember = await api.getTasteCompatibility()
    expect(asMember).toEqual(asAdmin)
    expect(entryOf(asMember, 'Carmen').comparison.status).toBe('available')

    // And the default member promoted to admin gets exactly his own answer.
    const other = createClubState()
    other.members.find((m) => m.id === 'm2')!.role = 'admin'
    other.members.find((m) => m.id === 'm1')!.role = 'member'
    expect(await getTasteCompatibility({ state: other, session: 'admin' })).toEqual(
      await getTasteCompatibility({ session: 'member' }),
    )
  })
})

describe('getTasteCompatibility after rating or editing, without reloading the mock', () => {
  it('counts «Niebla» once the admin rates it', async () => {
    const api = createMockClient()
    const before = await api.getTasteCompatibility()
    for (const name of ['Mateo', 'Pablo', 'Elena']) expect(entryOf(before, name).sharedBookCount).toBe(1)

    await api.saveMyReview('b1', { scores: flat(4), text: null })
    const after = await api.getTasteCompatibility()
    for (const name of ['Mateo', 'Pablo', 'Elena']) {
      expect(entryOf(after, name)).toMatchObject({ sharedBookCount: 2, comparison: { status: 'insufficient' } })
    }
    expect(counts(after)).toEqual([
      ['Carmen', 3],
      ['Elena', 2],
      ['Inés', 2],
      ['Jordi', 1],
      ['Mateo', 2],
      ['Pablo', 2],
    ])
  })

  it('follows the admin’s edit of «Cumbres borrascosas»', async () => {
    const api = createMockClient()
    expect(available(entryOf(await api.getTasteCompatibility(), 'Carmen').comparison).overallDifference).toEqual(
      close(2.8 / 3),
    )
    await api.saveMyReview('b2', { scores: flat(4), text: null })
    const carmen = available(entryOf(await api.getTasteCompatibility(), 'Carmen').comparison)
    expect(carmen.overallDifference).toEqual(close(2.6 / 3))
    expect(carmen.books[0]).toMatchObject({ myOverall: 4, theirOverall: close(4.4), difference: close(0.4) })
  })

  it('makes Lucía available to the member once he shares 3 books with her', async () => {
    const api = createMockClient({ session: 'member' })
    await api.setBookFinished('b12', true)
    await api.saveMyReview('b12', { scores: flat(4), text: null })
    const two = entryOf(await api.getTasteCompatibility(), 'Lucía')
    expect(two).toMatchObject({ sharedBookCount: 2, comparison: { status: 'insufficient' } })

    await api.setBookFinished('b13', true)
    await api.saveMyReview('b13', { scores: flat(4), text: null })
    const three = entryOf(await api.getTasteCompatibility(), 'Lucía')
    expect(three.sharedBookCount).toBe(3)
    const lucia = available(three.comparison)
    expect(lucia.overallDifference).toEqual(close(2.9 / 3))
    expect(lucia.criterionDifferences).toEqual({
      disfrute: close(3.5 / 3),
      estilo: close(1),
      personajes: close(1),
      trama: close(2 / 3),
      huella: close(4 / 3),
    })
    // By title; «Cumbres borrascosas» (b2) is absent: Mateo has not rated it.
    expect(lucia.books.map((e) => e.book.id)).toEqual(['b14', 'b13', 'b12'])
  })
})

describe('getTasteCompatibility response shape', () => {
  const keys = (value: object) => Object.keys(value).sort()

  it('has exactly the documented keys, and no hidden, locked or total field', async () => {
    const result = await getTasteCompatibility()
    expect(keys(result)).toEqual(['members', 'minSharedBooks'])
    for (const entry of result.members) {
      expect(keys(entry)).toEqual(['comparison', 'member', 'sharedBookCount'])
      expect(keys(entry.member)).toEqual(['avatarUrl', 'displayName', 'id'])
    }
    const insufficient = entryOf(result, 'Inés').comparison
    expect(keys(insufficient)).toEqual(['status'])

    const carmen = available(entryOf(result, 'Carmen').comparison)
    expect(keys(carmen)).toEqual(['books', 'criterionDifferences', 'overallDifference', 'status'])
    expect(keys(carmen.criterionDifferences)).toEqual(['disfrute', 'estilo', 'huella', 'personajes', 'trama'])
    for (const entry of carmen.books) {
      expect(keys(entry)).toEqual(['book', 'difference', 'myOverall', 'theirOverall'])
      expect(keys(entry.book)).toEqual(['authors', 'coverUrl', 'id', 'title'])
    }
    expect(JSON.stringify(result)).not.toMatch(/locked|hidden|total|reviewCount|ratingCount/i)
  })
})

describe('getTasteCompatibility errors', () => {
  it('gives 401 when nobody is signed in', async () => {
    await expect(getTasteCompatibility({ session: 'anonymous' })).rejects.toMatchObject({ status: 401 })
    await expect(getTasteCompatibility({ session: 'denied' })).rejects.toMatchObject({ status: 401 })
  })

  it('supports the failures option', async () => {
    const api = createMockClient({ failures: { getTasteCompatibility: 1 } })
    await expect(api.getTasteCompatibility()).rejects.toMatchObject({ status: 500 })
    await expect(api.getTasteCompatibility()).resolves.toMatchObject({ minSharedBooks: 3 })
  })
})
