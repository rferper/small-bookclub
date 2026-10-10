import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useApiData } from '../api/hooks'
import type { BookSummary, MemberProfile, MemberWeekStatus } from '../api/types'
import { Avatar } from '../components/Avatar'
import { BookCover } from '../components/BookCover'
import { Card, EmptyState } from '../components/Card'
import { LoadError, Loading } from '../components/Status'
import { formatAuthors, formatWeekStatus } from '../lib/format'

const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

export function MemberProfilePage() {
  const { memberId = '' } = useParams()
  // A new id is a new page: start again from «Cargando…» instead of showing the previous member.
  return <MemberProfileContent key={memberId} memberId={memberId} />
}

function MemberProfileContent({ memberId }: { memberId: string }) {
  // Only this call. Profiles carry no rating, review or taste data at all,
  // so nothing gated can reach this page (#69).
  const profile = useApiData((api) => api.getMemberProfile(memberId))

  if (profile.status === 'loading') return <Loading />
  if (profile.status === 'error') {
    // An unknown id and a revoked member give the same 404 and the same page.
    if (profile.error instanceof ApiError && profile.error.status === 404) return <MemberNotFound />
    return <LoadError onRetry={profile.reload} />
  }
  return <ProfileView profile={profile.data} />
}

function BackToMembers() {
  return (
    <Link to="/miembros" className={linkClass}>
      ← Volver a Miembros
    </Link>
  )
}

function MemberNotFound() {
  return (
    <section className="rounded-xl border border-wood/30 bg-paper p-6">
      <h1 className="text-3xl text-forest">No encontramos a este miembro</h1>
      <p className="mt-2 text-bark">Puede que el enlace no esté bien o que este perfil ya no esté disponible.</p>
      <p className="mt-3">
        <BackToMembers />
      </p>
    </section>
  )
}

function ProfileView({ profile }: { profile: MemberProfile }) {
  const { member } = profile
  return (
    <div className="grid gap-6">
      <p>
        <BackToMembers />
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <span className="shrink-0">
          <Avatar member={member} size={96} />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl break-words text-forest sm:text-4xl">{member.displayName}</h1>
          <p className="mt-2">
            {profile.isMe ? (
              <Link to="/mi-perfil" className={linkClass}>
                Editar mi perfil
              </Link>
            ) : (
              // Tastes are compared in Estadísticas (#93), never on a profile.
              <Link to="/estadisticas" className={linkClass}>
                Compara vuestras valoraciones en Estadísticas
              </Link>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="grid min-w-0 gap-6">
          <Bio bio={profile.bio} />
          <FavouriteQuote quote={profile.favouriteQuote} />
        </div>
        <div className="grid min-w-0 gap-6">
          {profile.currentWeek && <ThisWeek week={profile.currentWeek} />}
          <FavouriteBooks books={profile.favouriteBooks} />
        </div>
      </div>
    </div>
  )
}

// Plain text: React escapes it, so markup is shown, never rendered. One
// paragraph per line keeps the member's line breaks.
function lines(text: string | null): string[] {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function Bio({ bio }: { bio: string | null }) {
  const paragraphs = lines(bio)
  return (
    <Card title="Sobre mí">
      {paragraphs.length === 0 ? (
        <EmptyState>Todavía no hay nada escrito aquí.</EmptyState>
      ) : (
        <div className="grid max-w-prose gap-3">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="break-words">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </Card>
  )
}

function FavouriteQuote({ quote }: { quote: string | null }) {
  const quoteLines = lines(quote)
  return (
    <Card title="Cita favorita">
      {quoteLines.length === 0 ? (
        <EmptyState>Todavía no hay una cita favorita.</EmptyState>
      ) : (
        <blockquote className="max-w-prose border-l-4 border-soft-green pl-4 font-serif text-lg break-words text-forest">
          <p className="whitespace-pre-line">«{quoteLines.join('\n')}»</p>
        </blockquote>
      )}
    </Card>
  )
}

function ThisWeek({ week }: { week: MemberWeekStatus }) {
  return (
    <Card title="Esta semana">
      <p className={week.completed ? 'text-moss' : 'text-bark'}>
        Semana {week.weekNumber}: {formatWeekStatus(week.completed)}
      </p>
    </Card>
  )
}

// A public profile choice: no score, status or reading date (#69).
function FavouriteBooks({ books }: { books: BookSummary[] }) {
  return (
    <Card title="Libros favoritos">
      {books.length === 0 ? (
        <EmptyState>Todavía no hay libros favoritos.</EmptyState>
      ) : (
        <ul className="grid gap-4">
          {books.map((book) => (
            <li key={book.id} className="min-w-0">
              <Link
                to={`/biblioteca/${encodeURIComponent(book.id)}`}
                className="flex min-w-0 items-center gap-4 rounded-lg hover:bg-sage/30"
              >
                <BookCover book={book} compact className="w-12 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-serif text-lg break-words text-moss underline underline-offset-4">
                    {book.title}
                  </span>
                  <span className="block text-sm break-words text-bark">{formatAuthors(book.authors)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
