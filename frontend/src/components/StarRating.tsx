import { useId, type Ref } from 'react'
import type { RubricAnchors } from '../api/types'
import { formatScore, formatStars, neighbouringAnchors, SCORE_VALUES } from '../lib/ratings'

const STAR_PATH = 'M12 2.5l2.94 6.08 6.56.95-4.75 4.63 1.12 6.54L12 17.6l-5.87 3.1 1.12-6.54L2.5 9.53l6.56-.95z'

// One criterion of the rating form: a fieldset of nine native radio buttons
// (1 to 5 in steps of 0.5), so Tab reaches the group once and the arrow keys
// move the selection by half a star. The radios are visually hidden behind
// five stars: the left half of star k picks k − 0.5 (1 for the first star)
// and the right half picks k. Each half is at least 24 × 48 CSS px. The
// chosen value is also stated in text, and the rubric descriptions around it
// are shown only when they exist.
export function StarRating({
  name,
  label,
  hint,
  value,
  onChange,
  error,
  anchors,
  firstInputRef,
}: {
  name: string
  label: string
  hint?: string
  value: number | undefined
  onChange: (value: number) => void
  // Describes the group and marks it invalid while set.
  error: string | null
  anchors: RubricAnchors
  // The first radio, so the form can move focus to a missing group.
  firstInputRef?: Ref<HTMLInputElement>
}) {
  const errorId = useId()
  const descriptions =
    value === undefined
      ? []
      : neighbouringAnchors(value).flatMap((stars) => {
          const text = anchors[stars]
          return text ? [{ stars, text }] : []
        })

  return (
    <fieldset
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className="grid min-w-0 content-start gap-2"
    >
      <legend className="font-serif text-lg font-semibold text-forest">{label}</legend>
      {hint && <p className="-mt-1 text-sm text-bark">{hint}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="relative flex rounded-md has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest">
          {SCORE_VALUES.map((score) => (
            <label key={score} className="sr-only">
              <input
                ref={score === SCORE_VALUES[0] ? firstInputRef : undefined}
                type="radio"
                name={name}
                value={score}
                checked={value === score}
                onChange={() => onChange(score)}
              />
              {formatStars(score)}
            </label>
          ))}
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} star={star} value={value} onPick={onChange} />
          ))}
        </div>
        <p className="text-forest">{value === undefined ? 'Sin puntuar' : `${formatScore(value)} de 5`}</p>
      </div>
      {descriptions.length > 0 && (
        <ul className="grid gap-1 text-sm">
          {descriptions.map(({ stars, text }) => (
            <li key={stars} className="break-words">
              <span className="font-semibold">{formatStars(stars)}:</span> {text}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={errorId} className="font-semibold text-bark">
          {error}
        </p>
      )}
    </fieldset>
  )
}

// A decorative star with two pointer targets; keyboard and screen reader
// users use the radios above, which hold the same value.
function Star({ star, value, onPick }: { star: number; value: number | undefined; onPick: (value: number) => void }) {
  const fill = value === undefined ? 0 : value >= star ? 1 : value >= star - 0.5 ? 0.5 : 0
  const halves = [star === 1 ? 1 : star - 0.5, star]
  return (
    <span aria-hidden="true" className="relative block size-12 shrink-0">
      <svg viewBox="0 0 24 24" className="absolute inset-0 size-12">
        <path d={STAR_PATH} className="fill-paper stroke-forest" strokeWidth={1.2} strokeLinejoin="round" />
      </svg>
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 24 24" className="size-12 max-w-none">
          <path d={STAR_PATH} className="fill-moss stroke-forest" strokeWidth={1.2} strokeLinejoin="round" />
        </svg>
      </span>
      {halves.map((half, index) => (
        <span
          key={index}
          data-star-value={half}
          className={`absolute inset-y-0 w-1/2 cursor-pointer ${index === 0 ? 'left-0' : 'right-0'}`}
          onClick={() => onPick(half)}
        />
      ))}
    </span>
  )
}
