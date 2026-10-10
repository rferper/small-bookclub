import { BAR_TICKS, barPercent } from '../lib/bars'
import { formatMean } from '../lib/ratings'

export interface BarDatum {
  key: string
  label: string
  value: number
}

// Where a guide mark sits on the track. The end marks are aligned inside the
// track, so neither the line nor its label can stick out.
const tickPosition = (tick: number, index: number) =>
  index === BAR_TICKS.length - 1 ? { right: 0 } : { left: `${barPercent(tick)}%` }
const tickLabelClass = (index: number) => (index === 0 || index === BAR_TICKS.length - 1 ? '' : '-translate-x-1/2')

// A hand-built horizontal bar chart (#68), plain HTML and CSS: one `forest`
// bar per entry on a 0–5 scale with labelled guide marks, each bar with its
// value as text. It is one image for assistive technology, with nothing
// focusable, no tooltip and no animation; the table that follows it holds
// the same values.
export function BarChart({ label, data }: { label: string; data: readonly BarDatum[] }) {
  return (
    <div role="img" aria-label={label} className="grid min-w-0 gap-3 text-sm">
      {data.map((datum) => (
        <div key={datum.key} data-bar-row={datum.key} className="grid min-w-0 gap-1">
          <span className="break-words text-forest">{datum.label}</span>
          <div className="flex items-center gap-2">
            <div className="relative h-4 min-w-0 flex-1">
              {BAR_TICKS.map((tick, index) => (
                <span key={tick} className="absolute inset-y-0 w-px bg-wood/40" style={tickPosition(tick, index)} />
              ))}
              <span
                data-bar={datum.key}
                className="absolute inset-y-0 left-0 rounded-r-sm bg-forest"
                style={{ width: `${barPercent(datum.value)}%` }}
              />
            </div>
            <span data-bar-value={datum.key} className="w-8 shrink-0 text-right text-forest tabular-nums">
              {formatMean(datum.value)}
            </span>
          </div>
        </div>
      ))}
      {/* The scale, under the tracks and aligned with them. */}
      <div className="flex gap-2">
        <div data-scale className="relative h-5 min-w-0 flex-1">
          {BAR_TICKS.map((tick, index) => (
            <span key={tick} className={`absolute top-0 text-bark ${tickLabelClass(index)}`} style={tickPosition(tick, index)}>
              {tick}
            </span>
          ))}
        </div>
        <span className="w-8 shrink-0" />
      </div>
    </div>
  )
}
