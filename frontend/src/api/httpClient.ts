import type { ApiClient } from './client'
import { createTransport, operationUrl, safeError } from './transport'
import { multipartFormData, profileMultipart } from './adapters'

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
    getDeletionPreview: unavailable,
    deleteBook: unavailable,
    deleteMeeting: unavailable,
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
    getAdminReadingPlan: unavailable,
    createReadingWeek: unavailable,
    updateReadingWeek: unavailable,
    reorderReadingWeeks: unavailable,
    removeReadingWeek: unavailable,
    listAdminMeetings: unavailable,
    getAdminMeeting: unavailable,
    createMeeting: unavailable,
    updateMeeting: unavailable,
    setMeetingCancelled: unavailable,
    setMeetingAttendance: unavailable,
    listAdminBooks: unavailable,
    getAdminBook: unavailable,
    createBook: unavailable,
    updateBook: unavailable,
    searchBookMetadata: unavailable,
    getSession: () => request<'getSession'>({ method: 'GET', path: '/api/session', successStatus: 200 }),
    startSignIn: async () => {
      // OAuth redirects belong to the top-level browser, never the JSON transport.
      navigate(operationUrl('/api/auth/discord/start'))
    },
    startDemoSignIn: unavailable,
    signOut: () => request<'signOut'>({ method: 'POST', path: '/api/auth/logout', successStatus: 204 }),
    getHome: unavailable,
    setWeekCompleted: unavailable,
    listBooks: unavailable,
    getBook: unavailable,
    listMeetings: unavailable,
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
    getBookRatings: unavailable,
    getRatingRubric: unavailable,
    setBookFinished: unavailable,
    saveMyReview: unavailable,
    getStatistics: unavailable,
    getTasteCompatibility: unavailable,
    listMembers: unavailable,
    getMemberProfile: unavailable,
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
