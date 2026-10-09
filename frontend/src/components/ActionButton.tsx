import { useRef, useState } from 'react'

const VARIANTS = {
  primary: 'rounded-lg bg-forest px-5 py-2.5 font-semibold text-parchment hover:bg-moss',
  secondary: 'rounded-lg border-2 border-forest px-5 py-2 font-semibold text-forest hover:bg-sage/50',
  quiet: 'rounded-md border border-forest px-3 py-2 text-forest hover:bg-sage/50',
}

// A button that runs one async action at a time: it is disabled while the
// action is in flight and shows `errorMessage` next to it if the action fails.
export function ActionButton({
  label,
  onAction,
  errorMessage,
  variant = 'primary',
  className = '',
}: {
  label: string
  onAction: () => Promise<void>
  errorMessage: string
  variant?: keyof typeof VARIANTS
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const running = useRef(false)

  const run = async () => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setFailed(false)
    try {
      await onAction()
    } catch {
      setFailed(true)
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <button type="button" onClick={run} disabled={busy} className={`${VARIANTS[variant]} disabled:opacity-60`}>
        {label}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-bark">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
