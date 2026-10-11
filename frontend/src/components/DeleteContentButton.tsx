import { useLayoutEffect, useRef, useState } from 'react'
import { ApiError, type ApiClient } from '../api/client'
import { useApi } from '../api/hooks'
import { useAdminAccess } from '../admin/context'
import { ConfirmDialog } from './ConfirmDialog'

// The central preview owns dependency counts, rather than loading private records.
export function DeleteContentButton({ type, id, label, onDeleted, disabled = false }: {
  type: 'book' | 'meeting' | 'quote'; id: string; label: string
  onDeleted: () => void; disabled?: boolean
}) {
  const api = useApi(), { forbid } = useAdminAccess()
  const [preview, setPreview] = useState<Awaited<ReturnType<ApiClient['getDeletionPreview']>> | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const running = useRef(false), trigger = useRef<HTMLButtonElement>(null), restoreFocus = useRef(false)
  useLayoutEffect(() => { if (!preview && !busy && restoreFocus.current) { trigger.current?.focus(); restoreFocus.current = false } }, [preview, busy])
  const run = async (action: () => Promise<void>) => {
    if (running.current) return
    running.current = true; setBusy(true); setError('')
    try { await action() }
    catch (reason) {
      if (reason instanceof ApiError && reason.status === 403) forbid()
      else if (!(reason instanceof ApiError && reason.status === 401)) setError(reason instanceof ApiError && [400, 404, 409].includes(reason.status) ? reason.message : 'No se ha podido eliminar. Conservamos el contenido; vuelve a intentarlo.')
    } finally { running.current = false; setBusy(false) }
  }
  return <div className="min-w-0">
    <button ref={trigger} type="button" className="rounded-lg border-2 border-forest px-3 py-2 text-forest disabled:opacity-60" disabled={busy || disabled} aria-label={`Eliminar ${label}`} onClick={() => void run(async () => { setPreview(await api.getDeletionPreview(type, id)) })}>{busy && !preview ? 'Cargando confirmación…' : 'Eliminar'}</button>
    {error && !preview && <p role="alert" className="mt-2 text-bark">{error}</p>}
    {preview && <ConfirmDialog title={`¿Eliminar ${preview.label}?`} confirmLabel="Confirmar eliminación" busy={busy} error={error || null} onCancel={() => { restoreFocus.current = true; setPreview(null); setError('') }} onConfirm={() => void run(async () => {
      if (type === 'book') await api.deleteBook(id)
      else if (type === 'meeting') await api.deleteMeeting(id)
      else await api.deleteLiteraryQuote(id)
      restoreFocus.current = true; setPreview(null); onDeleted()
    })}>
      <p>El contenido dejará de mostrarse. Puedes recuperarlo en la Papelera durante 30 días.</p>
      <p>Se conservarán sus datos y el historial dependiente.</p>
      {!!preview.dependencies.length && <ul className="list-inside list-disc">{preview.dependencies.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
    </ConfirmDialog>}
  </div>
}
