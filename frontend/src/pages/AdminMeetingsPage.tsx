import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, useApiData } from '../api/hooks'
import type { AdminMeeting, AdminMeetingCalendar } from '../api/types'
import { useAdminAccess } from '../admin/context'
import { Card, EmptyState } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LoadError, Loading } from '../components/Status'
import { CLUB_TIMEZONE, formatMeetingDateWithYear } from '../lib/format'
import { meetingInstant, meetingLocalValues } from '../lib/meetingTime'

const base = '/administracion/reuniones'
const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'
const buttonClass = 'rounded-lg border-2 border-forest px-4 py-2 text-forest hover:bg-sage/40 disabled:opacity-60'
const inputClass = 'w-full min-w-0 rounded-lg border border-wood/60 bg-paper p-2 text-forest'

export function AdminMeetingsPage() {
  const calendar = useApiData((api) => api.listAdminMeetings())
  const { forbid } = useAdminAccess()
  useEffect(() => { if (calendar.status === 'error' && calendar.error instanceof ApiError && calendar.error.status === 403) forbid() }, [calendar, forbid])
  return <div className="grid gap-6 min-w-0">
    <Link to="/administracion" className={linkClass}>Volver a Administración</Link>
    <h1 className="text-3xl text-forest">Reuniones</h1>
    <Link to={`${base}/nueva`} className={linkClass}>Crear reunión</Link>
    {calendar.status === 'loading' && <Loading />}
    {calendar.status === 'error' && <LoadError message="No se han podido cargar las reuniones." onRetry={calendar.reload} />}
    {calendar.status === 'ready' && (['upcoming', 'past'] as const).map((group) => <Card key={group} title={group === 'upcoming' ? 'Próximas reuniones' : 'Reuniones pasadas'}>
      {calendar.data[group].length ? <ul className="grid gap-4">{calendar.data[group].map((meeting) => <li key={meeting.id} className="min-w-0 border-b border-wood/20 pb-3">
        <Link className={linkClass} to={`${base}/${encodeURIComponent(meeting.id)}/editar`}>Editar reunión del {formatMeetingDateWithYear(meeting.startsAt)}</Link>
        <p className="break-words text-bark">{calendar.data.books.find((b) => b.id === meeting.bookId)?.title ?? 'Sin libro'}{meeting.weekId && ` · Semana ${calendar.data.weeks.find((w) => w.id === meeting.weekId)?.weekNumber}`}</p>
        {meeting.cancelled && <p className="font-semibold">Cancelada</p>}
      </li>)}</ul> : <EmptyState>{group === 'upcoming' ? 'No hay próximas reuniones. Puedes crear una cuando quieras.' : 'Todavía no hay reuniones pasadas.'}</EmptyState>}
    </Card>)}
  </div>
}

export function AdminMeetingEditPage() {
  const { meetingId } = useParams()
  return <MeetingEditorLoader key={meetingId ?? 'new'} meetingId={meetingId} />
}

function MeetingEditorLoader({ meetingId }: { meetingId?: string }) {
  const data = useApiData(async (api) => {
    const [calendar, meeting] = await Promise.all([api.listAdminMeetings(), meetingId ? api.getAdminMeeting(meetingId) : Promise.resolve(undefined)])
    return { calendar, meeting }
  })
  const { forbid } = useAdminAccess()
  useEffect(() => { if (data.status === 'error' && data.error instanceof ApiError && data.error.status === 403) forbid() }, [data, forbid])
  if (data.status === 'loading') return <Loading />
  if (data.status === 'error') {
    if (data.error instanceof ApiError && data.error.status === 404) return <section><h1 className="text-3xl">No encontramos esta reunión</h1><Link to={base} className={linkClass}>Volver a Reuniones</Link></section>
    return <LoadError message="No se ha podido cargar el calendario." onRetry={data.reload} />
  }
  return <MeetingEditor key={data.data.meeting ? JSON.stringify(data.data.meeting) : 'new'} calendar={data.data.calendar} meeting={data.data.meeting} reload={data.reload} />
}

function MeetingEditor({ calendar, meeting, reload }: { calendar: AdminMeetingCalendar; meeting?: AdminMeeting; reload: () => void }) {
  const api = useApi(), navigate = useNavigate(), { forbid } = useAdminAccess()
  const prefix = useId()
  const [local, setLocal] = useState(() => meeting ? meetingLocalValues(meeting.startsAt) : { date: '', time: '' })
  const [bookId, setBookId] = useState(meeting?.bookId ?? '')
  const [weekId, setWeekId] = useState(meeting?.weekId ?? '')
  const [selected, setSelected] = useState(() => (meeting?.attendance ?? []).filter((m) => calendar.activeMembers.some((a) => a.id === m.id)).map((m) => m.id))
  const historical = (meeting?.attendance ?? []).filter((m) => !calendar.activeMembers.some((a) => a.id === m.id))
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [dialog, setDialog] = useState(false)
  const running = useRef(false), cancelButton = useRef<HTMLButtonElement>(null), firstField = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => { firstField.current?.focus() }, [])
  const fail = (reason: unknown) => { if (reason instanceof ApiError && reason.status === 403) forbid(); else setError(reason instanceof Error ? reason.message : 'No se han podido guardar los cambios. Reintenta cuando quieras.') }
  const run = async (action: () => Promise<unknown>) => {
    if (running.current) return
    running.current = true; setBusy(true); setError('')
    try { await action() } catch (reason) { fail(reason) } finally { running.current = false; setBusy(false) }
  }
  const save = (event: FormEvent) => {
    event.preventDefault()
    let startsAt: string
    try { startsAt = meetingInstant(local.date, local.time) } catch (reason) { fail(reason); firstField.current?.focus(); return }
    // Preserve seconds/offset spelling on an unchanged local date/time edit.
    if (meeting && JSON.stringify(local) === JSON.stringify(meetingLocalValues(meeting.startsAt))) startsAt = meeting.startsAt
    void run(async () => {
      const input = { startsAt, bookId: bookId || null, weekId: weekId || null }
      const saved = meeting ? await api.updateMeeting(meeting.id, input) : await api.createMeeting(input)
      if (meeting) reload(); else navigate(`${base}/${encodeURIComponent(saved.id)}/editar`)
    })
  }
  const closeDialog = () => { setDialog(false); setError(''); cancelButton.current?.focus() }
  return <div className="grid min-w-0 gap-6">
    <Link to={base} className={linkClass}>Volver a Reuniones</Link>
    <h1 className="text-3xl">{meeting ? 'Editar reunión' : 'Crear reunión'}</h1>
    {meeting?.cancelled && <p className="font-semibold">Cancelada</p>}
    <Card title="Fecha y lectura">
      <p className="mb-4 break-words text-bark">Zona horaria del club: {CLUB_TIMEZONE}</p>
      <form onSubmit={save} noValidate className="grid min-w-0 gap-4">
        <fieldset disabled={busy} className="grid min-w-0 gap-4">
          <label htmlFor={`${prefix}-date`}>Fecha<input ref={firstField} id={`${prefix}-date`} className={inputClass} type="date" value={local.date} onChange={(e) => setLocal({ ...local, date: e.target.value })} /></label>
          <label htmlFor={`${prefix}-time`}>Hora<input id={`${prefix}-time`} className={inputClass} type="time" value={local.time} onChange={(e) => setLocal({ ...local, time: e.target.value })} /></label>
          <label htmlFor={`${prefix}-book`}>Libro<select id={`${prefix}-book`} className={inputClass} value={bookId} onChange={(e) => { setBookId(e.target.value); setWeekId('') }}><option value="">Sin libro</option>{calendar.books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
          <label htmlFor={`${prefix}-week`}>Semana de lectura<select id={`${prefix}-week`} className={inputClass} disabled={!bookId} value={weekId} onChange={(e) => setWeekId(e.target.value)}><option value="">Sin semana</option>{calendar.weeks.filter((w) => w.bookId === bookId).map((w) => <option key={w.id} value={w.id}>Semana {w.weekNumber}{w.meetingId && w.meetingId !== meeting?.id ? ' (vinculada a otra reunión)' : ''}</option>)}</select></label>
        </fieldset>
        <button className={buttonClass} disabled={busy}>Guardar reunión</button>
      </form>
    </Card>
    {meeting && <>
      <Card title="Estado"><button ref={cancelButton} disabled={busy} className={buttonClass} onClick={() => {
        if (meeting.cancelled) void run(async () => { await api.setMeetingCancelled(meeting.id, false); reload() })
        else { setError(''); setDialog(true) }
      }}>{meeting.cancelled ? 'Restaurar reunión' : 'Cancelar reunión'}</button></Card>
      <Card title="Asistencia">
        <p className="mb-3 text-bark">{meeting.attendance === null ? 'Asistencia sin registrar' : `${meeting.attendance.length} asistentes registrados`}</p>
        {historical.length > 0 && <div className="mb-3"><h3 className="font-semibold">Historial de miembros sin acceso (solo lectura)</h3><ul>{historical.map((m) => <li key={m.id}>{m.displayName}</li>)}</ul></div>}
        {meeting.attendanceEligible ? <form onSubmit={(event) => { event.preventDefault(); void run(async () => { await api.setMeetingAttendance(meeting.id, selected); reload() }) }} className="grid gap-3">
          <fieldset disabled={busy} className="grid gap-2"><legend className="mb-2">Miembros con acceso</legend>{calendar.activeMembers.map((m) => <label key={m.id} className="flex items-center gap-2 break-words"><input type="checkbox" checked={selected.includes(m.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, m.id] : selected.filter((id) => id !== m.id))} />{m.displayName}</label>)}</fieldset>
          <button className={buttonClass} disabled={busy}>Guardar asistencia</button>
        </form> : <p>{meeting.cancelled ? 'No se puede editar la asistencia de una reunión cancelada.' : 'La asistencia se puede registrar después del inicio de la reunión.'}</p>}
      </Card>
    </>}
    {error && !dialog && <p role="alert" className="text-bark">{error}</p>}
    {dialog && meeting && <ConfirmDialog title="¿Cancelar esta reunión?" confirmLabel="Confirmar cancelación" busy={busy} error={error || null} onCancel={closeDialog} onConfirm={() => void run(async () => { await api.setMeetingCancelled(meeting.id, true); setDialog(false); reload() })}><p>Se conservarán la lectura, la asistencia y los registros. Puedes restaurarla después.</p></ConfirmDialog>}
  </div>
}
