import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../client'
import type { BookInput } from '../types'
import { blankBookInput } from '../../lib/catalogue'
import { AVATAR_MAX_BYTES } from '../../lib/profile'
import { createClubState, createEmptyState } from './fixtures'
import { createMockClient, type MockSession } from './mockClient'

const input = (patch: Partial<BookInput> = {}): BookInput => ({ ...blankBookInput(), title: 'Un verano inventado', ...patch })
const calls = [
  (api: ApiClient) => api.listAdminBooks(), (api: ApiClient) => api.getAdminBook('unknown'),
  (api: ApiClient) => api.createBook(input()), (api: ApiClient) => api.updateBook('unknown', input()),
  (api: ApiClient) => api.searchBookMetadata('jardín'),
]

describe('admin catalogue permissions and privacy', () => {
  it.each(['anonymous', 'denied', 'member', 'curator'] as MockSession[])('refuses every method before lookup with no mutation for %s', async (session) => {
    const state = createClubState()
    const api = createMockClient({ state, session })
    const before = JSON.stringify(state)
    for (const call of calls) await expect(call(api)).rejects.toMatchObject({ status: ['anonymous', 'denied'].includes(session) ? 401 : 403 })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('returns only metadata and copies so consumers cannot bypass validation', async () => {
    const api = createMockClient()
    const books = await api.listAdminBooks()
    expect(Object.keys(books[0]).sort()).toEqual(['authors','coverUrl','datesApproximate','description','id','isbn','originVote','pageCount','plannedEndDate','plannedStartDate','publicationDate','publisher','readingEndDate','readingStartDate','status','title'].sort())
    expect(JSON.stringify(books)).not.toMatch(/reviewCount|overallMean|summary|highlights|scores|schedule|meetings/)
    books[0].authors.push('Corruption')
    expect((await api.getAdminBook(books[0].id)).authors).not.toContain('Corruption')
    expect((await api.getBookRatings('b3')).club).toEqual({ status: 'locked' })
  })
})

describe('atomic catalogue validation', () => {
  it.each([
    { title: '   ' }, { title: 'x'.repeat(201) }, { authors: ['x'.repeat(121)] }, { pageCount: 0 }, { pageCount: 1.5 }, { pageCount: NaN },
    { status: 'unknown' }, { readingStartDate: '2025-02-29' }, { plannedEndDate: '2026-04-31' },
    { readingStartDate: '2026-10-10', readingEndDate: '2026-10-09' }, { plannedStartDate: '2026-12-10', plannedEndDate: '2026-12-09' },
    { cover: { action: 'replace', file: new File(['image'], 'cover.svg', { type: 'image/svg+xml' }) } },
    { cover: { action: 'replace', file: new File([], 'cover.png', { type: 'image/png' }) } },
    { cover: { action: 'replace', file: new File([new Uint8Array(AVATAR_MAX_BYTES + 1)], 'cover.png', { type: 'image/png' }) } },
    { cover: { action: 'metadata', resultId: 'unknown' } },
  ])('refuses invalid data without touching metadata or cover: %j', async (patch) => {
    const state = createClubState(), api = createMockClient({ state })
    const before = JSON.stringify(state)
    await expect(api.updateBook('b3', input(patch as Partial<BookInput>))).rejects.toMatchObject({ status: 400 })
    await expect(api.createBook(input(patch as Partial<BookInput>))).rejects.toMatchObject({ status: 400 })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('accepts minimal historical entries, trims blank metadata/authors, and checks each date pair independently', async () => {
    const api = createMockClient({ state: createEmptyState() })
    const saved = await api.createBook(input({ status: 'archivado', authors: [' ', '  Ada  '], description: ' ', plannedStartDate: '2028-02-29', plannedEndDate: '2028-03-01', readingStartDate: '2024-02-29', readingEndDate: '2024-03-01' }))
    expect(saved).toMatchObject({ title: 'Un verano inventado', authors: ['Ada'], description: null, coverUrl: null, status: 'archivado' })
    expect((await api.getBook(saved.id)).schedule).toEqual([])
    expect((await api.getBook(saved.id)).meetings).toEqual([])
  })
  it('handles unknown ids and injected save failures without any partial mutation', async () => {
    const state = createClubState(), api = createMockClient({ state, failures: { updateBook: 1, createBook: 1 } })
    const before = JSON.stringify(state)
    await expect(api.updateBook('b3', input({ cover: { action: 'remove' } }))).rejects.toMatchObject({ status: 500 })
    await expect(api.createBook(input())).rejects.toMatchObject({ status: 500 })
    await expect(api.updateBook('unknown', input())).rejects.toMatchObject({ status: 404 })
    await expect(api.getAdminBook('unknown')).rejects.toMatchObject({ status: 404 })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('enforces one active book including concurrent image reads, permits same active and multiple pending books', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const before = JSON.stringify(state), active = state.books.find((b) => b.status === 'leyendo')!
    await expect(api.createBook(input({ status: 'leyendo' }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining(active.title) })
    await expect(api.updateBook('b1', input({ status: 'leyendo' }))).rejects.toMatchObject({ status: 409 })
    expect(JSON.stringify(state)).toBe(before)
    await api.updateBook(active.id, input({ status: 'leyendo' }))
    await api.updateBook(active.id, input({ status: 'terminado' }))
    expect((await api.getHome()).currentBook).toBeNull()
    await api.createBook(input({ status: 'elegido' })); await api.createBook(input({ status: 'elegido' }))
    const outcomes = await Promise.allSettled([1, 2].map(() => api.createBook(input({ status: 'leyendo', cover: { action: 'replace', file: new File(['image'], 'x.png', { type: 'image/png' }) } }))))
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
    expect(state.books.filter((b) => b.status === 'leyendo')).toHaveLength(1)
  })
  it('uploads at the inclusive limit, keeps and removes covers only during atomic save', async () => {
    const api = createMockClient()
    const saved = await api.createBook(input({ cover: { action: 'replace', file: new File([new Uint8Array(AVATAR_MAX_BYTES)], 'x.webp', { type: 'image/webp' }) } }))
    expect(saved.coverUrl).toMatch(/^data:image\/webp;base64,/)
    expect((await api.updateBook(saved.id, input())).coverUrl).toBe(saved.coverUrl)
    expect((await api.updateBook(saved.id, input({ cover: { action: 'remove' } }))).coverUrl).toBeNull()
  })
})

describe('search and subsequent reads', () => {
  it('matches deterministic fictional titles/authors, returns empty and retryable failure, and refuses blank queries', async () => {
    const api = createMockClient({ failures: { searchBookMetadata: 1 } })
    await expect(api.searchBookMetadata('jardín')).rejects.toMatchObject({ status: 500 })
    expect(await api.searchBookMetadata('  Alba ')).toEqual(await api.searchBookMetadata('jardín'))
    expect(await api.searchBookMetadata('no matching book')).toEqual([])
    await expect(api.searchBookMetadata(' ')).rejects.toMatchObject({ status: 400 })
    const result = (await api.searchBookMetadata('jardín'))[0]
    expect(result.authors).toHaveLength(2)
    const saved = await api.createBook(input({ cover: { action: 'metadata', resultId: result.id } }))
    expect(saved.coverUrl).toBe(result.coverUrl)
  })
  it('uses one catalogue record across every consumer, retaining linked data and gates', async () => {
    const state = createClubState(), api = createMockClient({ state })
    const related = JSON.stringify({ votes: state.votes, weeks: state.weeks, meetings: state.meetings, reviews: state.reviews, completions: state.completions, finished: state.finished })
    const original = await api.getAdminBook('b3')
    await api.updateBook('b3', { ...original, title: 'Corrección del catálogo', cover: { action: 'remove' } })
    expect((await api.listBooks()).find((b) => b.id === 'b3')?.title).toBe('Corrección del catálogo')
    expect((await api.getBook('b3')).originVote).toEqual(original.originVote)
    expect((await api.getHome()).currentBook?.title).toBe('Corrección del catálogo')
    expect((await api.getBookRatings('b3')).club).toEqual({ status: 'locked' })
    expect(JSON.stringify({ votes: state.votes, weeks: state.weeks, meetings: state.meetings, reviews: state.reviews, completions: state.completions, finished: state.finished })).toBe(related)
    const saved = await api.createBook(input())
    await api.addCandidate('v2', saved.id)
    expect((await api.getVote('v2')).candidates.some((c) => c.book.id === saved.id)).toBe(true)
    await api.updateBook(saved.id, input({ status: 'elegido' }))
    expect((await api.listBooks()).filter((b) => b.status === 'propuesto').some((b) => b.id === saved.id)).toBe(false)
    expect((await api.getVote('v2')).candidates.find((c) => c.book.id === saved.id)?.book.title).toBe(saved.title)
  })
})
