/// <reference types="node" />
import { beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { ApiError, type ApiClient } from '../client'
import { apiError, bookMultipart, errorEnvelope, multipartFormData, profileMultipart } from '../adapters'
import type { BookInput, ProfileUpdate, ReviewInput, NewMember } from '../types'
import { readContract, schemaValidators, type ContractDocument } from '../../../scripts/contract.mjs'
import { createClubState, createEmptyState } from './fixtures'
import { createMockClient } from './mockClient'

let contract: ContractDocument
let validators: ReturnType<typeof schemaValidators>
beforeAll(async () => {
  contract = await readContract(resolve(process.cwd(), '../openapi.yaml'))
  validators = schemaValidators(contract)
})

function operation(name: keyof ApiClient) {
  for (const path of Object.values(contract.paths)) {
    for (const value of Object.values(path)) if (value.operationId === name) return value
  }
  throw new Error(`Missing contract operation ${name}`)
}

function conforms(name: keyof ApiClient, value: unknown) {
  const response = operation(name).responses?.['200'] ?? operation(name).responses?.['201']
  const schema = response?.content?.['application/json']?.schema
  if (!schema) throw new Error(`No JSON success schema for ${name}`)
  const validate = validators.inline(schema)
  expect(validate(value), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true)
}

function rejectsExtra(name: keyof ApiClient, value: unknown) {
  const schema = operation(name).responses?.['200']?.content?.['application/json']?.schema
  if (!schema) throw new Error(`No JSON success schema for ${name}`)
  expect(validators.inline(schema)(value)).toBe(false)
}

describe('actual mock public results conform to operation success schemas', () => {
  it.each(['anonymous', 'denied', 'member', 'admin', 'curator'] as const)('validates %s session without invented HTTP results', async (session) => {
    conforms('getSession', await createMockClient({ session }).getSession())
  })

  it.each(['normal', 'empty'] as const)('validates %s home, catalogue, calendar, votes and personal views', async (variant) => {
    const api = createMockClient({ state: variant === 'empty' ? createEmptyState() : createClubState() })
    conforms('getHome', await api.getHome())
    const books = await api.listBooks()
    conforms('listBooks', books)
    for (const book of books) conforms('getBook', await api.getBook(book.id))
    conforms('listMeetings', await api.listMeetings())
    conforms('getVotes', await api.getVotes())
    conforms('listMembers', await api.listMembers())
    conforms('getMyProfile', await api.getMyProfile())
    conforms('listMyReviews', await api.listMyReviews())
    conforms('getStatistics', await api.getStatistics())
    conforms('getTasteCompatibility', await api.getTasteCompatibility())
    conforms('getRatingRubric', await api.getRatingRubric())
  })

  it.each(['admin', 'member'] as const)('validates every fixture rating, record, vote and active profile for %s', async (session) => {
    const state = createClubState(), api = createMockClient({ state, session })
    for (const book of state.books) conforms('getBookRatings', await api.getBookRatings(book.id))
    for (const meeting of state.meetings) conforms('getMeeting', await api.getMeeting(meeting.id))
    for (const vote of state.votes) conforms('getVote', await api.getVote(vote.id))
    for (const member of state.members) conforms('getMemberProfile', await api.getMemberProfile(member.id))
    conforms('getStatistics', await api.getStatistics())
    conforms('getTasteCompatibility', await api.getTasteCompatibility())
  })

  it('exercises actual unlocked ratings, visible records, available statistics and sufficient compatibility', async () => {
    const api = createMockClient()
    const ratings = await api.getBookRatings('b2')
    expect(ratings.club.status).toBe('visible')
    conforms('getBookRatings', ratings)
    const meeting = await api.getMeeting('mt1')
    expect(meeting.record.status).toBe('visible')
    conforms('getMeeting', meeting)
    const statistics = await api.getStatistics()
    expect(statistics.ratings.status).toBe('available')
    conforms('getStatistics', statistics)
    const compatibility = await api.getTasteCompatibility()
    expect(compatibility.members.some((member) => member.comparison.status === 'available')).toBe(true)
    conforms('getTasteCompatibility', compatibility)
  })

  it('validates operational editors, mutations, bin, backups and audit projections', async () => {
    const state = createClubState(), api = createMockClient({ state })
    conforms('getAdminMembers', await api.getAdminMembers())
    conforms('listAdminBooks', await api.listAdminBooks())
    for (const book of state.books) {
      conforms('getAdminBook', await api.getAdminBook(book.id))
      conforms('getAdminReadingPlan', await api.getAdminReadingPlan(book.id))
    }
    conforms('listAdminMeetings', await api.listAdminMeetings())
    for (const meeting of state.meetings) {
      conforms('getAdminMeeting', await api.getAdminMeeting(meeting.id))
      conforms('getAdminMeetingRecord', await api.getAdminMeetingRecord(meeting.id))
    }
    conforms('listAdminQuotes', await api.listAdminQuotes())
    conforms('searchBookMetadata', await api.searchBookMetadata('Marianela'))
    conforms('getBackupInfo', await api.getBackupInfo())
    conforms('getRecycleBin', await api.getRecycleBin())
    conforms('getDeletionPreview', await api.getDeletionPreview('book', 'b3'))
    conforms('deleteBook', await api.deleteBook('b3'))
    conforms('getRecycleBin', await api.getRecycleBin())
    conforms('restoreDeleted', await api.restoreDeleted('book', 'b3'))
    conforms('saveMeetingSummary', await api.saveMeetingSummary('mt1', { text: 'Resumen ficticio', published: false }))
    conforms('getAuditLog', await api.getAuditLog())
  })

  it('rejects sensitive extra fields on actual restricted branches', async () => {
    const api = createMockClient({ session: 'member' })
    const locked = await api.getBookRatings('b2')
    expect(locked.club.status).toBe('locked')
    rejectsExtra('getBookRatings', { ...locked, club: { ...locked.club, reviews: [] } })
    await api.setWeekCompleted('w1', false)
    const meeting = await api.getMeeting('mt1')
    expect(meeting.record.status).toBe('lockedWeekNotRead')
    rejectsExtra('getMeeting', { ...meeting, record: { ...meeting.record, summary: 'Hidden spoiler' } })
    const empty = createMockClient({ state: createEmptyState() })
    const statistics = await empty.getStatistics()
    rejectsExtra('getStatistics', { ...statistics, ratings: { ...statistics.ratings, overallMean: 4 } })
    const compatibility = await api.getTasteCompatibility()
    const insufficient = compatibility.members.find((member) => member.comparison.status === 'insufficient')
    expect(insufficient).toBeDefined()
    rejectsExtra('getTasteCompatibility', { ...compatibility, members: [{ ...insufficient, comparison: { ...insufficient!.comparison, books: [] } }] })
    const anonymous = await createMockClient({ session: 'anonymous' }).getSession()
    rejectsExtra('getSession', { ...anonymous, user: { id: 'hidden' } })
  })
})

describe('generated input and deliberately local adapter boundaries', () => {
  it('validates generated review and member inputs consumed by the actual client', async () => {
    const review: ReviewInput = { scores: { disfrute: 4, estilo: 4, personajes: 4, trama: 4, huella: 4 }, text: 'Resena ficticia' }
    const member: NewMember = { discordId: '00000000000000123', displayName: 'Persona ficticia' }
    for (const [name, input] of [['saveMyReview', review], ['addMember', member]] as const) {
      const schema = operation(name).requestBody?.content['application/json']?.schema
      if (!schema) throw new Error(`Missing input schema ${name}`)
      const validate = validators.inline(schema)
      expect(validate(input), JSON.stringify(validate.errors)).toBe(true)
      expect(validate({ ...input, memberId: 'someone-else' })).toBe(false)
    }
    const api = createMockClient()
    conforms('saveMyReview', await api.saveMyReview('b2', review))
    conforms('addMember', await api.addMember(member))
  })

  it.each(['keep', 'remove', 'replace'] as const)('adapts profile %s to declared multipart parts', async (action) => {
    const file = new File(['fictional bytes'], 'fiction.png', { type: 'image/png' })
    const input: ProfileUpdate = {
      displayName: 'Persona ficticia', favouriteBookIds: [],
      avatar: action === 'replace' ? { action, file } : { action },
    }
    const parts = profileMultipart(input)
    expect(validators.named('ProfileMetadata')(parts.metadata)).toBe(true)
    // AJV validates the multipart wire shape with a binary placeholder; bytes stay File.
    const wire = 'avatar' in parts ? { metadata: parts.metadata, avatar: 'binary bytes' } : parts
    expect(validators.named('ProfileMultipart')(wire)).toBe(true)
    expect(validators.named('ProfileMultipart')({ metadata: parts.metadata, avatar: action === 'replace' ? undefined : 'unexpected bytes' })).toBe(false)
    const form = multipartFormData(parts)
    expect(form.get('metadata')).toBeInstanceOf(Blob)
    expect(form.has('avatar')).toBe(action === 'replace')
    if (action === 'replace') expect(parts.avatar).toBe(file)
  })

  it.each(['keep', 'remove', 'replace', 'metadata'] as const)('adapts book %s to declared multipart parts', async (action) => {
    const file = new File(['fictional bytes'], 'cover.png', { type: 'image/png' })
    const current = await createMockClient().getAdminBook('b3')
    const input: BookInput = {
      title: current.title, authors: current.authors, status: current.status,
      isbn: current.isbn, publisher: current.publisher, publicationDate: current.publicationDate,
      pageCount: current.pageCount, description: current.description,
      readingStartDate: current.readingStartDate, readingEndDate: current.readingEndDate,
      datesApproximate: current.datesApproximate, plannedStartDate: current.plannedStartDate, plannedEndDate: current.plannedEndDate,
      cover: action === 'replace' ? { action, file } : action === 'metadata' ? { action, resultId: 'metadata-fiction' } : { action },
    }
    const parts = bookMultipart(input)
    const metadata = validators.named('BookMetadataInput')
    expect(metadata(parts.metadata), JSON.stringify(metadata.errors)).toBe(true)
    const wire = 'cover' in parts ? { metadata: parts.metadata, cover: 'binary bytes' } : parts
    const validate = validators.named('BookMultipart')
    expect(validate(wire), JSON.stringify(validate.errors)).toBe(true)
    expect(validate({ metadata: parts.metadata, cover: action === 'replace' ? undefined : 'unexpected bytes' })).toBe(false)
    const form = multipartFormData(parts)
    expect(form.has('cover')).toBe(action === 'replace')
    if (action === 'replace') expect(parts.cover).toBe(file)
  })

  it('validates actual failure envelopes while preserving ApiError callers', async () => {
    const api = createMockClient({ session: 'anonymous' })
    let failure: unknown
    try { await api.getHome() } catch (error) { failure = error }
    expect(failure).toBeInstanceOf(ApiError)
    if (!(failure instanceof ApiError)) throw new Error('Expected ApiError')
    const envelope = errorEnvelope(failure)
    const validate = validators.named('Error')
    expect(validate(envelope), JSON.stringify(validate.errors)).toBe(true)
    expect(envelope.code).toBe('unauthenticated')
    expect(apiError(401, envelope)).toMatchObject({ status: failure.status, message: failure.message, code: envelope.code })
    expect(validate({ message: envelope.message })).toBe(false)
  })

  it('keeps illustrative mock export separate from production ZIP and OAuth navigation', async () => {
    const api = createMockClient()
    const download = await api.exportClubData()
    expect(download.filename).toMatch(/\.json$/)
    expect(() => JSON.parse(download.json)).not.toThrow()
    const exported = operation('exportClubData')
    expect(exported.responses?.['200']?.content?.['application/json']).toBeUndefined()
    expect(exported.responses?.['200']?.content?.['application/zip']).toBeDefined()
    const oauth = operation('startSignIn')
    expect(oauth.responses?.['302']?.content).toBeUndefined()
    await expect(createMockClient({ session: 'anonymous' }).startSignIn()).resolves.toBeUndefined()
  })
})
