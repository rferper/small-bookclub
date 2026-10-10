import { useId, useState } from 'react'
import type { ClubRatings, ClubReview, CriterionScores } from '../api/types'
import { CRITERIA, CRITERION_LABELS, formatMean, formatReviewCount, formatScore } from '../lib/ratings'
import { pointOnAxis, RADAR_CHART, RADAR_RINGS, radarPoints, radarVertices, ringPoints } from '../lib/radar'

type VisibleClub = Extract<ClubRatings, { status: 'visible' }>

const valuesOf = (scores: CriterionScores) => CRITERIA.map((criterion) => scores[criterion])

// What a member is called in the legend and the selector: «Lucía (tú)» for
// the signed-in user's own review, the display name otherwise.
const optionLabel = (review: ClubReview) =>
  review.isMine ? `${review.member.displayName} (tú)` : review.member.displayName

// «Comparación con el club» (#92): one member's five scores against the club's
// criterion means, as a radar chart and an equivalent table. It draws only
// what the visible ratings already contain (the server's gate decided that),
// has no role input and makes no call of its own.
export function ClubComparison({ club }: { club: VisibleClub }) {
  const headingId = useId()
  const selectId = useId()
  const own = club.reviews.find((review) => review.isMine) ?? club.reviews[0]
  // The choice belongs to this load of the ratings: a reload (a new `club`)
  // goes back to the user's own review. It is never remembered elsewhere.
  const [selection, setSelection] = useState<{ club: VisibleClub; memberId: string } | null>(null)
  if (!own) return null
  const memberId = selection?.club === club ? selection.memberId : own.member.id
  const selected = club.reviews.find((review) => review.member.id === memberId) ?? own
  const name = selected.member.displayName

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 content-start gap-3">
      <h3 id={headingId} className="text-lg text-forest">
        Comparación con el club
      </h3>
      {club.reviews.length === 1 ? (
        <p className="max-w-prose text-bark">
          Por ahora solo está tu valoración, así que coincide con la media del club.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-sm text-bark">
            Miembro
          </label>
          <select
            id={selectId}
            value={selected.member.id}
            onChange={(event) => setSelection({ club, memberId: event.target.value })}
            className="w-fit max-w-full rounded-md border border-wood/60 bg-paper px-3 py-2 text-forest"
          >
            {/* The server's order: own review first, then by name. */}
            {club.reviews.map((review) => (
              <option key={review.member.id} value={review.member.id}>
                {optionLabel(review)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] md:items-start">
        <div className="grid min-w-0 gap-2">
          <RadarChart member={selected} means={club.criterionMeans} />
          <Legend memberLabel={optionLabel(selected)} />
        </div>
        <ComparisonTable name={name} scores={selected.scores} means={club.criterionMeans} count={club.reviewCount} />
      </div>
    </section>
  )
}

const { width, height, center, radius } = RADAR_CHART

// Hand-built SVG: no animation, no focusable element, no tooltip. The
// table that follows is its text equivalent.
function RadarChart({ member, means }: { member: ClubReview; means: CriterionScores }) {
  const memberVertices = radarVertices(center, radius, valuesOf(member.scores))
  const clubVertices = radarVertices(center, radius, valuesOf(means))
  return (
    <svg
      role="img"
      aria-label={`Gráfico radar: puntuaciones de ${member.member.displayName} comparadas con la media del club. Los valores están en la tabla siguiente.`}
      viewBox={`0 0 ${width} ${height}`}
      className="block h-auto w-full max-w-[28rem]"
    >
      {/* Guide rings for 1 to 5 and the five axes. */}
      <g fill="none" strokeWidth={1} className="stroke-wood/50">
        {RADAR_RINGS.map((level) => (
          <polygon key={level} data-ring={level} points={ringPoints(center, radius, level)} />
        ))}
        {CRITERIA.map((criterion, index) => {
          const end = pointOnAxis(center, radius, index)
          return <line key={criterion} x1={center.x} y1={center.y} x2={end.x} y2={end.y} />
        })}
      </g>

      {/* Ring labels along Disfrute, just left of the axis and below each ring. */}
      <g fontSize={13} textAnchor="end" className="fill-bark">
        {RADAR_RINGS.map((level) => {
          const at = pointOnAxis(center, (radius * level) / 5, 0)
          return (
            <text key={level} x={at.x - 4} y={at.y} dy="0.95em">
              {level}
            </text>
          )
        })}
      </g>

      {/* Axis labels, from the same angles as the axes. */}
      <g fontSize={14} className="fill-forest">
        {CRITERIA.map((criterion, index) => {
          const at = pointOnAxis(center, radius + 9, index)
          const side = at.x - center.x
          const vertical = at.y - center.y
          return (
            <text
              key={criterion}
              data-axis={criterion}
              x={at.x}
              y={at.y}
              textAnchor={side > 1 ? 'start' : side < -1 ? 'end' : 'middle'}
              dy={vertical < -radius * 0.5 ? '0' : vertical > radius * 0.5 ? '0.85em' : '0.35em'}
            >
              {CRITERION_LABELS[criterion]}
            </text>
          )
        })}
      </g>

      {/* The member: solid, wider line and a light fill; the club: dashed,
          narrower line and no fill, drawn on top, so where the shapes overlap
          or coincide both outlines stay visible. */}
      <polygon
        data-series="member"
        points={radarPoints(center, radius, valuesOf(member.scores))}
        strokeWidth={4}
        strokeLinejoin="round"
        className="fill-forest/10 stroke-forest"
      />
      <polygon
        data-series="club"
        points={radarPoints(center, radius, valuesOf(means))}
        fill="none"
        strokeWidth={2}
        strokeDasharray="6 4"
        className="stroke-bark"
      />
      {/* Club markers: hollow squares, large enough to frame a member's round
          marker on the same point. */}
      <g strokeWidth={2} className="fill-paper stroke-bark">
        {clubVertices.map((vertex, index) => (
          <rect key={index} data-marker="club" x={vertex.x - 6} y={vertex.y - 6} width={12} height={12} />
        ))}
      </g>
      <g className="fill-forest">
        {memberVertices.map((vertex, index) => (
          <circle key={index} data-marker="member" cx={vertex.x} cy={vertex.y} r={3.5} />
        ))}
      </g>
    </svg>
  )
}

// A visible HTML legend, each entry with a sample of its line and marker.
function Legend({ memberLabel }: { memberLabel: string }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-forest">
      <li className="flex items-center gap-2">
        <svg aria-hidden="true" width={36} height={14} viewBox="0 0 36 14" className="shrink-0">
          <line x1={2} y1={7} x2={34} y2={7} strokeWidth={4} className="stroke-forest" />
          <circle cx={18} cy={7} r={3.5} className="fill-forest" />
        </svg>
        <span className="break-words">{memberLabel}</span>
      </li>
      <li className="flex items-center gap-2">
        <svg aria-hidden="true" width={36} height={14} viewBox="0 0 36 14" className="shrink-0">
          <line x1={1} y1={7} x2={35} y2={7} strokeWidth={2} strokeDasharray="6 4" className="stroke-bark" />
          <rect x={12} y={1} width={12} height={12} strokeWidth={2} className="fill-paper stroke-bark" />
        </svg>
        <span>Media del club</span>
      </li>
    </ul>
  )
}

function ComparisonTable({
  name,
  scores,
  means,
  count,
}: {
  name: string
  scores: CriterionScores
  means: CriterionScores
  count: number
}) {
  return (
    <table className="w-full max-w-sm text-left">
      <caption className="mb-1 text-left text-sm text-bark">
        Puntuaciones de {name} y media del club por criterio ({formatReviewCount(count)})
      </caption>
      <thead>
        <tr className="border-b border-wood/40">
          <th scope="col" className="py-1 pr-4 font-semibold">
            Criterio
          </th>
          <th scope="col" className="py-1 pr-4 font-semibold break-words">
            {name}
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
            <td className="py-1 pr-4">{formatScore(scores[criterion])}</td>
            <td className="py-1">{formatMean(means[criterion])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
