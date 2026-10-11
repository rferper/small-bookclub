import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AdminOnlyMessage } from '../admin/AdminGuard'
import { useAdminAccess } from '../admin/context'
import { ApiError } from '../api/client'
import { useApi, useApiData } from '../api/hooks'
import type { AdminLiteraryQuote, LiteraryQuoteInput, RatingRubric } from '../api/types'
import { Card } from '../components/Card'
import { LoadError, Loading } from '../components/Status'
import { ANCHORS, normalizeQuote, normalizeRubric } from '../lib/literary'
import { CRITERIA, CRITERION_LABELS } from '../lib/ratings'

const field = 'mt-1 block w-full min-w-0 rounded-md border border-wood bg-paper p-2 text-forest'
const button = 'rounded-md bg-forest px-4 py-2 text-parchment disabled:opacity-50'
const secondary = 'rounded-md border border-forest px-3 py-2 text-forest disabled:opacity-50'

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return <div className="grid min-w-0 gap-6 wrap-anywhere"><div><h1 className="text-3xl text-forest">{title}</h1><Link to="/administracion" className="mt-2 inline-block text-moss underline">Volver a Administración</Link></div>{children}</div>
}

// One shared async transaction state, including immediate double-submit protection.
function useSave() {
  const { forbid } = useAdminAccess()
  const running = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const run = async (call: () => Promise<void>) => {
    if (running.current) return
    running.current = true; setPending(true); setError(''); setSuccess('')
    try { await call(); setSuccess('Cambios guardados.') }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 403) forbid()
      else if (!(failure instanceof ApiError && failure.status === 401)) setError(failure instanceof ApiError && [400, 404, 409].includes(failure.status) ? failure.message : 'No se han guardado los cambios. Conservamos lo que has escrito; vuelve a intentar guardar.')
    } finally { running.current = false; setPending(false) }
  }
  const clear = () => { setError(''); setSuccess('') }
  return { pending, error, success, run, clear, invalid: (message: string) => { setSuccess(''); setError(message) } }
}

export function AdminQuotesPage() {
  const loaded = useApiData((api) => api.listAdminQuotes())
  if (loaded.status === 'error' && loaded.error instanceof ApiError && loaded.error.status === 403) return <AdminOnlyMessage focusOnMount />
  return <Shell title="Citas literarias">
    <p className="max-w-prose text-bark">Prefiere textos de dominio público o fragmentos breves atribuidos. Comprueba la atribución y los derechos antes de guardar.</p>
    {loaded.status === 'loading' && <Loading />}
    {loaded.status === 'error' && <LoadError onRetry={loaded.reload} message="No se han podido cargar las citas." />}
    {loaded.status === 'ready' && <QuotesEditor key={JSON.stringify(loaded.data)} initial={loaded.data} reload={loaded.reload} />}
  </Shell>
}

function QuotesEditor({ initial, reload }: { initial: AdminLiteraryQuote[]; reload: () => void }) {
  const api = useApi()
  const [quotes, setQuotes] = useState(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const blank = (): LiteraryQuoteInput => ({ text: '', author: null, source: null, active: true })
  const [input, setInput] = useState(blank)
  const save = useSave()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const select = (quote?: AdminLiteraryQuote) => { setEditing(quote?.id ?? null); setInput(quote ? { text: quote.text, author: quote.author, source: quote.source, active: quote.active } : blank()); save.clear(); textRef.current?.focus() }
  return <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
    <Card title="Colección" className="min-w-0">
      {!quotes.length && <p className="text-bark">Todavía no hay citas. Añade la primera cuando quieras.</p>}
      <button type="button" className={secondary} disabled={save.pending} onClick={() => select()}>Añadir una cita</button>
      <ul className="mt-4 grid gap-4">{quotes.map((quote) => <li key={quote.id} className="min-w-0 border-b border-wood/30 pb-4">
        <p className="whitespace-pre-wrap">{quote.text}</p>
        {(quote.author || quote.source) && <p className="mt-1 whitespace-pre-wrap text-bark">{[quote.author, quote.source].filter(Boolean).join(', ')}</p>}
        <p className="my-2 text-bark">{quote.active ? 'Activa' : 'Inactiva'}</p>
        <button type="button" className={secondary} disabled={save.pending} aria-label={`Editar cita: ${quote.text}`} onClick={() => select(quote)}>Editar</button>
      </li>)}</ul>
    </Card>
    <Card title={editing ? 'Editar cita' : 'Nueva cita'} className="min-w-0">
      <form noValidate className="grid min-w-0 gap-4" onSubmit={(event) => {
        event.preventDefault()
        const clean = normalizeQuote(input)
        if (!clean) { save.invalid('Revisa el texto (1–1.000 caracteres) y la atribución (hasta 200 caracteres por campo).'); return }
        void save.run(async () => {
          const quote = editing ? await api.updateLiteraryQuote(editing, clean) : await api.addLiteraryQuote(clean)
          setQuotes((current) => editing ? current.map((other) => other.id === editing ? quote : other) : [...current, quote])
          setEditing(quote.id); setInput(quote)
        })
      }}>
        <label>Texto (1–1.000 caracteres)<textarea ref={textRef} className={field} rows={5} value={input.text} aria-describedby={save.error ? 'quote-error' : undefined} onChange={(event) => { save.clear(); setInput({ ...input, text: event.target.value }) }} disabled={save.pending} /></label>
        {(['author', 'source'] as const).map((name) => <label key={name}>{name === 'author' ? 'Autor (opcional, hasta 200 caracteres)' : 'Fuente (opcional, hasta 200 caracteres)'}<textarea className={field} rows={2} value={input[name] ?? ''} aria-describedby={save.error ? 'quote-error' : undefined} onChange={(event) => { save.clear(); setInput({ ...input, [name]: event.target.value }) }} disabled={save.pending} /></label>)}
        <label className="flex items-center gap-2"><input type="checkbox" checked={input.active} onChange={(event) => { save.clear(); setInput({ ...input, active: event.target.checked }) }} disabled={save.pending} />Activa en Inicio</label>
        {save.error && <div><p id="quote-error" role="alert">{save.error}</p><button type="button" className={secondary} onClick={reload}>Volver a cargar la lista</button></div>}
        {save.success && <p role="status">{save.success}</p>}
        <button className={button} disabled={save.pending}>{save.pending ? 'Guardando…' : 'Guardar cita'}</button>
      </form>
    </Card>
  </div>
}

export function AdminRubricPage() {
  const loaded = useApiData((api) => api.getRatingRubric())
  if (loaded.status === 'error' && loaded.error instanceof ApiError && loaded.error.status === 403) return <AdminOnlyMessage focusOnMount />
  return <Shell title="Rúbrica de valoración">
    <p className="max-w-prose text-bark">Define el significado de cada estrella. Puedes dejar las descripciones vacías; cada campo admite hasta 500 caracteres.</p>
    {loaded.status === 'loading' && <Loading />}
    {loaded.status === 'error' && <LoadError onRetry={loaded.reload} message="No se ha podido cargar la rúbrica." />}
    {loaded.status === 'ready' && <RubricEditor initial={loaded.data} />}
  </Shell>
}

function RubricEditor({ initial }: { initial: RatingRubric }) {
  const api = useApi()
  const [input, setInput] = useState(initial)
  const save = useSave()
  return <form noValidate className="grid min-w-0 gap-5" onSubmit={(event) => {
    event.preventDefault()
    const clean = normalizeRubric(input)
    if (!clean) { save.invalid('Revisa las descripciones: cada campo admite hasta 500 caracteres.'); return }
    void save.run(async () => { setInput(await api.saveRatingRubric(clean)) })
  }}>
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">{CRITERIA.map((criterion) => <fieldset key={criterion} className="min-w-0 rounded-xl border border-wood/30 bg-paper p-4"><legend className="px-2 font-serif text-xl">{CRITERION_LABELS[criterion]}</legend><div className="grid min-w-0 gap-4">{ANCHORS.map((star) => <label key={star}>{CRITERION_LABELS[criterion]}: {star} {star === 1 ? 'estrella' : 'estrellas'}<textarea className={field} rows={2} value={input[criterion][star] ?? ''} disabled={save.pending} aria-describedby={save.error ? 'rubric-error' : undefined} onChange={(event) => { save.clear(); setInput({ ...input, [criterion]: { ...input[criterion], [star]: event.target.value } }) }} /></label>)}</div></fieldset>)}</div>
    {save.error && <p id="rubric-error" role="alert">{save.error}</p>}
    {save.success && <p role="status">{save.success}</p>}
    <button className={`${button} justify-self-start`} disabled={save.pending}>{save.pending ? 'Guardando…' : 'Guardar rúbrica completa'}</button>
  </form>
}
