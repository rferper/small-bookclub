import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])'

// A modal confirmation for an action that cannot be undone (#91). Focus
// starts on «Cancelar» and stays inside the dialog; «Cancelar» and Escape
// close it without doing anything. The caller runs the action and moves
// focus back to the control that opened it.
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  // While the action runs, both buttons are disabled and Escape does nothing.
  busy: boolean
  // A Spanish message shown as an alert inside the dialog.
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  // The keyboard listener is added once; it reads the latest props from here.
  const latest = useRef({ busy, onCancel })
  useLayoutEffect(() => {
    latest.current = { busy, onCancel }
  })

  useLayoutEffect(() => {
    cancelRef.current?.focus()
  }, [])

  // After a failure, focus returns to the confirm button next to the alert.
  useLayoutEffect(() => {
    if (error && !busy) confirmRef.current?.focus()
  }, [error, busy])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!latest.current.busy) latest.current.onCancel()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const active = document.activeElement
      const inside = active instanceof Node && dialog.contains(active)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (!inside || active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-wood/40 bg-paper p-6 shadow-lg"
      >
        <h2 id={titleId} className="text-xl break-words text-forest">
          {title}
        </h2>
        <div id={descriptionId} className="mt-3 grid gap-2 break-words">
          {children}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-bark">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border-2 border-forest px-5 py-2 font-semibold text-forest hover:bg-sage/50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-forest px-5 py-2.5 font-semibold text-parchment hover:bg-moss disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
