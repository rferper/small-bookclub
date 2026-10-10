import { Link } from 'react-router'
import { useApiData } from '../api/hooks'
import type { MyReviewEntry } from '../api/types'
import { BookCover } from '../components/BookCover'
import { Card, EmptyState } from '../components/Card'
import { ProfileForm } from '../components/ProfileForm'
import { LoadError, Loading } from '../components/Status'
import { formatLongDate } from '../lib/format'
import { CRITERIA, CRITERION_LABELS, formatMean, formatScore, ratingFormPath } from '../lib/ratings'
import { bookPath } from '../lib/votes'
import { useSession } from '../session/hooks'

const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

// Mi perfil (#94): the signed-in user's own profile form and their own
// reviews. Each section loads with its own call, so one failing leaves the
// other in place. Every call acts for the session's user; none takes an id.
export function MyProfilePage() {
  const { session } = useSession()
  const myId = session?.status === 'signedIn' ? session.user.id : ''
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl text-forest sm:text-4xl">Mi perfil</h1>
        <p className="mt-2 max-w-prose text-bark">Así te presentas al club. Puedes cambiarlo cuando quieras.</p>
        <p className="mt-2">
          <Link to={`/miembros/${encodeURIComponent(myId)}`} className={linkClass}>
            Ver mi perfil en Miembros
          </Link>
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <ProfileSection />
        <MyReviewsSection />
      </div>
    </div>
  )
}

function ProfileSection() {
  const profile = useApiData((api) => api.getMyProfile())
  return (
    <Card title="Tu perfil" className="min-w-0">
      {profile.status === 'loading' && <Loading />}
      {profile.status === 'error' && <LoadError onRetry={profile.reload} message="No se ha podido cargar tu perfil." />}
      {profile.status === 'ready' && <ProfileForm profile={profile.data} />}
    </Card>
  )
}

function MyReviewsSection() {
  const reviews = useApiData((api) => api.listMyReviews())
  return (
    <Card title="Mis valoraciones" className="min-w-0">
      {reviews.status === 'loading' && <Loading />}
      {reviews.status === 'error' && (
        <LoadError onRetry={reviews.reload} message="No se han podido cargar tus valoraciones." />
      )}
      {reviews.status === 'ready' &&
        (reviews.data.length === 0 ? (
          <EmptyState>Aquí aparecerán tus valoraciones de los libros del club.</EmptyState>
        ) : (
          <ul className="grid gap-4">
            {reviews.data.map((review) => (
              <MyReviewItem key={review.book.id} review={review} />
            ))}
          </ul>
        ))}
    </Card>
  )
}

// Only the user's own rating: no club mean, count, other name or text.
function MyReviewItem({ review }: { review: MyReviewEntry }) {
  const { book } = review
  return (
    <li className="grid min-w-0 gap-2 rounded-lg border border-wood/30 bg-parchment/60 p-4">
      <h3 className="min-w-0">
        <Link to={bookPath(book.id)} className="flex min-w-0 items-center gap-4 rounded-lg hover:bg-sage/30">
          <BookCover book={book} compact className="w-12 shrink-0" />
          <span className="min-w-0 font-serif text-lg break-words text-moss underline underline-offset-4">{book.title}</span>
        </Link>
      </h3>
      <p className="font-semibold text-forest">Tu media: {formatMean(review.overall)} / 5</p>
      <p className="break-words text-forest">
        {CRITERIA.map((criterion) => `${CRITERION_LABELS[criterion]} ${formatScore(review.scores[criterion])}`).join(' · ')}
      </p>
      {review.text && <p className="max-w-prose break-words whitespace-pre-line">{review.text}</p>}
      <p className="text-sm text-bark">
        Enviada el <time dateTime={review.submittedAt}>{formatLongDate(review.submittedAt)}</time>
        {review.editedAt && (
          <>
            {' · editada el '}
            <time dateTime={review.editedAt}>{formatLongDate(review.editedAt)}</time>
          </>
        )}
      </p>
      <p>
        <Link to={ratingFormPath(book.id)} className={linkClass}>
          Editar mi valoración{' '}<span className="sr-only">de «{book.title}»</span>
        </Link>
      </p>
    </li>
  )
}
