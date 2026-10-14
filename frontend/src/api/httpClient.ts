import type { ApiClient } from './client'
import { createTransport, operationUrl } from './transport'
import { bookMultipart, multipartFormData, profileMultipart } from './adapters'

// Explicit inventory: a new feature requires an intentional HTTP behavior decision.
export function createHttpClient(options: {
  fetch?: typeof fetch
  cookie?: () => string
  navigate?: (url: string) => void
} = {}): ApiClient {
  const request = createTransport(options)
  const navigate = options.navigate ?? ((url: string) => window.location.assign(url))
  return {
    getBackupInfo: () => request<'getBackupInfo'>({ method: 'GET', path: '/api/admin/backups', successStatus: 200 }),
    exportClubData: () => request.exportZip(),
    getAuditLog: () => request<'getAuditLog'>({ method: 'GET', path: '/api/admin/audit-log', successStatus: 200 }),
    getRecycleBin: () => request<'getRecycleBin'>({ method: 'GET', path: '/api/admin/bin', successStatus: 200 }),
    getDeletionPreview: (type, id) => request<'getDeletionPreview'>({ method: 'GET', path: '/api/admin/deletion-preview/{type}/{id}', pathParams: { type, id }, successStatus: 200 }),
    deleteBook: (bookId) => request<'deleteBook'>({ method: 'DELETE', path: '/api/admin/books/{bookId}', pathParams: { bookId }, successStatus: 200 }),
    deleteMeeting: (id) => request<'deleteMeeting'>({ method: 'DELETE', path: '/api/admin/meetings/{meetingId}', pathParams: { meetingId: id }, successStatus: 200 }),
    deleteLiteraryQuote: (id) => request<'deleteLiteraryQuote'>({ method: 'DELETE', path: '/api/admin/quotes/{id}', pathParams: { id }, successStatus: 200 }),
    restoreDeleted: (type, id) => request<'restoreDeleted'>({ method: 'POST', path: '/api/admin/bin/{type}/{id}/restore', pathParams: { type, id }, successStatus: 200 }),
    purgeDeleted: (type, id) => request<'purgeDeleted'>({ method: 'DELETE', path: '/api/admin/bin/{type}/{id}', pathParams: { type, id }, successStatus: 200 }),
    listAdminQuotes: () => request<'listAdminQuotes'>({ method: 'GET', path: '/api/admin/quotes', successStatus: 200 }),
    addLiteraryQuote: (input) => request<'addLiteraryQuote'>({ method: 'POST', path: '/api/admin/quotes', body: input, successStatus: 201 }),
    updateLiteraryQuote: (id, input) => request<'updateLiteraryQuote'>({ method: 'PUT', path: '/api/admin/quotes/{id}', pathParams: { id }, body: input, successStatus: 200 }),
    saveRatingRubric: (input) => request<'saveRatingRubric'>({ method: 'PUT', path: '/api/admin/rating-rubric', body: input, successStatus: 200 }),
    getAdminMeetingRecord: (meetingId) => request<'getAdminMeetingRecord'>({ method: 'GET', path: '/api/admin/meetings/{meetingId}/record', pathParams: { meetingId }, successStatus: 200 }),
    saveMeetingSummary: (meetingId, input) => request<'saveMeetingSummary'>({ method: 'PUT', path: '/api/admin/meetings/{meetingId}/record/summary', pathParams: { meetingId }, body: input, successStatus: 200 }),
    createMeetingHighlight: (meetingId, input) => request<'createMeetingHighlight'>({ method: 'POST', path: '/api/admin/meetings/{meetingId}/record/highlights', pathParams: { meetingId }, body: input, successStatus: 201 }),
    updateMeetingHighlight: (meetingId, highlightId, input) => request<'updateMeetingHighlight'>({ method: 'PUT', path: '/api/admin/meetings/{meetingId}/record/highlights/{highlightId}', pathParams: { meetingId, highlightId }, body: input, successStatus: 200 }),
    reorderMeetingHighlights: (meetingId, ids) => request<'reorderMeetingHighlights'>({ method: 'PUT', path: '/api/admin/meetings/{meetingId}/record/highlights/order', pathParams: { meetingId }, body: { ids }, successStatus: 200 }),
    removeMeetingHighlight: (meetingId, highlightId) => request<'removeMeetingHighlight'>({ method: 'DELETE', path: '/api/admin/meetings/{meetingId}/record/highlights/{highlightId}', pathParams: { meetingId, highlightId }, successStatus: 200 }),
    setMeetingRecordSafe: (meetingId, safe) => request<'setMeetingRecordSafe'>({ method: 'PUT', path: '/api/admin/meetings/{meetingId}/record/safe', pathParams: { meetingId }, body: { safe }, successStatus: 200 }),
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
    setMeetingAttendance: (meetingId, memberIds) => request<'setMeetingAttendance'>({ method: 'PUT', path: '/api/admin/meetings/{meetingId}/attendance', pathParams: { meetingId }, body: { memberIds }, successStatus: 200 }),
    listAdminBooks: () => request<'listAdminBooks'>({ method: 'GET', path: '/api/admin/books', successStatus: 200 }),
    getAdminBook: (bookId) => request<'getAdminBook'>({ method: 'GET', path: '/api/admin/books/{bookId}', pathParams: { bookId }, successStatus: 200 }),
    createBook: (input) => request<'createBook'>({ method: 'POST', path: '/api/admin/books', body: multipartFormData(bookMultipart(input)), successStatus: 201 }),
    updateBook: (bookId, input) => request<'updateBook'>({ method: 'PUT', path: '/api/admin/books/{bookId}', pathParams: { bookId }, body: multipartFormData(bookMultipart(input)), successStatus: 200 }),
    searchBookMetadata: (query) => request<'searchBookMetadata'>({ method: 'GET', path: '/api/admin/book-metadata', query: { query }, successStatus: 200 }),
    getSession: () => request<'getSession'>({ method: 'GET', path: '/api/session', successStatus: 200 }),
    startSignIn: async (purpose) => {
      // OAuth redirects belong to the top-level browser, never the JSON transport.
      navigate(operationUrl('/api/auth/discord/start', undefined, purpose ? { purpose } : undefined))
    },
    startDemoSignIn: () => request<'startDemoSignIn'>({ method: 'POST', path: '/api/auth/demo', successStatus: 204 }),
    signOut: () => request<'signOut'>({ method: 'POST', path: '/api/auth/logout', successStatus: 204 }),
    getHome: () => request<'getHome'>({ method: 'GET', path: '/api/home', successStatus: 200 }),
    setWeekCompleted: (weekId, completed) => request<'setWeekCompleted'>({ method: 'PUT', path: '/api/weeks/{weekId}/completion', pathParams: { weekId }, body: { completed }, successStatus: 204 }),
    listBooks: () => request<'listBooks'>({ method: 'GET', path: '/api/books', successStatus: 200 }),
    getBook: (bookId) => request<'getBook'>({ method: 'GET', path: '/api/books/{bookId}', pathParams: { bookId }, successStatus: 200 }),
    listMeetings: () => request<'listMeetings'>({ method: 'GET', path: '/api/meetings', successStatus: 200 }),
    getMeeting: (meetingId) => request<'getMeeting'>({ method: 'GET', path: '/api/meetings/{meetingId}', pathParams: { meetingId }, successStatus: 200 }),
    getVotes: () => request<'getVotes'>({ method: 'GET', path: '/api/votes', successStatus: 200 }),
    getVote: (voteId) => request<'getVote'>({ method: 'GET', path: '/api/votes/{voteId}', pathParams: { voteId }, successStatus: 200 }),
    setApproval: (voteId, bookId, approved) => request<'setApproval'>({ method: 'PUT', path: '/api/votes/{voteId}/candidates/{bookId}/approval', pathParams: { voteId, bookId }, body: { approved }, successStatus: 200 }),
    createVote: () => request<'createVote'>({ method: 'POST', path: '/api/votes', successStatus: 201 }),
    addCandidate: (voteId, bookId) => request<'addCandidate'>({ method: 'POST', path: '/api/votes/{voteId}/candidates', pathParams: { voteId }, body: { bookId }, successStatus: 200 }),
    removeCandidate: (voteId, bookId) => request<'removeCandidate'>({ method: 'DELETE', path: '/api/votes/{voteId}/candidates/{bookId}', pathParams: { voteId, bookId }, successStatus: 200 }),
    reorderCandidates: (voteId, bookIds) => request<'reorderCandidates'>({ method: 'PUT', path: '/api/votes/{voteId}/candidates/order', pathParams: { voteId }, body: { bookIds }, successStatus: 200 }),
    openVote: (voteId) => request<'openVote'>({ method: 'POST', path: '/api/votes/{voteId}/open', pathParams: { voteId }, successStatus: 200 }),
    closeVote: (voteId) => request<'closeVote'>({ method: 'POST', path: '/api/votes/{voteId}/close', pathParams: { voteId }, successStatus: 200 }),
    recordTieWinner: (voteId, bookId, note) => request<'recordTieWinner'>({ method: 'POST', path: '/api/votes/{voteId}/tie-winner', pathParams: { voteId }, body: { bookId, note }, successStatus: 200 }),
    getBookRatings: (bookId) => request<'getBookRatings'>({ method: 'GET', path: '/api/books/{bookId}/ratings', pathParams: { bookId }, successStatus: 200 }),
    getRatingRubric: () => request<'getRatingRubric'>({ method: 'GET', path: '/api/rating-rubric', successStatus: 200 }),
    setBookFinished: (bookId, finished) => request<'setBookFinished'>({ method: 'PUT', path: '/api/books/{bookId}/finished', pathParams: { bookId }, body: { finished }, successStatus: 200 }),
    saveMyReview: (bookId, input) => request<'saveMyReview'>({ method: 'PUT', path: '/api/books/{bookId}/my-review', pathParams: { bookId }, body: input, successStatus: 200 }),
    getStatistics: () => request<'getStatistics'>({ method: 'GET', path: '/api/statistics', successStatus: 200 }),
    getTasteCompatibility: () => request<'getTasteCompatibility'>({ method: 'GET', path: '/api/statistics/compatibility', successStatus: 200 }),
    listMembers: () => request<'listMembers'>({ method: 'GET', path: '/api/members', successStatus: 200 }),
    getMemberProfile: (memberId) => request<'getMemberProfile'>({ method: 'GET', path: '/api/members/{memberId}', pathParams: { memberId }, successStatus: 200 }),
    getMyProfile: () => request<'getMyProfile'>({ method: 'GET', path: '/api/me/profile', successStatus: 200 }),
    updateMyProfile: (input) => request<'updateMyProfile'>({ method: 'PUT', path: '/api/me/profile', body: multipartFormData(profileMultipart(input)), successStatus: 200 }),
    listMyReviews: () => request<'listMyReviews'>({ method: 'GET', path: '/api/me/reviews', successStatus: 200 }),
    getAdminMembers: () => request<'getAdminMembers'>({ method: 'GET', path: '/api/admin/members', successStatus: 200 }),
    addMember: (body) => request<'addMember'>({ method: 'POST', path: '/api/admin/members', body, successStatus: 201 }),
    revokeMember: (memberId) => request<'revokeMember'>({ method: 'POST', path: '/api/admin/members/{memberId}/revoke', pathParams: { memberId }, successStatus: 200 }),
    restoreMember: (memberId) => request<'restoreMember'>({ method: 'POST', path: '/api/admin/members/{memberId}/restore', pathParams: { memberId }, successStatus: 200 }),
    setCurator: (memberId) => request<'setCurator'>({ method: 'PUT', path: '/api/admin/curator', body: { memberId }, successStatus: 200 }),
  }
}
