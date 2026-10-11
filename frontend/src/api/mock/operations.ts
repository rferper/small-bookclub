import type { ApiClient } from '../client'
import type { AuditAction, AuditEvent } from '../types'
import type { MockState } from './fixtures'

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const safeEvents = (state: MockState): AuditEvent[] => (state.audit ?? []).map((e) => ({
  id: e.id, action: e.action, target: { type: e.target.type, id: e.target.id, label: e.target.label },
  actor: { id: e.actor.id, displayName: e.actor.displayName }, occurredAt: e.occurredAt,
})).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id.localeCompare(a.id))

export function addAudit(state: MockState, action: AuditAction, target: AuditEvent['target'], actor?: AuditEvent['actor']) {
  const member = state.members.find((m) => m.id === state.currentUserId)
  const events = state.audit ??= []
  let n = events.length + 1
  while (events.some((e) => e.id === `audit-${String(n).padStart(8, '0')}`)) n++
  events.push({ id: `audit-${String(n).padStart(8, '0')}`, action, target: { ...target },
    actor: actor ? { ...actor } : { id: member!.id, displayName: member!.displayName }, occurredAt: state.now })
}

// Monitor only safe scalar facts, never text-bearing payloads or requests.
interface Fact { key: string; value: string; target: AuditEvent['target']; action: AuditAction }
function facts(state: MockState): Fact[] {
  const result: Fact[] = []
  const put = (key: string, value: string, type: AuditEvent['target']['type'], id: string, label: string, action: AuditAction) => result.push({ key, value, target: { type, id, label }, action })
  for (const m of state.members) put(`member:${m.id}`, 'active', 'member', m.id, m.displayName, 'member_approved')
  for (const m of state.revokedMembers) put(`member:${m.id}`, 'revoked', 'member', m.id, m.displayName, 'member_revoked')
  const curator = state.members.find((m) => m.id === state.curatorId)
  put('curator', state.curatorId ?? '', 'member', state.curatorId ?? 'club', curator?.displayName ?? 'Curaduría', curator ? 'curator_assigned' : 'curator_cleared')
  const deletion = (type: AuditEvent['target']['type'], id: string, label: string, deletedAt?: string) => put(`deletion:${type}:${id}`, deletedAt ? 'deleted' : 'active', type, id, label, deletedAt ? 'soft_deleted' : 'restored')
  for (const b of state.books) {
    put(`status:${b.id}`, b.status, 'book', b.id, b.title, 'book_status_changed')
    deletion('book', b.id, b.title, b.deletedAt)
  }
  for (const w of state.weeks) deletion('week', w.id, state.books.find((b) => b.id === w.bookId)?.title ?? 'Semana de lectura', w.deletedAt)
  for (const q of state.quotes) deletion('quote', q.id, 'Cita literaria', q.deletedAt)
  for (const m of state.meetings) {
    deletion('meeting', m.id, m.startsAt, m.deletedAt)
    put(`summary:${m.id}`, String(!!m.summary?.published), 'meeting', m.id, m.startsAt, m.summary?.published ? 'summary_published' : 'summary_unpublished')
    for (const h of m.highlights) {
      deletion('highlight', h.id, 'Momento destacado', h.deletedAt)
      put(`highlight:${h.id}`, String(h.published), 'highlight', h.id, 'Momento destacado', h.published ? 'highlight_published' : 'highlight_unpublished')
    }
  }
  for (const v of state.votes) {
    put(`vote:${v.id}`, v.status, 'vote', v.id, 'Votación', 'vote_closed')
    put(`tie:${v.id}`, v.outcome && 'winnerBookId' in v.outcome ? v.outcome.winnerBookId : '', 'vote', v.id, 'Votación', 'tie_resolved')
  }
  for (const t of state.tombstones ?? []) put(`deletion:${t.type}:${t.id}`, 'purged', t.type, t.id, ({ book: 'Libro', meeting: 'Reunión', week: 'Semana de lectura', quote: 'Cita literaria', highlight: 'Momento destacado' })[t.type], 'purged')
  return result
}

const watched: readonly (keyof ApiClient)[] = ['exportClubData', 'addMember', 'revokeMember', 'restoreMember', 'setCurator', 'updateBook', 'saveMeetingSummary', 'createMeetingHighlight', 'updateMeetingHighlight', 'deleteBook', 'deleteMeeting', 'deleteLiteraryQuote', 'removeReadingWeek', 'removeMeetingHighlight', 'restoreDeleted', 'purgeDeleted', 'closeVote', 'recordTieWinner']
export function auditedClient(client: ApiClient, state: MockState, exportAccess: () => void): ApiClient {
  // Serialize critical mock writes so overlapping promises cannot attribute or
  // duplicate another transaction's events. A refusal never blocks later calls.
  let queue: Promise<unknown> = Promise.resolve()
  return new Proxy(client, { get(target, property, receiver) {
    const method = property as keyof ApiClient
    const original = Reflect.get(target, property, receiver)
    if (!watched.includes(method)) return original
    return (...args: unknown[]) => {
      const run = async () => {
        if (method === 'exportClubData') exportAccess()
        const before = new Map(facts(state).map((f) => [f.key, f]))
        const member = state.members.find((m) => m.id === state.currentUserId)
        const actor = member ? { id: member.id, displayName: member.displayName } : undefined
        const value = await original(...args)
        for (const fact of facts(state)) {
          const old = before.get(fact.key)
          if (old?.value === fact.value) continue
          if (fact.key.startsWith('status:') && !old) continue
          if (fact.key.startsWith('deletion:') && !old && fact.value === 'active') continue
          if ((fact.key.startsWith('summary:') || fact.key.startsWith('highlight:')) && !old && fact.value === 'false') continue
          if (fact.key.startsWith('vote:') && fact.value !== 'closed') continue
          if (fact.key.startsWith('tie:') && method !== 'recordTieWinner') continue
          const action = fact.key.startsWith('member:') && old?.value === 'revoked' && fact.value === 'active' ? 'member_restored' : fact.action
          addAudit(state, action, old && (fact.value === 'purged' || (fact.key === 'curator' && !fact.value)) ? old.target : fact.target, actor)
        }
        return value
      }
      const result = queue.then(run, run)
      queue = result.catch(() => undefined)
      return result
    }
  } })
}

// A whitelist at every record boundary; additions to state never silently enter exports.
function pick<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as Pick<T, K>
}
const deletionKeys = ['deletedAt', 'deletedBy', 'purgeDueAt'] as const
export function exportProjection(state: MockState) {
  return copy({ schemaVersion: 1, simulated: true, createdAt: state.now,
    format: 'mock-json-placeholder',
    members: [...state.members, ...state.revokedMembers].map((m) => ({ ...pick(m, ['id', 'displayName', 'avatarUrl', 'role']), status: state.members.includes(m) ? 'active' : 'revoked' })),
    allowlist: Object.entries(state.accounts).map(([memberId, a]) => ({ memberId, ...pick(a, ['discordId', 'addedAt', 'revokedAt']) })),
    profiles: Object.entries(state.profiles).map(([memberId, p]) => ({ memberId, ...pick(p, ['bio', 'favouriteQuote', 'favouriteBookIds']) })),
    curatorId: state.curatorId,
    books: state.books.map((b) => ({ ...pick(b, ['id', 'title', 'authors', 'coverUrl', 'status', 'readingStartDate', 'readingEndDate', 'datesApproximate', 'plannedStartDate', 'plannedEndDate', 'description', 'publicationDate', 'publisher', 'isbn', 'pageCount', ...deletionKeys]), originVote: b.originVote ? pick(b.originVote, ['id', 'label']) : null })),
    weeks: state.weeks.map((w) => pick(w, ['id', 'bookId', 'weekNumber', 'percentStart', 'percentEnd', 'pageStart', 'pageEnd', 'meetingId', 'dueDate', 'notes', ...deletionKeys])),
    meetings: state.meetings.map((m) => ({ ...pick(m, ['id', 'bookId', 'startsAt', 'cancelled', 'attendance', 'markedSafe', ...deletionKeys]), summary: m.summary ? pick(m.summary, ['text', 'published']) : null,
      highlights: m.highlights.map((h) => pick(h, ['id', 'text', 'kind', 'speakerIds', 'published', 'removedPosition', ...deletionKeys])) })),
    completions: Object.entries(state.completions).map(([weekId, memberIds]) => ({ weekId, memberIds })),
    finished: Object.entries(state.finished).map(([bookId, memberIds]) => ({ bookId, memberIds })),
    reviews: state.reviews.map((r) => ({ ...pick(r, ['bookId', 'userId', 'text', 'submittedAt', 'editedAt']), scores: pick(r.scores, ['disfrute', 'estilo', 'personajes', 'trama', 'huella']) })),
    votes: state.votes.map((v) => ({ ...pick(v, ['id', 'status', 'curatorId', 'openedAt', 'closedAt']), candidates: v.candidates.map((c) => pick(c, ['bookId', 'approverIds'])),
      outcome: v.outcome ? ('winnerBookId' in v.outcome ? pick(v.outcome, ['winnerBookId', 'tieNote']) : pick(v.outcome, ['tiedBookIds'])) : null })),
    rubric: Object.fromEntries((['disfrute', 'estilo', 'personajes', 'trama', 'huella'] as const).map((c) => [c, pick(state.rubric[c], [1, 2, 3, 4, 5])])),
    quotes: state.quotes.map((q) => pick(q, ['id', 'text', 'author', 'source', 'active', ...deletionKeys])),
    tombstones: (state.tombstones ?? []).map((t) => pick(t, ['type', 'id', 'purgedAt', 'purgedBy'])),
    audit: safeEvents(state),
  })
}
