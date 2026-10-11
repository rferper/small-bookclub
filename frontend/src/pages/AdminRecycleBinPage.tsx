import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AdminOnlyMessage } from '../admin/AdminGuard'
import { useAdminAccess } from '../admin/context'
import { ApiError } from '../api/client'
import { useApi, useApiData } from '../api/hooks'
import type { RecycleBinEntry } from '../api/types'
import { Card, EmptyState } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LoadError, Loading } from '../components/Status'
import { formatMeetingDateWithYear } from '../lib/format'

const button = 'rounded-lg border-2 border-forest px-3 py-2 text-forest disabled:opacity-60'
const typeLabels = { book: 'Libro', meeting: 'Reunión', quote: 'Cita literaria', week: 'Semana de lectura', highlight: 'Momento destacado' }

export function AdminRecycleBinPage() {
  const loaded = useApiData((api) => api.getRecycleBin())
  if (loaded.status === 'error' && loaded.error instanceof ApiError && loaded.error.status === 403) return <AdminOnlyMessage focusOnMount />
  return <div className="grid min-w-0 gap-6 wrap-anywhere">
    <Link to="/administracion" className="text-moss underline">Volver a Administración</Link>
    <h1 className="text-3xl text-forest">Papelera</h1>
    <p>Recupera contenido durante los 30 días siguientes a su retirada. Los plazos se calculan con el reloj del club.</p>
    {loaded.status === 'loading' && <Loading />}
    {loaded.status === 'error' && <LoadError message="No se ha podido cargar la papelera." onRetry={loaded.reload} />}
    {loaded.status === 'ready' && <BinEditor initial={loaded.data} />}
  </div>
}

function BinEditor({ initial }: { initial: RecycleBinEntry[] }) {
  const api = useApi(), { forbid } = useAdminAccess()
  const [entries, setEntries] = useState(initial), [target, setTarget] = useState<RecycleBinEntry | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  const [failedId, setFailedId] = useState('')
  const running = useRef(false), returnFocus = useRef<HTMLElement | null>(null), heading = useRef<HTMLHeadingElement>(null), focusRequested = useRef(false)
  useLayoutEffect(() => {
    if (!busy && !target && focusRequested.current) { (returnFocus.current?.isConnected ? returnFocus.current : heading.current)?.focus(); focusRequested.current = false }
  }, [busy, target, entries])
  const run = async (entry: RecycleBinEntry, purge: boolean) => {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setSuccess(''); setFailedId(`${entry.type}:${entry.id}`)
    try {
      const next = purge ? await api.purgeDeleted(entry.type, entry.id) : await api.restoreDeleted(entry.type, entry.id)
      setEntries(next); setTarget(null); setSuccess(purge ? 'Contenido eliminado definitivamente de esta simulación.' : 'Contenido restaurado.'); focusRequested.current = true
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403) forbid()
      else if (!(reason instanceof ApiError && reason.status === 401)) setError(reason instanceof ApiError && [400, 404, 409].includes(reason.status) ? reason.message : 'No se han guardado los cambios. Conservamos la lista; vuelve a intentarlo.')
    } finally { running.current = false; setBusy(false) }
  }
  return <Card title="Contenido retirado" headingRef={heading}>
    {!entries.length && <EmptyState>La papelera está vacía. No hay contenido pendiente de recuperar.</EmptyState>}
    {success && <p role="status" className="mb-4">{success}</p>}
    <ul className="grid gap-5">{entries.map((entry) => <li key={`${entry.type}:${entry.id}`} className="min-w-0 border-b border-wood/30 pb-4">
      <h3 className="font-serif text-xl whitespace-pre-wrap">{entry.label}</h3>
      <p className="text-bark">{typeLabels[entry.type]} · Identificador: {entry.id}</p>
      <dl className="mt-2 grid gap-1 text-bark">
        <div><dt className="inline font-semibold">Retirada: </dt><dd className="inline">{formatMeetingDateWithYear(entry.deletedAt)}</dd></div>
        <div><dt className="inline font-semibold">Retirada por: </dt><dd className="inline">{entry.deletedByName}</dd></div>
        <div><dt className="inline font-semibold">Fin de recuperación: </dt><dd className="inline">{formatMeetingDateWithYear(entry.purgeDueAt)}</dd></div>
      </dl>
      {!!entry.dependencies.length && <ul className="mt-2 list-inside list-disc">{entry.dependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}</ul>}
      {entry.expired && <p className="mt-2 font-semibold">El plazo de recuperación ha terminado.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!entry.expired && <button className={button} disabled={busy} aria-label={`Restaurar ${entry.label}`} onClick={(event) => { returnFocus.current = event.currentTarget; void run(entry, false) }}>Restaurar</button>}
        <button className={button} disabled={busy} aria-label={`Eliminar definitivamente ${entry.label}`} onClick={(event) => { returnFocus.current = event.currentTarget; setError(''); setSuccess(''); setTarget(entry) }}>Eliminar definitivamente</button>
      </div>
      {error && !target && failedId === `${entry.type}:${entry.id}` && <p role="alert" className="mt-2 text-bark">{error}</p>}
    </li>)}</ul>
    {target && <ConfirmDialog title={`¿Eliminar definitivamente ${target.label}?`} confirmLabel="Confirmar eliminación definitiva" busy={busy} error={error || null} onCancel={() => { focusRequested.current = true; setTarget(null); setError('') }} onConfirm={() => void run(target, true)}>
      <p>Este contenido dejará de poder recuperarse. Su historial dependiente no se eliminará en cascada; si hay dependencias, la eliminación será rechazada.</p>
      <p>Esta simulación no borra archivos reales ni copias de seguridad.</p>
      {!!target.dependencies.length && <ul className="list-inside list-disc">{target.dependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}</ul>}
    </ConfirmDialog>}
  </Card>
}
