import type { ApiClient } from './client'
import { createTransport, operationUrl, safeError } from './transport'
import { bookMultipart, multipartFormData, profileMultipart } from './adapters'

// Explicit inventory: a new feature requires an intentional HTTP behavior decision.
export function createHttpClient(options: {
  fetch?: typeof fetch
  cookie?: () => string
  navigate?: (url: string) => void
} = {}): ApiClient {
  const request = createTransport(options)
  const navigate = options.navigate ?? ((url: string) => window.location.assign(url))
  const unavailable = async (): Promise<never> => { throw safeError(503) }
  return {
    getBackupInfo: unavailable,
    exportClubData: unavailable,
    getAuditLog: unavailable,
    getRecycleBin: unavailable,
    getDeletionPreview: (type, id) => request<'getDeletionPreview'>({ method: 'GET', path: '/api/admin/deletion-preview/{type}/{id}', pathParams: { type, id }, successStatus: 200 }),
    deleteBook: unavailable,
    deleteMeeting: (id) => request<'deleteMeeting'>({ method: 'DELETE', path: '/api/admin/meetings/{meetingId}', pathParams: { meetingId: id }, successStatus: 200 }),
    deleteLiteraryQuote: unavailable,
    restoreDeleted: unavailable,
    purgeDeleted: unavailable,
    listAdminQuotes: unavailable,
    addLiteraryQuote: unavailable,
    updateLiteraryQuote: unavailable,
    saveRatingRubric: unavailable,
    getAdminMeetingRecord: unavailable,
    saveMeetingSummary: unavailable,
    createMeetingHighlight: unavailable,
    updateMeetingHighlight: unavailable,
    reorderMeetingHighlights: unavailable,
    removeMeetingHighlight: unavailable,
    setMeetingRecordSafe: unavailable,
    getAdminReadingPlan: (bookId) => request<'getAdminReadingPlan'>({ method: 'GET', path: '/api/admin/books/{bookId}/reading-plan', pathParams: { bookId }, successStatus: 200 }),
    createReadingWeek: (bookId, input, acknowledged) => request<'createReadingWeek'>({ method: 'POST', path: '/api/admin/books/{bookId}/reading-plan/weeks', pathParams: { bookId }, body: { input, acknowledged }, successStatus: 201 }),
    updateReadingWeek: (bookId, weekId, input, acknowledged) => request<'updateReadingWeek'>({ method: 'PUT', path: '/api/admin/books/{bookId}/reading-plan/weeks/{weekId}', pathParams: { bookId, weekId }, body: { input, acknowledged }, successStatus: 200 }),
    reorderReadingWeeks: (bookId, ids, acknowledged) => request<'reorderReadingWeeks'>({ method: 'PUT', path: '/api/admin/books/{bookId}/reading-plan/weeks/order', pathParams: { bookId }, body: { ids, acknowledged }, successStatus: 200 }),
    removeReadingWeek: (bookId, weekId) => request<'removeReadingWeek'>({ method: 'DELETE', path: '/api/admin/books/{bookId}/reading-plan/weeks/{weekId}', pathParams: { bookId, weekId }, successStatus: 200 }),
    listAdminMeetings: () => request<'listAdminMeetings'>({ method: 'GET', path: '/api/admin/meetings', successStatus: 200 }),
    getAdminMeeting: (meetingId) => request<'getAdminMeeting'>({ method: 'GET', path: '/api/admin/meetings/{meetingId}', pathParams: { meetingId }, successStatus: 200 }),
    createMeeting: (body) => request<'createMeeting'>({ method: 'POST', path: '/api/admin/meetings', body, successStatus: 201 }),
    updateMeeting: (meetingId, body) => request<'updateMeeting'>({ method: 'PUT', path: '/api/admin/meetings/{meetingId}', pathParams: { meetingId }, body, successStatus: 200 }),
    setMeetingCancelled: (meetingId, cancelled) => request<'setMeetingCancelled'>({ method: 'PUT', path: '/api/admin/meetings/{meetingId}/cancelled', pathParams: { meetingId }, body: { cancelled }, successStatus: 200 }),
    setMeetingAttendance: unavailable,
    listAdminBooks: () => request<'listAdminBooks'>({ method: 'GET', path: '/api/admin/books', successStatus: 200 }),
    getAdminBook: (bookId) => request<'getAdminBook'>({ method: 'GET', path: '/api/admin/books/{bookId}', pathParams: { bookId }, successStatus: 200 }),
    createBook: (input) => request<'createBook'>({ method: 'POST', path: '/api/admin/books', body: multipartFormData(bookMultipart(input)), successStatus: 201 }),
    updateBook: (bookId, input) => request<'updateBook'>({ method: 'PUT', path: '/api/admin/books/{bookId}', pathParams: { bookId }, body: multipartFormData(bookMultipart(input)), successStatus: 200 }),
    searchBookMetadata: (query) => request<'searchBookMetadata'>({ method: 'GET', path: '/api/admin/book-metadata', query: { query }, successStatus: 200 }),
    getSession: () => request<'getSession'>({ method: 'GET', path: '/api/session', successStatus: 200 }),
    startSignIn: async () => {
      // OAuth redirects belong to the top-level browser, never the JSON transport.
      navigate(operationUrl('/api/auth/discord/start'))
    },
    startDemoSignIn: unavailable,
    signOut: () => request<'signOut'>({ method: 'POST', path: '/api/auth/logout', successStatus: 204 }),
    getHome: () => request<'getHome'>({ method: 'GET', path: '/api/home', successStatus: 200 }),
    setWeekCompleted: (weekId, completed) => request<'setWeekCompleted'>({ method: 'PUT', path: '/api/weeks/{weekId}/completion', pathParams: { weekId }, body: { completed }, successStatus: 204 }),
    listBooks: () => request<'listBooks'>({ method: 'GET', path: '/api/books', successStatus: 200 }),
    getBook: (bookId) => request<'getBook'>({ method: 'GET', path: '/api/books/{bookId}', pathParams: { bookId }, successStatus: 200 }),
    listMeetings: () => request<'listMeetings'>({ method: 'GET', path: '/api/meetings', successStatus: 200 }),
    getMeeting: unavailable,
    getVotes: unavailable,
    getVote: unavailable,
    setApproval: unavailable,
    createVote: unavailable,
    addCandidate: unavailable,
    removeCandidate: unavailable,
    reorderCandidates: unavailable,
    openVote: unavailable,
    closeVote: unavailable,
    recordTieWinner: unavailable,
    getBookRatings: (bookId) => request<'getBookRatings'>({ method: 'GET', path: '/api/books/{bookId}/ratings', pathParams: { bookId }, successStatus: 200 }),
    getRatingRubric: unavailable,
    setBookFinished: (bookId, finished) => request<'setBookFinished'>({ method: 'PUT', path: '/api/books/{bookId}/finished', pathParams: { bookId }, body: { finished }, successStatus: 200 }),
    saveMyReview: unavailable,
    getStatistics: unavailable,
    getTasteCompatibility: unavailable,
    listMembers: () => request<'listMembers'>({ method: 'GET', path: '/api/members', successStatus: 200 }),
    getMemberProfile: (memberId) => request<'getMemberProfile'>({ method: 'GET', path: '/api/members/{memberId}', pathParams: { memberId }, successStatus: 200 }),
    getMyProfile: () => request<'getMyProfile'>({ method: 'GET', path: '/api/me/profile', successStatus: 200 }),
    updateMyProfile: (input) => request<'updateMyProfile'>({ method: 'PUT', path: '/api/me/profile', body: multipartFormData(profileMultipart(input)), successStatus: 200 }),
    listMyReviews: unavailable,
    getAdminMembers: () => request<'getAdminMembers'>({ method: 'GET', path: '/api/admin/members', successStatus: 200 }),
    addMember: (body) => request<'addMember'>({ method: 'POST', path: '/api/admin/members', body, successStatus: 201 }),
    revokeMember: (memberId) => request<'revokeMember'>({ method: 'POST', path: '/api/admin/members/{memberId}/revoke', pathParams: { memberId }, successStatus: 200 }),
    restoreMember: (memberId) => request<'restoreMember'>({ method: 'POST', path: '/api/admin/members/{memberId}/restore', pathParams: { memberId }, successStatus: 200 }),
    setCurator: unavailable,
  }
}
