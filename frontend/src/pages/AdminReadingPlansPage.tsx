import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, useApiData } from '../api/hooks'
import type { AdminReadingPlan, AdminReadingWeek, ReadingWeekInput } from '../api/types'
import { useAdminAccess } from '../admin/context'
import { Card, EmptyState } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LoadError, Loading } from '../components/Status'
import { formatMeetingDateWithYear } from '../lib/format'
import { readingErrors, readingWarnings } from '../lib/readingPlan'

const base = '/administracion/lecturas'
const button = 'rounded-lg border-2 border-forest px-3 py-2 text-forest hover:bg-sage/40 disabled:opacity-60'
const field = 'w-full min-w-0 rounded-lg border border-wood/60 bg-paper p-2'
const link = 'text-moss underline underline-offset-4'

export function AdminReadingPlansPage() {
  const { bookId } = useParams()
  return <PlanLoader key={bookId ?? 'choose'} bookId={bookId} />
}

function PlanLoader({ bookId }: { bookId?: string }) {
  const data = useApiData(async (api) => ({ books: await api.listAdminBooks(), plan: bookId ? await api.getAdminReadingPlan(bookId) : null }))
  const { forbid } = useAdminAccess()
  useEffect(() => { if (data.status === 'error' && data.error instanceof ApiError && data.error.status === 403) forbid() }, [data, forbid])
  if (data.status === 'loading') return <Loading />
  if (data.status === 'error') return data.error instanceof ApiError && data.error.status === 404
    ? <section><h1>No encontramos este libro</h1><Link className={link} to={base}>Volver a Planes de lectura</Link></section>
    : <LoadError message="No se han podido cargar los planes de lectura." onRetry={data.reload} />
  return <div className="grid min-w-0 gap-6">
    <Link className={link} to="/administracion">Volver a Administración</Link>
    <h1 className="text-3xl">Planes de lectura</h1>
    <BookSelector books={data.data.books} bookId={bookId} />
    {data.data.plan ? <PlanEditor initial={data.data.plan} /> : <EmptyState>Elige un libro para cuidar su plan de lectura.</EmptyState>}
  </div>
}

function BookSelector({ books, bookId }: { books: { id: string; title: string }[]; bookId?: string }) {
  const navigate = useNavigate()
  return <label>Libro<select className={field} value={bookId ?? ''} onChange={(e) => navigate(e.target.value ? `${base}/${encodeURIComponent(e.target.value)}` : base)}><option value="">Elige un libro</option>{books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
}

type Draft = { id?: string; percentStart: string; percentEnd: string; pageStart: string; pageEnd: string; dueDate: string; notes: string; meetingId: string }
const blank = (): Draft => ({ percentStart: '', percentEnd: '', pageStart: '', pageEnd: '', dueDate: '', notes: '', meetingId: '' })

function PlanEditor({ initial }: { initial: AdminReadingPlan }) {
  const api = useApi(), { forbid } = useAdminAccess()
  const [plan, setPlan] = useState(initial), [draft, setDraft] = useState<Draft | null>(null)
  const [order, setOrder] = useState<string[] | null>(null), [removed, setRemoved] = useState<AdminReadingWeek | null>(null)
  const [ack, setAck] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const running = useRef(false), returnFocus = useRef<HTMLButtonElement | null>(null), formField = useRef<HTMLInputElement>(null)
  useEffect(() => { if (draft) formField.current?.focus() }, [draft?.id, draft !== null])
  const input: ReadingWeekInput | null = draft ? { percentStart: draft.percentStart.trim() ? Number(draft.percentStart) : NaN, percentEnd: draft.percentEnd.trim() ? Number(draft.percentEnd) : NaN, pageStart: draft.pageStart.trim() ? Number(draft.pageStart) : NaN, pageEnd: draft.pageEnd.trim() ? Number(draft.pageEnd) : NaN, dueDate: draft.dueDate || null, notes: draft.notes || null, meetingId: draft.meetingId || null } : null
  const proposed = order ? order.map((id) => plan.weeks.find((w) => w.id === id)!) : input ? draft?.id ? plan.weeks.map((w) => w.id === draft.id ? input : w) : [...plan.weeks, input] : []
  const warnings = readingWarnings(proposed, plan.book.pageCount)
  const change = (key: keyof Draft, value: string) => { setDraft((d) => d ? { ...d, [key]: value } : d); setAck(false); setError('') }
  const close = () => { setDraft(null); setOrder(null); setRemoved(null); setAck(false); setError(''); returnFocus.current?.focus() }
  const run = async (action: () => Promise<AdminReadingPlan>) => {
    if (running.current) return
    running.current = true; setBusy(true); setError('')
    try { const saved = await action(); setPlan(saved); close() }
    catch (reason) { if (reason instanceof ApiError && reason.status === 403) forbid(); else setError(reason instanceof Error ? reason.message : 'No se han podido guardar los cambios. Puedes reintentar.') }
    finally { running.current = false; setBusy(false) }
  }
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!input) return
    const errors = readingErrors(input)
    if (errors.length) { setError(errors.join(' ')); return }
    if (warnings.length && !ack) { setError('Confirma los avisos antes de guardar.'); return }
    void run(() => draft?.id ? api.updateReadingWeek(plan.book.id, draft.id, input, ack) : api.createReadingWeek(plan.book.id, input, ack))
  }
  const start = (event: React.MouseEvent<HTMLButtonElement>, week?: AdminReadingWeek) => {
    returnFocus.current = event.currentTarget; setError(''); setAck(false); setOrder(null)
    setDraft(week ? { id: week.id, percentStart: String(week.percentStart), percentEnd: String(week.percentEnd), pageStart: String(week.pageStart), pageEnd: String(week.pageEnd), dueDate: week.dueDate ?? '', notes: week.notes ?? '', meetingId: week.meetingId ?? '' } : blank())
  }
  const move = (event: React.MouseEvent<HTMLButtonElement>, index: number, delta: number) => {
    returnFocus.current = event.currentTarget
    const ids = plan.weeks.map((w) => w.id); [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    setDraft(null); setAck(false); setError('')
    if (readingWarnings(ids.map((id) => plan.weeks.find((w) => w.id === id)!), plan.book.pageCount).length) setOrder(ids)
    else void run(() => api.reorderReadingWeeks(plan.book.id, ids, false))
  }
  return <div className="grid min-w-0 gap-6">
    <Card title={plan.book.title}>
      <button className={button} disabled={busy || draft !== null || order !== null} onClick={(e) => start(e)}>Añadir semana</button>
      {!plan.weeks.length && <EmptyState>Este libro aún no tiene un plan de lectura. Puedes añadir su primera semana.</EmptyState>}
      <ol className="mt-4 grid gap-4">{plan.weeks.map((w, i) => <li key={w.id} className="min-w-0 border-b border-wood/30 pb-4">
        <h3 className="font-semibold">Semana {w.weekNumber}</h3>
        <p>{w.percentStart}–{w.percentEnd} % · páginas {w.pageStart}–{w.pageEnd}</p>
        <p className="break-words text-bark">{w.dueDate ? `Entrega guardada: ${w.dueDate}` : 'Sin fecha de entrega'} · {w.completionCount} marcas de lectura</p>
        {w.notes && <p className="whitespace-pre-line break-words">{w.notes}</p>}
        {w.meetingId && <p>{formatMeetingDateWithYear(plan.meetings.find((m) => m.id === w.meetingId)!.startsAt)}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={button} disabled={busy || draft !== null || order !== null} onClick={(e) => start(e, w)}>Editar semana {w.weekNumber}</button>
          <button className={button} disabled={busy || draft !== null || order !== null || i === 0} onClick={(e) => move(e, i, -1)}>Subir semana {w.weekNumber}</button>
          <button className={button} disabled={busy || draft !== null || order !== null || i === plan.weeks.length - 1} onClick={(e) => move(e, i, 1)}>Bajar semana {w.weekNumber}</button>
          <button className={button} disabled={busy || draft !== null || order !== null} onClick={(e) => { returnFocus.current = e.currentTarget; setError(''); setRemoved(w) }}>Retirar semana {w.weekNumber}</button>
        </div>
      </li>)}</ol>
    </Card>
    {draft && <Card title={draft.id ? 'Editar semana' : 'Añadir semana'}><form noValidate onSubmit={save} className="grid min-w-0 gap-4"><fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      {([['percentStart', 'Porcentaje inicial'], ['percentEnd', 'Porcentaje final'], ['pageStart', 'Página inicial'], ['pageEnd', 'Página final']] as const).map(([key, label], i) => <label key={key}>{label}<input ref={i === 0 ? formField : undefined} className={field} type="number" step={key.startsWith('percent') ? 'any' : '1'} value={draft[key]} onChange={(e) => change(key, e.target.value)} /></label>)}
      <label>Fecha de entrega (opcional)<input className={field} type="date" value={draft.dueDate} onChange={(e) => change('dueDate', e.target.value)} /></label>
      <label>Reunión (opcional)<select className={field} value={draft.meetingId} onChange={(e) => change('meetingId', e.target.value)}><option value="">Sin reunión</option>{plan.meetings.map((m) => <option key={m.id} value={m.id}>{formatMeetingDateWithYear(m.startsAt)}{m.cancelled ? ' (cancelada)' : ''}</option>)}</select></label>
      <label className="sm:col-span-2">Nota (opcional, máximo 1000 caracteres)<textarea className={field} rows={5} value={draft.notes} onChange={(e) => change('notes', e.target.value)} /></label>
    </fieldset><Warnings warnings={warnings} ack={ack} setAck={setAck} busy={busy} /><div className="flex flex-wrap gap-2"><button className={button} disabled={busy}>Guardar semana</button><button type="button" className={button} disabled={busy} onClick={close}>Cancelar edición</button></div></form></Card>}
    {order && <Card title="Confirmar nuevo orden"><p>Orden propuesto: {order.map((id) => `Semana ${plan.weeks.find((w) => w.id === id)!.weekNumber}`).join(', ')}</p><Warnings warnings={warnings} ack={ack} setAck={setAck} busy={busy} /><div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={busy || !ack} onClick={() => void run(() => api.reorderReadingWeeks(plan.book.id, order, ack))}>Guardar orden</button><button className={button} disabled={busy} onClick={close}>Cancelar orden</button></div></Card>}
    {error && !removed && <p role="alert" className="text-bark">{error}</p>}
    {removed && <ConfirmDialog title={`¿Retirar la semana ${removed.weekNumber} de ${plan.book.title}?`} confirmLabel="Confirmar retirada" busy={busy} error={error || null} onCancel={close} onConfirm={() => void run(() => api.removeReadingWeek(plan.book.id, removed.id))}><p>{removed.completionCount} marcas de lectura de miembros distintos desaparecerán del plan activo, pero se conservarán para recuperarlas durante 30 días.</p><p>Si hay una reunión vinculada, su registro de lectura quedará bloqueado.</p></ConfirmDialog>}
  </div>
}

function Warnings({ warnings, ack, setAck, busy }: { warnings: string[]; ack: boolean; setAck: (value: boolean) => void; busy: boolean }) {
  if (!warnings.length) return null
  return <section className="min-w-0 rounded-lg border border-wood/50 p-3"><h3 className="font-semibold">Avisos del plan</h3><ul className="list-inside list-disc break-words">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><label className="mt-3 flex items-start gap-2"><input type="checkbox" disabled={busy} checked={ack} onChange={(e) => setAck(e.target.checked)} />He revisado estos avisos y quiero conservar los valores indicados.</label></section>
}
