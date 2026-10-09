import { useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import { useApi } from '../api/hooks'
import type { MemberSummary, Vote, VoteCandidate, VoteOutcome } from '../api/types'
import { formatAuthors, formatLongDate, formatTitles, formatVoteCount } from '../lib/format'
import { bookPath, VOTE_NO_LONGER_OPEN, VOTE_STATUS_LABELS } from '../lib/votes'
import { Avatar } from './Avatar'
import { BookCover } from './BookCover'

const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

type HeadingLevel = 2 | 3

// Shown by both pages after a change is refused because the vote is no
// longer open (409). A calm note, not an alert: the vote simply closed in
// the meantime. The live region is always present so screen readers
// announce the message.
export function ConflictNotice({ shown }: { shown: boolean }) {
  return (
    <div role="status">
      {shown && <p className="max-w-prose rounded-lg border border-wood/40 bg-paper px-4 py-3">{VOTE_NO_LONGER_OPEN}</p>}
    </div>
  )
}

function Heading({ level, id, children }: { level: HeadingLevel; id: string; children: ReactNode }) {
  const className = 'text-xl text-forest'
  return level === 2 ? (
    <h2 id={id} className={className}>
      {children}
    </h2>
  ) : (
    <h3 id={id} className={className}>
      {children}
    </h3>
  )
}

// One vote in full: its status and dates, the outcome once closed, and the
// candidates in shortlist order. The same for every member, the curator and
// the admin: the management controls belong to #91. The server enforces
// every rule; while the vote is open, the user can change only their own
// approvals.
export function VoteView({
  vote: loaded,
  headingLevel,
  onConflict,
}: {
  vote: Vote
  // Level of the section headings: 2 on the vote page, 3 inside Votaciones.
  headingLevel: HeadingLevel
  // Called when a change is refused because the vote is no longer open.
  onConflict: () => void
}) {
  const api = useApi()
  // The vote as last returned by the server, from the page's load or from
  // the user's own changes.
  const [source, setSource] = useState(loaded)
  const [vote, setVote] = useState(loaded)
  if (loaded !== source) {
    setSource(loaded)
    setVote(loaded)
  }
  // bookId -> the approval being saved, shown while the call is in flight.
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  const [announcement, setAnnouncement] = useState('')
  // Responses may arrive out of order; only a newer one replaces the vote.
  const issued = useRef(0)
  const applied = useRef(0)
  const resultsId = useId()
  const candidatesId = useId()

  const change = async (candidate: VoteCandidate, approved: boolean) => {
    const { id: bookId, title } = candidate.book
    const request = ++issued.current
    setPending((current) => ({ ...current, [bookId]: approved }))
    setFailed((current) => ({ ...current, [bookId]: false }))
    setAnnouncement('')
    try {
      const updated = await api.setApproval(vote.id, bookId, approved)
      if (request > applied.current) {
        applied.current = request
        setVote(updated)
      }
      const count = updated.candidates.find((c) => c.book.id === bookId)?.approvals.length ?? 0
      setAnnouncement(
        approved
          ? `Has votado «${title}». Ahora tiene ${formatVoteCount(count)}.`
          : `Has retirado tu voto de «${title}».`,
      )
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) onConflict()
      // A 401 already sends the visitor to the sign-in screen.
      else if (!(error instanceof ApiError && error.status === 401)) {
        setFailed((current) => ({ ...current, [bookId]: true }))
      }
    } finally {
      setPending((current) => {
        const rest = { ...current }
        delete rest[bookId]
        return rest
      })
    }
  }

  const outcome = vote.status === 'closed' ? vote.outcome : null

  return (
    <div className="grid min-w-0 gap-6">
      <VoteFacts vote={vote} />

      {outcome && (
        <section aria-labelledby={resultsId} className="grid gap-3">
          <Heading level={headingLevel} id={resultsId}>
            Resultado
          </Heading>
          <Outcome outcome={outcome} vote={vote} />
        </section>
      )}

      <section aria-labelledby={candidatesId} className="grid gap-3">
        <Heading level={headingLevel} id={candidatesId}>
          Libros candidatos
        </Heading>
        {vote.status === 'draft' && (
          <p className="max-w-prose">
            La votación todavía no está abierta. Esta es la lista de libros propuestos; cuando se abra, podrás votar
            aquí.
          </p>
        )}
        {vote.status === 'open' && (
          <p className="max-w-prose">
            Puedes votar por todos los libros que te apetezca leer, y cada voto cuenta lo mismo. Puedes cambiar tus votos
            mientras la votación siga abierta.
          </p>
        )}
        {vote.status === 'open' ? (
          <fieldset className="grid min-w-0 gap-3">
            <legend className="mb-1 font-semibold text-forest">Elige los libros que te gustaría leer</legend>
            <p role="status" className="text-moss">
              {announcement}
            </p>
            <CandidateList
              vote={vote}
              renderVoting={(candidate, countId) => {
                const saving = candidate.book.id in pending
                return (
                  <div>
                    <label className="inline-flex items-center gap-2 font-semibold text-forest">
                      <input
                        type="checkbox"
                        className="size-5 accent-forest disabled:opacity-60"
                        checked={saving ? pending[candidate.book.id] : candidate.approvedByMe}
                        disabled={saving}
                        aria-describedby={countId}
                        onChange={(event) => void change(candidate, event.target.checked)}
                      />
                      <span>
                        Votar <span className="sr-only">por «{candidate.book.title}»</span>
                      </span>
                    </label>
                    {failed[candidate.book.id] && (
                      <p role="alert" className="mt-1 text-bark">
                        No se ha podido guardar tu voto. Inténtalo de nuevo.
                      </p>
                    )}
                  </div>
                )
              }}
            />
          </fieldset>
        ) : (
          <CandidateList vote={vote} />
        )}
      </section>
    </div>
  )
}

function VoteFacts({ vote }: { vote: Vote }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
      <dt className="text-bark">Estado</dt>
      <dd className="font-semibold text-forest">{VOTE_STATUS_LABELS[vote.status]}</dd>
      {vote.openedAt && (
        <>
          <dt className="text-bark">Abierta el</dt>
          <dd>
            <time dateTime={vote.openedAt}>{formatLongDate(vote.openedAt)}</time>
          </dd>
        </>
      )}
      {vote.closedAt && (
        <>
          <dt className="text-bark">Cerrada el</dt>
          <dd>
            <time dateTime={vote.closedAt}>{formatLongDate(vote.closedAt)}</time>
          </dd>
        </>
      )}
    </dl>
  )
}

function Outcome({ outcome, vote }: { outcome: VoteOutcome; vote: Vote }) {
  if (outcome.status === 'tiePending') {
    const titles = outcome.tiedBookIds.flatMap((id) => vote.candidates.find((c) => c.book.id === id)?.book.title ?? [])
    return (
      <p className="max-w-prose">
        Hay un empate entre {formatTitles(titles)}. El club decidirá cuál se lee.
      </p>
    )
  }
  return (
    <div className="grid gap-3">
      <p className="font-serif text-lg break-words text-forest">
        Libro elegido:{' '}
        <Link to={bookPath(outcome.winner.id)} className={linkClass}>
          «{outcome.winner.title}»
        </Link>
      </p>
      {outcome.tieNote && (
        <div className="max-w-prose rounded-lg border-l-4 border-soft-green bg-paper px-4 py-3">
          <p className="text-sm font-semibold text-bark">Nota del desempate</p>
          {/* Plain text: React escapes it, and line breaks are kept. */}
          <p className="whitespace-pre-line break-words">{outcome.tieNote}</p>
        </div>
      )}
    </div>
  )
}

// The candidates in shortlist order, never re-sorted by count.
function CandidateList({
  vote,
  renderVoting,
}: {
  vote: Vote
  renderVoting?: (candidate: VoteCandidate, countId: string) => ReactNode
}) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {vote.candidates.map((candidate) => (
        <Candidate key={candidate.book.id} vote={vote} candidate={candidate} renderVoting={renderVoting} />
      ))}
    </ul>
  )
}

function Candidate({
  vote,
  candidate,
  renderVoting,
}: {
  vote: Vote
  candidate: VoteCandidate
  renderVoting?: (candidate: VoteCandidate, countId: string) => ReactNode
}) {
  const countId = useId()
  const { book } = candidate
  const outcome = vote.outcome
  const isWinner = outcome?.status === 'winner' && outcome.winner.id === book.id
  const isTied = outcome?.status === 'tiePending' && outcome.tiedBookIds.includes(book.id)
  // Approvals start when the vote opens, so a draft shows no counts or voters.
  const showApprovals = vote.status !== 'draft'
  const metadata = [book.publicationDate, book.pageCount === null ? null : `${book.pageCount} páginas`].filter(
    (part): part is string => Boolean(part),
  )

  return (
    <li
      className={`flex min-w-0 gap-4 rounded-xl border bg-paper p-4 shadow-sm ${isWinner ? 'border-2 border-forest' : 'border-wood/30'}`}
    >
      <BookCover book={book} compact className="w-16 shrink-0 self-start sm:w-20" />
      <div className="grid min-w-0 flex-1 content-start gap-2">
        <div>
          {isWinner && <p className="text-sm font-semibold text-forest">Libro elegido</p>}
          {isTied && <p className="text-sm font-semibold text-forest">En empate</p>}
          <p className="font-serif text-lg leading-tight break-words">
            <Link to={bookPath(book.id)} className={linkClass}>
              {book.title}
            </Link>
          </p>
          <p className="break-words text-bark">{formatAuthors(book.authors)}</p>
          {metadata.length > 0 && <p className="text-sm text-bark">{metadata.join(' · ')}</p>}
        </div>
        {renderVoting?.(candidate, countId)}
        {showApprovals && (
          <>
            <p id={countId} className="font-semibold text-forest">
              {formatVoteCount(candidate.approvals.length, vote.status === 'open')}
            </p>
            {vote.status === 'closed' && candidate.approvedByMe && <p className="text-moss">Votaste por este libro</p>}
            {candidate.approvals.length > 0 && <Voters title={book.title} voters={candidate.approvals} />}
          </>
        )}
      </div>
    </li>
  )
}

function Voters({ title, voters }: { title: string; voters: MemberSummary[] }) {
  return (
    <ul aria-label={`Votos de «${title}»`} className="flex flex-wrap gap-x-3 gap-y-2">
      {voters.map((member) => (
        <li key={member.id} className="flex min-w-0 items-center gap-1.5">
          <Avatar member={member} size={24} />
          <span className="break-words">{member.displayName}</span>
        </li>
      ))}
    </ul>
  )
}
