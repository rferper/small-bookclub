import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useApiData } from '../api/hooks'
import type {
  BookStatistics,
  MemberCompatibility,
  MemberStatistics,
  RatingStatistics,
  Statistics,
  StatisticsThresholds,
  TasteCompatibility,
} from '../api/types'
import { BarChart } from '../components/BarChart'
import { Card, EmptyState } from '../components/Card'
import { LoadError, Loading } from '../components/Status'
import { CRITERIA, CRITERION_LABELS, formatMean, formatReviewCount } from '../lib/ratings'

type AvailableRatings = Extract<RatingStatistics, { status: 'available' }>

const bookPath = (id: string) => `/biblioteca/${encodeURIComponent(id)}`
const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'
const tableClass = 'w-full text-left text-sm'
const captionClass = 'mb-1 text-left text-bark'
const headerCellClass = 'py-1 pr-3 align-bottom font-semibold last:pr-0'
const cellClass = 'py-1 pr-3 align-top tabular-nums last:pr-0'
const rowClass = 'border-b border-wood/20 last:border-b-0'

// What a member is called on this page: «Lucía (tú)» for the viewer.
const memberName = (entry: MemberStatistics) =>
  entry.isMe ? `${entry.member.displayName} (tú)` : entry.member.displayName

const EMPTY_RATINGS =
  'Aún no hay valoraciones que puedas ver aquí. Cuando termines un libro y lo valores, sus valoraciones aparecerán en estas estadísticas.'

// Estadísticas (#68). Everything comes from one getStatistics() call, whose
// rating figures the server has already limited to the books the viewer has
// finished and rated; the page only lays them out and rounds for display.
export function StatisticsPage() {
  const statistics = useApiData((api) => api.getStatistics())

  return (
    <div className="grid min-w-0 gap-6">
      <h1 className="text-3xl text-forest sm:text-4xl">Estadísticas</h1>
      {statistics.status === 'loading' && <Loading />}
      {statistics.status === 'error' && <LoadError onRetry={statistics.reload} />}
      {statistics.status === 'ready' && <StatisticsContent statistics={statistics.data} />}
    </div>
  )
}

function StatisticsContent({ statistics }: { statistics: Statistics }) {
  const { ratings, thresholds } = statistics
  return (
    <>
      <p className="max-w-prose text-bark">
        Solo se cuentan las valoraciones de los libros que ya has terminado y valorado, para no desvelarte nada antes de
        tiempo.
      </p>
      <Figures statistics={statistics} />
      {ratings.status === 'empty' ? (
        <EmptyState>{EMPTY_RATINGS}</EmptyState>
      ) : (
        <>
          <Highlights ratings={ratings} thresholds={thresholds} />
          <BooksSection books={ratings.books} />
          <CriteriaSection ratings={ratings} />
          <MembersSection members={ratings.members} />
          <TasteCompatibilitySection />
        </>
      )}
    </>
  )
}

function Figures({ statistics }: { statistics: Statistics }) {
  const { ratings } = statistics
  const items: { label: string; value: string; detail?: string }[] = [
    { label: 'Libros leídos', value: String(statistics.booksRead) },
    { label: 'Reuniones celebradas', value: String(statistics.meetingsHeld) },
  ]
  if (ratings.status === 'available') {
    items.push(
      { label: 'Libros valorados', value: String(ratings.bookCount) },
      { label: 'Valoraciones', value: String(ratings.reviewCount) },
      {
        label: 'Media de todas las valoraciones',
        value: formatMean(ratings.overallMean),
        detail: formatReviewCount(ratings.reviewCount),
      },
    )
  }
  return (
    <Card title="El club en cifras">
      <dl className={`grid grid-cols-2 gap-4 sm:grid-cols-3 ${items.length > 2 ? 'lg:grid-cols-5' : ''}`}>
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col-reverse justify-end">
            <dt className="text-sm break-words text-bark">{item.label}</dt>
            <dd className="text-forest">
              <span className="font-serif text-3xl">{item.value}</span>
              {item.detail && <span className="text-sm"> · {item.detail}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function BookTitle({ entry }: { entry: BookStatistics }) {
  return (
    <Link to={bookPath(entry.book.id)} className={`${linkClass} break-words`}>
      {entry.book.title}
    </Link>
  )
}

// One item of «Destacados»: every tied entry, or a calm note when there is
// not enough data. The server decided which entries qualify.
function Highlight({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-wood/20 p-3">
      <dt className="font-semibold text-forest">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}

function Entries<T>({ entries, render }: { entries: T[]; render: (entry: T) => ReactNode }) {
  return (
    <ul className="grid gap-1">
      {entries.map((entry, index) => (
        <li key={index} className="break-words text-forest">
          {render(entry)}
        </li>
      ))}
    </ul>
  )
}

function Highlights({ ratings, thresholds }: { ratings: AvailableRatings; thresholds: StatisticsThresholds }) {
  const { highlights } = ratings
  const ratedBooks = ratings.books.filter((entry) => entry.reviewCount >= thresholds.bookRatings).length
  const ratedMembers = ratings.members.filter((entry) => entry.reviewCount >= thresholds.memberRatings).length
  const books = `${thresholds.bookRatings} valoraciones o más`
  const members = `${thresholds.memberRatings} valoraciones o más`
  const notEnoughBooks = `Aún no hay suficientes valoraciones: hace falta que al menos dos libros tengan ${books}.`
  const notEnoughMembers = `Aún no hay suficientes valoraciones: hace falta que al menos dos miembros tengan ${members}.`
  // Two or more qualify, but they cannot be told apart.
  const booksNote = (text: string) => (ratedBooks < 2 ? notEnoughBooks : text)
  const membersNote = ratedMembers < 2 ? notEnoughMembers : `Por ahora, los miembros con ${members} tienen la misma media.`

  const meanItem = (list: BookStatistics[]) =>
    list.length === 0 ? (
      <EmptyState>{booksNote(`Por ahora, los libros con ${books} tienen la misma media.`)}</EmptyState>
    ) : (
      <Entries
        entries={list}
        render={(entry) => (
          <>
            <BookTitle entry={entry} /> · {formatMean(entry.overallMean)} · {formatReviewCount(entry.reviewCount)}
          </>
        )}
      />
    )
  const memberItem = (list: MemberStatistics[]) =>
    list.length === 0 ? (
      <EmptyState>{membersNote}</EmptyState>
    ) : (
      <Entries
        entries={list}
        render={(entry) =>
          `${memberName(entry)} · media ${formatMean(entry.overallMean)} en ${formatReviewCount(entry.reviewCount)}`
        }
      />
    )

  return (
    <Card title="Destacados">
      <p className="mb-3 max-w-prose text-sm text-bark">
        Solo tienen en cuenta los libros con {books} y los miembros con {members}.
      </p>
      <dl className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Highlight label="Libro mejor valorado">{meanItem(highlights.topRated)}</Highlight>
        <Highlight label="Libro menos valorado">{meanItem(highlights.lowestRated)}</Highlight>
        <Highlight label="Libro que más divide">
          {highlights.mostDivisive.length === 0 ? (
            <EmptyState>{booksNote(`Por ahora, en los libros con ${books} todas las valoraciones coinciden.`)}</EmptyState>
          ) : (
            <Entries
              entries={highlights.mostDivisive}
              render={(entry) => (
                <>
                  <BookTitle entry={entry} /> · desviación típica {formatMean(entry.dispersion)} ·{' '}
                  {formatReviewCount(entry.reviewCount)}
                </>
              )}
            />
          )}
        </Highlight>
        <Highlight label="Puntuación más generosa">{memberItem(highlights.mostGenerous)}</Highlight>
        <Highlight label="Puntuación más exigente">{memberItem(highlights.harshest)}</Highlight>
      </dl>
    </Card>
  )
}

function BooksSection({ books }: { books: BookStatistics[] }) {
  return (
    <Card title="Media del club por libro">
      <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
        <BarChart
          label="Gráfico de barras: media del club por libro. Los valores están en la tabla siguiente."
          data={books.map((entry) => ({ key: entry.book.id, label: entry.book.title, value: entry.overallMean }))}
        />
        <table className={tableClass}>
          <caption className={captionClass}>Media y desviación típica de cada libro</caption>
          <thead>
            <tr className="border-b border-wood/40">
              <th scope="col" className={headerCellClass}>
                Libro
              </th>
              <th scope="col" className={headerCellClass}>
                Valoraciones
              </th>
              <th scope="col" className={headerCellClass}>
                Media
              </th>
              <th scope="col" className={headerCellClass}>
                Desviación típica
              </th>
            </tr>
          </thead>
          <tbody>
            {books.map((entry) => (
              <tr key={entry.book.id} className={rowClass}>
                <th scope="row" className="py-1 pr-3 align-top font-normal break-words">
                  <BookTitle entry={entry} />
                </th>
                <td className={cellClass}>{entry.reviewCount}</td>
                <td className={cellClass}>{formatMean(entry.overallMean)}</td>
                <td className={cellClass}>{formatMean(entry.dispersion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function CriteriaSection({ ratings }: { ratings: AvailableRatings }) {
  return (
    <Card title="Media por criterio">
      <table className={`${tableClass} max-w-sm`}>
        <caption className={captionClass}>Media de cada criterio ({formatReviewCount(ratings.reviewCount)})</caption>
        <thead>
          <tr className="border-b border-wood/40">
            <th scope="col" className={headerCellClass}>
              Criterio
            </th>
            <th scope="col" className={headerCellClass}>
              Media
            </th>
          </tr>
        </thead>
        <tbody>
          {CRITERIA.map((criterion) => (
            <tr key={criterion} className={rowClass}>
              <th scope="row" className="py-1 pr-3 font-normal">
                {CRITERION_LABELS[criterion]}
              </th>
              <td className={cellClass}>{formatMean(ratings.criterionMeans[criterion])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function MembersSection({ members }: { members: MemberStatistics[] }) {
  return (
    <Card title="Media de cada miembro">
      <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
        <BarChart
          label="Gráfico de barras: media de cada miembro. Los valores están en la tabla siguiente."
          data={members.map((entry) => ({ key: entry.member.id, label: memberName(entry), value: entry.overallMean }))}
        />
        <table className={tableClass}>
          <caption className={captionClass}>Media de las valoraciones de cada miembro</caption>
          <thead>
            <tr className="border-b border-wood/40">
              <th scope="col" className={headerCellClass}>
                Miembro
              </th>
              <th scope="col" className={headerCellClass}>
                Valoraciones
              </th>
              <th scope="col" className={headerCellClass}>
                Media
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((entry) => (
              <tr key={entry.member.id} className={rowClass}>
                <th scope="row" className="py-1 pr-3 align-top font-normal break-words">
                  {memberName(entry)}
                </th>
                <td className={cellClass}>{entry.reviewCount}</td>
                <td className={cellClass}>{formatMean(entry.overallMean)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// «Gustos en común» (#93): the viewer against one other member at a time.
// It loads with its own call, only when there are ratings to compare, so its
// loading and error states stay inside the section. The server has already
// limited it to the books the viewer has finished and rated, and sends no
// difference below the threshold; the page only lays it out.
function TasteCompatibilitySection() {
  const compatibility = useApiData((api) => api.getTasteCompatibility())
  return (
    <Card title="Gustos en común">
      <p className="mb-3 max-w-prose text-bark">
        Compara tus valoraciones con las de otro miembro, solo en los libros que habéis valorado los dos y que ya puedes
        ver.
      </p>
      {compatibility.status === 'loading' && <Loading />}
      {compatibility.status === 'error' && (
        <LoadError message="No se ha podido cargar la comparación de gustos." onRetry={compatibility.reload} />
      )}
      {compatibility.status === 'ready' && <Compatibility compatibility={compatibility.data} />}
    </Card>
  )
}

function Compatibility({ compatibility }: { compatibility: TasteCompatibility }) {
  const selectId = useId()
  // Not remembered: a reload starts again from the first member.
  const [memberId, setMemberId] = useState<string | null>(null)
  const { members, minSharedBooks } = compatibility
  if (members.length === 0) {
    return <EmptyState>Todavía no hay otros miembros con quien comparar tus valoraciones.</EmptyState>
  }
  const selected = members.find((entry) => entry.member.id === memberId) ?? members[0]

  return (
    <div className="grid min-w-0 gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={selectId} className="text-sm text-bark">
          Comparar con
        </label>
        <select
          id={selectId}
          value={selected.member.id}
          onChange={(event) => setMemberId(event.target.value)}
          className="w-full max-w-xs rounded-md border border-wood/60 bg-paper px-3 py-2 text-forest"
        >
          {/* The server's order: by name, never by difference. */}
          {members.map((entry) => (
            <option key={entry.member.id} value={entry.member.id}>
              {entry.member.displayName}
            </option>
          ))}
        </select>
      </div>
      <Comparison entry={selected} minSharedBooks={minSharedBooks} />
    </div>
  )
}

const sharedBooks = (count: number) => (count === 1 ? '1 libro en común' : `${count} libros en común`)

function Comparison({ entry, minSharedBooks }: { entry: MemberCompatibility; minSharedBooks: number }) {
  const { comparison, sharedBookCount } = entry
  const name = entry.member.displayName
  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-forest">
        Libros en común: <span className="font-semibold tabular-nums">{sharedBookCount}</span>
      </p>
      {comparison.status === 'insufficient' ? (
        <div className="grid gap-1">
          <EmptyState>Aún no hay suficientes libros en común.</EmptyState>
          <p className="max-w-prose text-bark">
            Para comparar hacen falta al menos {minSharedBooks} libros valorados por los dos.
          </p>
        </div>
      ) : (
        <>
          <dl className="flex min-w-0 flex-col-reverse justify-end">
            <dt className="text-sm text-bark">Diferencia media en la nota global</dt>
            <dd className="text-forest">
              <span className="font-serif text-3xl">{formatMean(comparison.overallDifference)}</span> puntos, en{' '}
              {sharedBooks(sharedBookCount)}
            </dd>
          </dl>
          <p className="max-w-prose text-sm text-bark">
            En cada libro comparamos vuestra nota global (de 1 a 5). La diferencia media va de 0, si coincidís siempre, a
            4, la mayor diferencia posible.
          </p>
          <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
            <table className={tableClass}>
              <caption className={captionClass}>Diferencia media por criterio ({sharedBooks(sharedBookCount)})</caption>
              <thead>
                <tr className="border-b border-wood/40">
                  <th scope="col" className={headerCellClass}>
                    Criterio
                  </th>
                  <th scope="col" className={headerCellClass}>
                    Diferencia media
                  </th>
                </tr>
              </thead>
              <tbody>
                {CRITERIA.map((criterion) => (
                  <tr key={criterion} className={rowClass}>
                    <th scope="row" className="py-1 pr-3 font-normal">
                      {CRITERION_LABELS[criterion]}
                    </th>
                    <td className={cellClass}>{formatMean(comparison.criterionDifferences[criterion])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className={tableClass}>
              <caption className={`${captionClass} break-words`}>Libros en común con {name}</caption>
              <thead>
                <tr className="border-b border-wood/40">
                  <th scope="col" className={headerCellClass}>
                    Libro
                  </th>
                  <th scope="col" className={headerCellClass}>
                    Tu nota
                  </th>
                  <th scope="col" className={`${headerCellClass} break-words`}>
                    Nota de {name}
                  </th>
                  <th scope="col" className={headerCellClass}>
                    Diferencia
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.books.map((shared) => (
                  <tr key={shared.book.id} className={rowClass}>
                    <th scope="row" className="py-1 pr-3 align-top font-normal break-words">
                      <Link to={bookPath(shared.book.id)} className={`${linkClass} break-words`}>
                        {shared.book.title}
                      </Link>
                    </th>
                    <td className={cellClass}>{formatMean(shared.myOverall)}</td>
                    <td className={cellClass}>{formatMean(shared.theirOverall)}</td>
                    <td className={cellClass}>{formatMean(shared.difference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
