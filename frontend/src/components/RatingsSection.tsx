import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, useApiData } from '../api/hooks'
import type { BookRatings, ClubRatings, ClubReview, CriterionScores } from '../api/types'
import {
  CRITERIA,
  CRITERION_LABELS,
  formatMean,
  formatReviewCount,
  formatScore,
  isRatingSavedState,
  NOT_RATABLE_MESSAGE,
  ratingFormPath,
} from '../lib/ratings'
import { Avatar } from './Avatar'
import { Card } from './Card'
import { LoadError, Loading } from './Status'

const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

const RULE =
  'Cuando hayas terminado el libro y enviado tu valoración, podrás ver las valoraciones del resto del club.'

// «Valoraciones» on the book page (#67). It loads on its own, so a failure
// here leaves the rest of the book visible. What it shows comes only from the
// server's answer: a locked result carries no count, mean, name or text, so
// there is nothing to hide here. The same for a member and the admin.
export function RatingsSection({ bookId }: { bookId: string }) {
  const ratings = useApiData((api) => api.getBookRatings(bookId))
  // Set by the rating form after saving: confirm it and move focus here.
  const savedJustNow = isRatingSavedState(useLocation().state)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focused = useRef(false)
  useLayoutEffect(() => {
    if (savedJustNow && ratings.status === 'ready' && !focused.current) {
      focused.current = true
      headingRef.current?.focus()
    }
  }, [savedJustNow, ratings.status])

  return (
    <Card title="Valoraciones" className="min-w-0 lg:col-span-2" headingRef={headingRef}>
      {ratings.status === 'loading' ? (
        <Loading />
      ) : ratings.status === 'error' ? (
        <LoadError message="No se han podido cargar las valoraciones." onRetry={ratings.reload} />
      ) : (
        <Ratings loaded={ratings.data} reload={ratings.reload} savedJustNow={savedJustNow} />
      )}
    </Card>
  )
}

function Ratings({ loaded, reload, savedJustNow }: { loaded: BookRatings; reload: () => void; savedJustNow: boolean }) {
  const api = useApi()
  // The ratings as last returned by the server: from the load, or from the
  // user's own «He terminado el libro» change.
  const [source, setSource] = useState(loaded)
  const [ratings, setRatings] = useState(loaded)
  if (loaded !== source) {
    setSource(loaded)
    setRatings(loaded)
  }
  // The value being saved, shown while the call is in flight.
  const [pending, setPending] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)
  const [changedMeanwhile, setChangedMeanwhile] = useState(false)

  const toggle = async (finished: boolean) => {
    setPending(finished)
    setFailed(false)
    setChangedMeanwhile(false)
    try {
      setRatings(await api.setBookFinished(ratings.book.id, finished))
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null
      if (status === 409) {
        setChangedMeanwhile(true)
        reload()
      } else if (status !== 401) {
        // A 401 already sends the visitor to the sign-in screen.
        setFailed(true)
      }
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="grid gap-3">
      {/* Kept above whatever the reloaded ratings show, so it is never lost. */}
      <p role="status" className={changedMeanwhile ? 'max-w-prose' : 'sr-only'}>
        {changedMeanwhile &&
          'No se ha podido cambiar porque el libro ha cambiado mientras tanto. Aquí tienes cómo está ahora.'}
      </p>
      {!ratings.ratable ? (
        <p className="max-w-prose">{NOT_RATABLE_MESSAGE}</p>
      ) : ratings.club.status === 'visible' && ratings.myReview ? (
        <VisibleRatings
          ratings={ratings}
          club={ratings.club}
          myReview={ratings.myReview}
          savedJustNow={savedJustNow}
        />
      ) : (
        <LockedRatings ratings={ratings} pending={pending} failed={failed} onToggle={(finished) => void toggle(finished)} />
      )}
    </div>
  )
}

// Locked: only the user's own flag and the rule. Nothing says whether anyone
// else has finished or rated the book.
function LockedRatings({
  ratings,
  pending,
  failed,
  onToggle,
}: {
  ratings: BookRatings
  pending: boolean | null
  failed: boolean
  onToggle: (finished: boolean) => void
}) {
  return (
    <div className="grid gap-3">
      <div>
        <label className="inline-flex min-h-6 items-center gap-2 font-semibold text-forest">
          <input
            type="checkbox"
            className="size-5 accent-forest disabled:opacity-60"
            checked={pending ?? ratings.finishedByMe}
            disabled={pending !== null}
            onChange={(event) => onToggle(event.target.checked)}
          />
          He terminado el libro
        </label>
        {failed && (
          <p role="alert" className="mt-1 text-bark">
            No se ha podido guardar. Inténtalo de nuevo.
          </p>
        )}
      </div>
      {ratings.finishedByMe && (
        <p>
          <Link to={ratingFormPath(ratings.book.id)} className={linkClass}>
            Valorar el libro
          </Link>
        </p>
      )}
      <p className="max-w-prose text-bark">{RULE}</p>
    </div>
  )
}

type VisibleClub = Extract<ClubRatings, { status: 'visible' }>

function VisibleRatings({
  ratings,
  club,
  myReview,
  savedJustNow,
}: {
  ratings: BookRatings
  club: VisibleClub
  myReview: NonNullable<BookRatings['myReview']>
  savedJustNow: boolean
}) {
  const mineId = useId()
  const clubId = useId()
  const othersId = useId()
  const others = club.reviews.filter((review) => !review.isMine)
  const count = formatReviewCount(club.reviewCount)

  return (
    <div className="grid gap-6">
      {savedJustNow && (
        <p role="status" className="font-semibold text-moss">
          Tu valoración se ha guardado.
        </p>
      )}
      <p className="text-moss">Has terminado este libro.</p>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby={mineId} className="grid content-start gap-2">
          <h3 id={mineId} className="text-lg text-forest">
            Tu valoración
          </h3>
          <p className="text-lg font-semibold text-forest">Tu media: {formatMean(myReview.overall)} / 5</p>
          <ScoreList scores={myReview.scores} />
          {myReview.text && <ReviewText text={myReview.text} />}
          <p>
            <Link to={ratingFormPath(ratings.book.id)} className={linkClass}>
              Editar mi valoración
            </Link>
          </p>
        </section>

        <section aria-labelledby={clubId} className="grid min-w-0 content-start gap-3">
          <h3 id={clubId} className="text-lg text-forest">
            Media del club
          </h3>
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-lg font-semibold text-forest">Media del club: {formatMean(club.overallMean)} / 5</span>
            <span className="text-bark">{count}</span>
          </p>
          <table className="w-full max-w-sm text-left">
            <caption className="mb-1 text-left text-sm text-bark">Media del club por criterio ({count})</caption>
            <thead>
              <tr className="border-b border-wood/40">
                <th scope="col" className="py-1 pr-4 font-semibold">
                  Criterio
                </th>
                <th scope="col" className="py-1 font-semibold">
                  Media del club
                </th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((criterion) => (
                <tr key={criterion} className="border-b border-wood/20 last:border-b-0">
                  <th scope="row" className="py-1 pr-4 font-normal">
                    {CRITERION_LABELS[criterion]}
                  </th>
                  <td className="py-1">{formatMean(club.criterionMeans[criterion])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section aria-labelledby={othersId} className="grid gap-3">
        <h3 id={othersId} className="text-lg text-forest">
          Valoraciones de los miembros
        </h3>
        {others.length === 0 ? (
          <p className="text-bark italic">Por ahora solo está tu valoración.</p>
        ) : (
          // Own first, then by name, as the server sends them; never by score.
          <ul className="grid gap-4 lg:grid-cols-2">
            {others.map((review) => (
              <MemberReview key={review.member.id} review={review} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function MemberReview({ review }: { review: ClubReview }) {
  return (
    <li className="grid min-w-0 content-start gap-2 rounded-lg border border-wood/30 p-4">
      <p className="flex items-center gap-3">
        <Avatar member={review.member} />
        <span className="font-semibold break-words text-forest">{review.member.displayName}</span>
      </p>
      <p className="font-semibold text-forest">Media: {formatMean(review.overall)} / 5</p>
      <ScoreList scores={review.scores} />
      {review.text && <ReviewText text={review.text} />}
    </li>
  )
}

function ScoreList({ scores }: { scores: CriterionScores }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {CRITERIA.map((criterion) => (
        <li key={criterion}>
          {CRITERION_LABELS[criterion]}: <span className="font-semibold">{formatScore(scores[criterion])}</span>
        </li>
      ))}
    </ul>
  )
}

// Plain text: React escapes it, so markup shows literally; line breaks are kept.
function ReviewText({ text }: { text: string }) {
  return <p className="max-w-prose break-words whitespace-pre-line">{text}</p>
}
