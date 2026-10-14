import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useApi, useApiData } from '../api/hooks'
import type { AdminMeetingRecord, MeetingHighlightInput } from '../api/types'
import { useAdminAccess } from '../admin/context'
import { Card, EmptyState } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Loading, LoadError } from '../components/Status'
import { formatMeetingDateWithYear } from '../lib/format'

const button = 'rounded-lg border-2 border-forest px-4 py-2 text-forest hover:bg-sage/40 disabled:opacity-60'
const input = 'w-full min-w-0 rounded-lg border border-bark bg-paper p-2 text-forest'
const link = 'text-moss underline underline-offset-4'
const blank: MeetingHighlightInput = { text: '', kind: 'quote', speakerIds: [], published: false }

export function AdminMeetingRecordPage() {
  const { meetingId = '' } = useParams()
  return <Loader key={meetingId} id={meetingId} />
}
function Loader({ id }: { id: string }) {
  const data = useApiData((api) => api.getAdminMeetingRecord(id)), { forbid } = useAdminAccess()
  useEffect(() => { if (data.status === 'error' && data.error instanceof ApiError && data.error.status === 403) forbid() }, [data, forbid])
  if (data.status === 'loading') return <Loading />
  if (data.status === 'error') {
    if (data.error instanceof ApiError && data.error.status === 404) return <section><h1 className="text-3xl">No encontramos esta reunión</h1><Link to="/administracion/reuniones" className={link}>Volver a Reuniones</Link></section>
    return <LoadError message="No se ha podido cargar el resumen." onRetry={data.reload} />
  }
  return <Editor initial={data.data} />
}
function Editor({ initial }: { initial: AdminMeetingRecord }) {
  const api = useApi(), { forbid } = useAdminAccess(), prefix = useId()
  const [record, setRecord] = useState(initial)
  const [text, setText] = useState(initial.summary?.text ?? ''), [published, setPublished] = useState(initial.summary?.published ?? false)
  const [highlight, setHighlight] = useState<MeetingHighlightInput>({ ...blank, speakerIds: [] }), [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('')
  const [dialog, setDialog] = useState<{ kind: 'safe' } | { kind: 'remove'; id: string; text: string } | null>(null)
  const running = useRef(false), returnFocus = useRef<HTMLElement | null>(null), focusAfter = useRef<string | null>(null)
  const first = useRef<HTMLTextAreaElement>(null), moved = useRef(new Map<string, HTMLButtonElement>())
  useLayoutEffect(() => { if (!busy && focusAfter.current) { if (focusAfter.current === 'field') first.current?.focus(); else moved.current.get(focusAfter.current)?.focus(); focusAfter.current = null } }, [record, busy])
  const run = async (action: () => Promise<AdminMeetingRecord>, after?: (saved: AdminMeetingRecord) => void) => {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setStatus('')
    try { const saved = await action(); setRecord(saved); after?.(saved); setStatus('Cambios guardados.') }
    catch (reason) { if (reason instanceof ApiError && reason.status === 403) forbid(); else setError(reason instanceof Error ? reason.message : 'No se han podido guardar los cambios. Reintenta cuando quieras.') }
    finally { running.current = false; setBusy(false) }
  }
  const open = (next: NonNullable<typeof dialog>, target: HTMLElement) => { returnFocus.current = target; setError(''); setDialog(next) }
  const close = () => { setDialog(null); setError(''); returnFocus.current?.focus() }
  const reorder = (id: string, offset: number) => {
    const ids = record.highlights.map((h) => h.id), index = ids.indexOf(id)
    ;[ids[index], ids[index + offset]] = [ids[index + offset], ids[index]]
    void run(() => api.reorderMeetingHighlights(record.id, ids), () => { focusAfter.current = id })
  }
  const saveHighlight = (event: FormEvent) => {
    event.preventDefault()
    void run(() => editing ? api.updateMeetingHighlight(record.id, editing, highlight) : api.createMeetingHighlight(record.id, highlight), () => {
      setHighlight({ ...blank, speakerIds: [] }); setEditing(null); focusAfter.current = 'field'
    })
  }
  const historical = editing ? record.highlights.find((h) => h.id === editing)?.speakers.filter((s) => !record.speakerOptions.some((a) => a.id === s.id)) ?? [] : []
  return <div className="grid grid-cols-1 min-w-0 gap-6">
    <Link className={link} to="/administracion/reuniones">Volver a Reuniones</Link>
    <h1 className="text-3xl break-words">Resumen de la reunión del {formatMeetingDateWithYear(record.startsAt)}</h1>
    <p className="break-words">{record.book?.title ?? 'Sin libro'} · {record.week ? `Semana ${record.week.weekNumber}` : 'Sin semana vinculada'}</p>
    {record.week?.removed && <p className="text-bark">Semana retirada: el registro permanece oculto al club hasta recuperar o cambiar el vínculo.</p>}
    {record.cancelled && <p>Reunión cancelada: los textos se conservan y permanecen ocultos al club.</p>}
    <p className="text-bark">La vista previa incluye borradores. El club solo verá cada texto publicado cuando su lectura lo permita.</p>
    <Card title="Resumen">
      <form noValidate onSubmit={(event) => { event.preventDefault(); void run(() => api.saveMeetingSummary(record.id, { text, published }), (saved) => { setText(saved.summary?.text ?? ''); setPublished(saved.summary?.published ?? false) }) }} className="grid gap-3 min-w-0">
        <fieldset disabled={busy} className="grid gap-3 min-w-0">
          <label htmlFor={`${prefix}-summary`}>Texto del resumen<textarea id={`${prefix}-summary`} className={input} rows={7} value={text} onChange={(e) => setText(e.target.value)} /></label>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />Resumen publicado</label>
        </fieldset>
        <button className={button} disabled={busy}>Guardar resumen</button>
      </form>
      <h3 className="mt-4 font-semibold">Vista previa del resumen guardado</h3>
      {record.summary ? <><p className="text-bark">{record.summary.published ? 'Publicado' : 'Borrador'}</p><p className="whitespace-pre-wrap break-words">{record.summary.text}</p></> : <EmptyState>Todavía no hay resumen.</EmptyState>}
    </Card>
    <Card title="Momentos destacados">
      {record.highlights.length ? <ol className="grid gap-4">{record.highlights.map((h, index) => <li key={h.id} className="min-w-0 border-b border-wood/30 pb-4">
        <h3 className="font-semibold">Momento {index + 1} · {h.kind === 'quote' ? 'Cita' : 'Paráfrasis'} · {h.published ? 'Publicado' : 'Borrador'}</h3>
        <p className="whitespace-pre-wrap break-words">{h.text}</p>
        {h.speakers.length > 0 && <p className="break-words text-bark">{h.speakers.map((s) => s.displayName).join(', ')}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button ref={(element) => { if (element) moved.current.set(h.id, element); else moved.current.delete(h.id) }} className={button} disabled={busy} onClick={() => { setEditing(h.id); setHighlight({ text: h.text, kind: h.kind, speakerIds: [...h.speakerIds], published: h.published }); first.current?.focus() }}>Editar momento {index + 1}</button>
          <button className={button} disabled={busy || index === 0} onClick={() => reorder(h.id, -1)}>Subir momento {index + 1}</button>
          <button className={button} disabled={busy || index === record.highlights.length - 1} onClick={() => reorder(h.id, 1)}>Bajar momento {index + 1}</button>
          <button className={button} disabled={busy} onClick={(e) => open({ kind: 'remove', id: h.id, text: h.text }, e.currentTarget)}>Quitar momento {index + 1}</button>
        </div>
      </li>)}</ol> : <EmptyState>Todavía no hay momentos destacados.</EmptyState>}
    </Card>
    <Card title={editing ? 'Editar momento destacado' : 'Añadir momento destacado'}>
      <form noValidate onSubmit={saveHighlight} className="grid min-w-0 gap-3">
        <fieldset disabled={busy} className="grid min-w-0 gap-3">
          <label htmlFor={`${prefix}-highlight`}>Texto del momento<textarea ref={first} id={`${prefix}-highlight`} className={input} rows={5} value={highlight.text} onChange={(e) => setHighlight({ ...highlight, text: e.target.value })} /></label>
          <label htmlFor={`${prefix}-kind`}>Tipo<select id={`${prefix}-kind`} className={input} value={highlight.kind} onChange={(e) => setHighlight({ ...highlight, kind: e.target.value as MeetingHighlightInput['kind'] })}><option value="quote">Cita</option><option value="paraphrase">Paráfrasis</option></select></label>
          <fieldset className="grid gap-2"><legend>Miembros que hablan</legend>{[...record.speakerOptions, ...historical].map((m) => <label key={m.id} className="flex gap-2 items-center break-words"><input type="checkbox" checked={highlight.speakerIds.includes(m.id)} onChange={(e) => setHighlight({ ...highlight, speakerIds: e.target.checked ? [...highlight.speakerIds, m.id] : highlight.speakerIds.filter((id) => id !== m.id) })} />{m.displayName}{historical.some((s) => s.id === m.id) ? ' (atribución histórica, sin acceso)' : ''}</label>)}</fieldset>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={highlight.published} onChange={(e) => setHighlight({ ...highlight, published: e.target.checked })} />Momento publicado</label>
        </fieldset>
        <button className={button} disabled={busy}>Guardar momento</button>
        {editing && <button type="button" className={button} disabled={busy} onClick={() => { setEditing(null); setHighlight({ ...blank, speakerIds: [] }) }}>Cancelar edición</button>}
      </form>
      <h3 className="mt-4 font-semibold">Vista previa del texto</h3><p className="whitespace-pre-wrap break-words">{highlight.text}</p>
    </Card>
    {!record.week && <Card title="Visibilidad sin semana"><p className="mb-3">{record.markedSafe ? 'Marcada como segura para todos los miembros con acceso.' : 'Oculta hasta marcarla como segura.'}</p><button className={button} disabled={busy} onClick={(e) => record.markedSafe ? void run(() => api.setMeetingRecordSafe(record.id, false)) : open({ kind: 'safe' }, e.currentTarget)}>{record.markedSafe ? 'Deshacer visibilidad segura' : 'Marcar como segura'}</button></Card>}
    {status && <p role="status">{status}</p>}{error && !dialog && <p role="alert" className="text-bark">{error}</p>}
    {dialog && <ConfirmDialog title={dialog.kind === 'safe' ? '¿Marcar esta reunión como segura?' : '¿Quitar este momento destacado?'} confirmLabel={dialog.kind === 'safe' ? 'Confirmar visibilidad segura' : 'Confirmar retirada'} busy={busy} error={error || null} onCancel={close} onConfirm={() => void run(() => dialog.kind === 'safe' ? api.setMeetingRecordSafe(record.id, true) : api.removeMeetingHighlight(record.id, dialog.id), () => { setDialog(null); if (dialog.kind === 'remove') { if (editing === dialog.id) { setEditing(null); setHighlight({ ...blank, speakerIds: [] }) } focusAfter.current = 'field' } else returnFocus.current?.focus() })}>
      {dialog.kind === 'safe' ? <p>Todos los miembros con acceso podrán leer los textos publicados, sin completar una semana. Los borradores seguirán ocultos.</p> : <><p className="whitespace-pre-wrap break-words">{dialog.text}</p><p>Se conservará durante 30 días para poder recuperarlo desde la papelera.</p></>}
    </ConfirmDialog>}
  </div>
}
