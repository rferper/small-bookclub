import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAdminAccess } from '../admin/context'
import { AdminOnlyMessage } from '../admin/AdminGuard'
import { ApiError } from '../api/client'
import { useApi, useApiData } from '../api/hooks'
import type { AuditAction } from '../api/types'
import { Card, EmptyState } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Loading, LoadError } from '../components/Status'
import { formatMeetingDateWithYear } from '../lib/format'

const labels: Record<AuditAction, string> = {
  member_approved: 'Acceso aprobado', member_revoked: 'Acceso retirado', member_restored: 'Acceso restaurado',
  curator_assigned: 'Curaduría asignada', curator_cleared: 'Curaduría retirada', book_status_changed: 'Estado del libro cambiado',
  summary_published: 'Resumen publicado', summary_unpublished: 'Resumen retirado de publicación',
  highlight_published: 'Momento destacado publicado', highlight_unpublished: 'Momento destacado retirado de publicación',
  soft_deleted: 'Contenido enviado a la papelera', restored: 'Contenido restaurado', purged: 'Contenido eliminado definitivamente',
  vote_closed: 'Votación cerrada', tie_resolved: 'Empate resuelto', exported: 'Exportación de demostración',
}
const back = <Link to="/administracion" className="text-moss underline">Volver a Administración</Link>

export function AdminBackupsPage() {
  const loaded = useApiData((api) => api.getBackupInfo())
  if (loaded.status === 'error' && loaded.error instanceof ApiError && loaded.error.status === 403) return <AdminOnlyMessage focusOnMount />
  return <div className="grid min-w-0 gap-6 wrap-anywhere">{back}
    <h1 className="text-3xl text-forest">Copias y exportación</h1>
    <p>Esta demostración contiene datos ficticios. La exportación JSON es un ejemplo, no una copia restaurable de la base de datos ni de los archivos multimedia.</p>
    <Card title="Política de copias">
      <p>Las copias automáticas consistentes de la base de datos y de los archivos multimedia, junto con la recuperación probada, pertenecen al despliegue.</p>
      <p className="mt-3">La papelera mantiene el contenido retirado durante 30 días, por separado. Los datos borrados antiguos pueden permanecer en copias hasta que estas caduquen. La rotación de copias debe tener un límite.</p>
      {loaded.status === 'loading' && <Loading />}
      {loaded.status === 'error' && <LoadError message="No se ha podido cargar la información de copias." onRetry={loaded.reload} />}
      {loaded.status === 'ready' && <>
        <p className="mt-3 font-semibold">Política de copias pendiente de configurar</p>
        <p>La frecuencia, el destino y la rotación todavía no se han acordado.</p>
        {loaded.data.lastBackupAt && <p className="mt-3">Última copia simulada: {formatMeetingDateWithYear(loaded.data.lastBackupAt)}</p>}
        <ExportControl />
      </>}
    </Card>
  </div>
}

function ExportControl() {
  const api = useApi(), { forbid } = useAdminAccess()
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('')
  const running = useRef(false), button = useRef<HTMLButtonElement>(null), restoreFocus = useRef(false)
  useLayoutEffect(() => { if (!open && restoreFocus.current) { button.current?.focus(); restoreFocus.current = false } }, [open])
  const close = () => { restoreFocus.current = true; setOpen(false); setError('') }
  const run = async () => {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      const result = await api.exportClubData()
      const url = URL.createObjectURL(new Blob([result.json], { type: 'application/json;charset=utf-8' }))
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = result.filename; document.body.append(anchor)
      try { anchor.click() } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
      close(); setSuccess('Exportación de demostración descargada')
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 403) forbid()
      else if (!(reason instanceof ApiError && reason.status === 401)) setError(reason instanceof ApiError && reason.status === 409 ? reason.message : 'No se ha podido descargar la exportación. Vuelve a intentarlo.')
    } finally { running.current = false; setBusy(false) }
  }
  return <div className="mt-5">
    <button ref={button} className="rounded-lg bg-forest px-5 py-2.5 font-semibold text-parchment disabled:opacity-60" disabled={busy} onClick={() => { setSuccess(''); setOpen(true) }}>Exportar datos</button>
    {success && <p role="status" className="mt-3">{success}</p>}
    {open && <ConfirmDialog title="¿Exportar el club ficticio completo?" confirmLabel={busy ? 'Exportando…' : 'Confirmar exportación'} busy={busy} error={error || null} onCancel={close} onConfirm={() => void run()}>
      <p>El archivo puede contener registros privados y datos retirados que aún se pueden recuperar.</p>
      <p>Esta confirmación simula la autorización administrativa. En esta demostración no se realiza una reautenticación real.</p>
      <p>Solo incluye referencias multimedia existentes; no descarga sus archivos.</p>
    </ConfirmDialog>}
  </div>
}

export function AdminAuditPage() {
  const loaded = useApiData((api) => api.getAuditLog())
  if (loaded.status === 'error' && loaded.error instanceof ApiError && loaded.error.status === 403) return <AdminOnlyMessage focusOnMount />
  return <div className="grid min-w-0 gap-6 wrap-anywhere">{back}
    <h1 className="text-3xl text-forest">Registro de actividad</h1>
    <p>Registro operativo simulado y de solo lectura. Conserva identificadores y etiquetas, sin copiar el contenido privado de los registros.</p>
    {loaded.status === 'loading' && <Loading />}
    {loaded.status === 'error' && <LoadError message="No se ha podido cargar el registro de actividad." onRetry={loaded.reload} />}
    {loaded.status === 'ready' && <Card title="Actividad administrativa">
      {!loaded.data.length && <EmptyState>Todavía no hay actividad administrativa.</EmptyState>}
      <ol className="grid gap-4">{loaded.data.map((event) => <li key={event.id} className="min-w-0 border-b border-wood/30 pb-4">
        <h3 className="font-serif text-xl">{labels[event.action]}</h3>
        <p className="whitespace-pre-wrap">{event.target.label} · Identificador: {event.target.id}</p>
        <p>Por {event.actor.displayName}</p>
        <time dateTime={event.occurredAt} className="text-bark">{formatMeetingDateWithYear(event.occurredAt)}</time>
      </li>)}</ol>
    </Card>}
  </div>
}
