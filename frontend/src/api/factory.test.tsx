import { describe, expect, it, vi } from 'vitest'
import { createApiClient, CONFIGURATION_ERROR } from './factory'
import { createHttpClient } from './httpClient'
import { createMockClient } from './mock/mockClient'
import { withUnauthorizedHandler } from './unauthorized'
import { ApiError, SESSION_METHODS, type ApiClient } from './client'
import { proxyTarget } from '../../proxy'

describe('explicit client selection and unavailable HTTP inventory', () => {
  it('omission and mock preserve fictional session/query controls', async () => {
    for (const mode of [undefined, 'mock']) {
      expect(await createApiClient(mode, '?mock-session=anonymous&mock-demo=1').getSession()).toMatchObject({ status: 'anonymous', demoSignInAvailable: true })
      expect(await createApiClient(mode, '?mock-session=member').getSession()).toMatchObject({ status: 'signedIn', user: { role: 'member' } })
    }
  })

  it.each(['', 'HTTP', ' mock', 'http ', 'invalid', 'https://private.test'])('invalid explicit mode %j fails closed with fixed Spanish text', mode => {
    expect(() => createApiClient(mode, '?mock-session=admin')).toThrow(CONFIGURATION_ERROR)
  })

  it('HTTP ignores every mock query control and rejects every unimplemented adapter', async () => {
    const client = createApiClient('http', '?mock-session=admin&mock-demo=1&mock-data=empty&mock-sign-in=admin&mock-vote=tie&mock-rubric=ejemplo')
    expect(Object.keys(client).sort()).toEqual(Object.keys(createMockClient()).sort())
    const before = window.location.href
    // Reflect invokes even parameterized methods: unsupported adapters must refuse before reading inputs.
    for (const name of Object.keys(client)) {
      if (['getSession', 'startSignIn', 'signOut', 'getAdminMembers', 'addMember', 'revokeMember', 'restoreMember', 'getMyProfile', 'updateMyProfile', 'listMembers', 'getMemberProfile', 'listAdminBooks', 'getAdminBook', 'createBook', 'updateBook', 'searchBookMetadata', 'listBooks', 'getBook', 'getDeletionPreview', 'deleteMeeting', 'listAdminMeetings', 'getAdminMeeting', 'createMeeting', 'updateMeeting', 'setMeetingCancelled', 'getAdminReadingPlan', 'createReadingWeek', 'updateReadingWeek', 'reorderReadingWeeks', 'removeReadingWeek', 'setWeekCompleted', 'getBookRatings', 'setBookFinished', 'getHome', 'listMeetings', 'getMeeting', 'setMeetingAttendance', 'getAdminMeetingRecord', 'saveMeetingSummary', 'createMeetingHighlight', 'updateMeetingHighlight', 'reorderMeetingHighlights', 'removeMeetingHighlight', 'setMeetingRecordSafe', 'setCurator', 'getVotes', 'getVote', 'createVote', 'addCandidate', 'removeCandidate', 'reorderCandidates', 'openVote', 'setApproval', 'closeVote', 'recordTieWinner', 'getRatingRubric', 'saveRatingRubric'].includes(name)) continue
      const method: unknown = Reflect.get(client, name)
      if (typeof method !== 'function') throw new Error('Expected explicit client method')
      await expect(Reflect.apply(method, client, [])).rejects.toMatchObject({ status: 503, code: 'service_unavailable', message: 'El servicio no está disponible. Inténtalo de nuevo.' })
    }
    expect(window.location.href).toBe(before)
  })

  it('only 401 club calls trigger the shared session handler; HTTP 503 never does', async () => {
    const expired = vi.fn()
    const http = createHttpClient({ fetch: async () => { throw new Error('Offline') } })
    const wrapped = withUnauthorizedHandler(http, expired)
    await expect(wrapped.getHome()).rejects.toMatchObject({ status: 503 })
    await expect(wrapped.getSession()).rejects.toMatchObject({ status: 503 })
    expect(expired).not.toHaveBeenCalled()
    for (const status of [401, 403, 500, 503]) {
      const failure = async (): Promise<never> => { throw new ApiError(status, 'Fallo seguro') }
      const client: ApiClient = { ...http, getHome: failure, getSession: failure, startSignIn: failure, startDemoSignIn: failure, signOut: failure }
      const handler = vi.fn()
      const guarded = withUnauthorizedHandler(client, handler)
      await expect(guarded.getHome()).rejects.toBeInstanceOf(ApiError)
      for (const name of SESSION_METHODS) await expect(Reflect.apply(Reflect.get(guarded, name), guarded, [])).rejects.toBeInstanceOf(ApiError)
      expect(handler).toHaveBeenCalledTimes(status === 401 ? 1 : 0)
    }
  })
})

describe('development-only proxy target', () => {
  it('leaves omitted configuration unset and supports explicit HTTP(S) origins', () => {
    expect(proxyTarget(undefined)).toBeUndefined()
    expect(proxyTarget('http://127.0.0.1:18050')).toBe('http://127.0.0.1:18050')
    expect(proxyTarget('https://localhost:18050/')).toBe('https://localhost:18050')
  })
  it.each(['', ' ', 'ftp://localhost', '//localhost', 'http://user:secret@localhost', 'http://localhost/api', 'http://localhost?token=secret', 'http://localhost/#fragment', 'http://*.test', ' http://localhost', 'http:\\localhost'])('refuses invalid explicit proxy %j', value => {
    expect(() => proxyTarget(value)).toThrow('API_DEV_PROXY_TARGET must be an HTTP(S) origin')
  })
})
