import { useId, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useApi } from '../api/hooks'
import type { AdminBook, BookInput, BookMetadataResult } from '../api/types'
import { useAdminAccess } from '../admin/context'
import { blankBookInput, bookErrors, CATALOGUE_LIMITS, type BookErrors } from '../lib/catalogue'
import { BOOK_STATUSES, BOOK_STATUS_LABELS } from '../lib/library'
import { AVATAR_ACCEPT, avatarProblem, readAsDataUrl } from '../lib/profile'
import { BookCover } from './BookCover'
import { Card } from './Card'

const buttonClass = 'rounded-lg border border-forest px-4 py-2 text-forest hover:bg-sage/40 disabled:opacity-60'
const inputClass = 'w-full min-w-0 rounded-lg border border-wood/60 bg-paper p-2 text-forest aria-[invalid=true]:border-2 aria-[invalid=true]:border-bark'
const TEXT_FIELDS = [
  ['title', 'Título'], ['authors', 'Autores (uno por línea)'], ['description', 'Descripción'],
  ['publicationDate', 'Fecha de publicación'], ['publisher', 'Editorial'], ['isbn', 'ISBN'], ['pageCount', 'Número de páginas'],
  ['plannedStartDate', 'Inicio previsto'], ['plannedEndDate', 'Fin previsto'],
  ['readingStartDate', 'Inicio real'], ['readingEndDate', 'Fin real'],
] as const
type TextField = typeof TEXT_FIELDS[number][0]
type TextValues = Record<TextField, string>
const toText = (book?: AdminBook): TextValues => Object.fromEntries(TEXT_FIELDS.map(([field]) => [field, field === 'authors' ? book?.authors.join('\n') ?? '' : String(book?.[field] ?? '')])) as TextValues

// Selecting a source only fills blanks, never saves, and never changes dates/status.
export function BookForm({ book }: { book?: AdminBook }) {
  const api = useApi(), navigate = useNavigate(), { forbid } = useAdminAccess()
  const prefix = useId()
  const [values, setValues] = useState(() => toText(book))
  const [status, setStatus] = useState(book?.status ?? 'propuesto')
  const [approximate, setApproximate] = useState(book?.datesApproximate ?? false)
  const [cover, setCover] = useState<BookInput['cover']>({ action: 'keep' })
  const [preview, setPreview] = useState(book?.coverUrl ?? null)
  const [errors, setErrors] = useState<BookErrors>({})
  const [coverError, setCoverError] = useState('')
  const [readingFile, setReadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [query, setQuery] = useState('')
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<BookMetadataResult[] | null>(null)
  const [imported, setImported] = useState('')
  const running = useRef(false), searchRunning = useRef(false), fileChoice = useRef(0), filePending = useRef(false)
  const focusNext = useRef<string | null>(null)
  useLayoutEffect(() => { if (focusNext.current) { document.getElementById(focusNext.current)?.focus(); focusNext.current = null } })
  const fieldId = (field: string) => `${prefix}-${field}`
  const edit = (field: TextField, value: string) => {
    setValues((old) => ({ ...old, [field]: value }))
    setErrors((old) => ({ ...old, [field]: undefined }))
  }

  const search = async (event: FormEvent) => {
    event.preventDefault()
    if (searchRunning.current) return
    if (!query.trim() || query.trim().length > CATALOGUE_LIMITS.query) { setSearchError('Escribe un título o autor de hasta 200 caracteres.'); focusNext.current = fieldId('query'); return }
    searchRunning.current = true; setSearching(true); setSearchError(''); setResults(null)
    try { setResults(await api.searchBookMetadata(query)) }
    catch (error) {
      if (error instanceof ApiError && error.status === 403) forbid()
      else setSearchError('No se han podido buscar metadatos. Puedes reintentar o añadir el libro a mano.')
    } finally { searchRunning.current = false; setSearching(false) }
  }
  const selectMetadata = (result: BookMetadataResult) => {
    setValues((old) => {
      const next = { ...old }
      for (const field of ['title', 'authors', 'description', 'publicationDate', 'publisher', 'isbn', 'pageCount'] as const) {
        if (old[field].trim()) continue
        next[field] = field === 'authors' ? result.authors.join('\n') : String(result[field] ?? '')
      }
      return next
    })
    // Explicit remove/upload choices take precedence, even while a file reads.
    if (!preview && (cover.action === 'keep' || cover.action === 'metadata') && !filePending.current) {
      setCover({ action: 'metadata', resultId: result.id }); setPreview(result.coverUrl)
    }
    setImported('Metadatos añadidos a los campos vacíos. Puedes corregirlos antes de guardar.')
  }
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''
    if (!file) return
    setErrors((old) => ({ ...old, cover: undefined }))
    const choice = ++fileChoice.current
    const problem = avatarProblem(file)
    if (problem) {
      filePending.current = false; setReadingFile(false)
      setCoverError(problem === 'type' ? 'La portada debe ser JPEG, PNG o WebP.' : problem === 'empty' ? 'Ese archivo está vacío.' : 'La portada puede ocupar como máximo 2 MB.'); return
    }
    filePending.current = true; setReadingFile(true); setCoverError('')
    try {
      const url = await readAsDataUrl(file)
      if (choice !== fileChoice.current) return
      setCover({ action: 'replace', file }); setPreview(url)
    } catch { if (choice === fileChoice.current) setCoverError('No se ha podido leer la portada. Prueba con otra.') }
    finally { if (choice === fileChoice.current) { filePending.current = false; setReadingFile(false) } }
  }
  const resetCover = (action: 'keep' | 'remove') => {
    ++fileChoice.current; filePending.current = false; setReadingFile(false); setCoverError('')
    setCover({ action }); setPreview(action === 'keep' ? book?.coverUrl ?? null : null)
    setErrors((old) => ({ ...old, cover: undefined }))
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (running.current || filePending.current) return
    const input: BookInput = { ...blankBookInput(), ...values,
      authors: values.authors.split('\n').map((a) => a.trim()).filter(Boolean),
      pageCount: values.pageCount.trim() ? Number(values.pageCount) : null, status, datesApproximate: approximate, cover }
    const found = bookErrors(input)
    if (coverError) found.cover = coverError
    setErrors(found); setSaveError('')
    if (Object.keys(found).length) { focusNext.current = fieldId(Object.keys(found)[0]); return }
    running.current = true; setSaving(true)
    try {
      const saved = book ? await api.updateBook(book.id, input) : await api.createBook(input)
      navigate(`/biblioteca/${encodeURIComponent(saved.id)}`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) forbid()
      else if (error instanceof ApiError && error.status === 409) setSaveError(error.message)
      else if (error instanceof ApiError && error.status === 404) setSaveError('No encontramos este libro. Tus cambios no se han guardado.')
      else if (!(error instanceof ApiError && error.status === 401)) setSaveError(error instanceof ApiError && error.status === 400 ? `Revisa los campos. ${error.message}` : 'No se ha podido guardar el libro. Tus cambios siguen aquí; puedes reintentar.')
    } finally { running.current = false; setSaving(false) }
  }

  return <div className="grid max-w-5xl gap-6">
    <Link to="/administracion/libros" className="text-moss underline underline-offset-4">Volver a Libros</Link>
    <h1 className="text-3xl text-forest sm:text-4xl">{book ? 'Editar libro' : 'Añadir libro'}</h1>
    <Card title="Buscar metadatos">
      <form onSubmit={search} noValidate className="grid gap-3">
        <label htmlFor={fieldId('query')}>Título o autor</label>
        <input id={fieldId('query')} value={query} onChange={(e) => setQuery(e.target.value)} className={inputClass} aria-invalid={!!searchError} aria-describedby={searchError ? fieldId('search-error') : undefined} />
        <div className="flex flex-wrap gap-3"><button disabled={searching || saving} className={buttonClass}>{searching ? 'Buscando…' : 'Buscar metadatos'}</button>
          <button type="button" className={buttonClass} onClick={() => document.getElementById(fieldId('title'))?.focus()}>Añadir a mano</button></div>
        <p className="text-sm text-bark">Búsqueda de ejemplo con libros ficticios; no consulta fuentes externas.</p>
        {searchError && <p id={fieldId('search-error')} role="alert">{searchError}</p>}
        {results?.length === 0 && <p role="status" className="text-bark">No encontramos metadatos. Puedes añadir el libro a mano.</p>}
        {results && results.length > 0 && <ul className="grid gap-3">{results.map((result) => <li key={result.id} className="flex min-w-0 flex-wrap items-center gap-3"><span className="min-w-0 flex-1 break-words">{result.title} · {result.authors.join(', ')}</span><button type="button" disabled={saving} onClick={() => selectMetadata(result)} className={buttonClass}>Usar metadatos de «{result.title}»</button></li>)}</ul>}
        {imported && <p role="status" className="text-bark">{imported}</p>}
      </form>
    </Card>
    <Card title="Datos del libro">
      <form onSubmit={submit} noValidate className="grid gap-5">
        <fieldset disabled={saving} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <legend className="sr-only">Metadatos, portada y fechas</legend>
          {TEXT_FIELDS.map(([field, label]) => <div key={field} className={`min-w-0 ${['title', 'authors', 'description'].includes(field) ? 'sm:col-span-2' : ''}`}>
            <label className="mb-1 block font-semibold" htmlFor={fieldId(field)}>{label}</label>
            {field === 'authors' || field === 'description' ? <textarea id={fieldId(field)} rows={field === 'description' ? 4 : 2} className={inputClass} value={values[field]} onChange={(e) => edit(field, e.target.value)} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? fieldId(`${field}-error`) : undefined} />
              : <input id={fieldId(field)} type="text" inputMode={field === 'pageCount' ? 'numeric' : undefined} placeholder={field.endsWith('Date') && field !== 'publicationDate' ? 'AAAA-MM-DD' : undefined} className={inputClass} value={values[field]} onChange={(e) => edit(field, e.target.value)} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? fieldId(`${field}-error`) : undefined} />}
            {errors[field] && <p id={fieldId(`${field}-error`)} role="alert" className="mt-1 text-sm">{errors[field]}</p>}
          </div>)}
          <div><label htmlFor={fieldId('status')} className="mb-1 block font-semibold">Estado</label><select id={fieldId('status')} value={status} onChange={(e) => setStatus(e.target.value as BookInput['status'])} className={inputClass}>{BOOK_STATUSES.map((s) => <option key={s} value={s}>{s === 'elegido' ? 'Elegido / pendiente' : BOOK_STATUS_LABELS[s]}</option>)}</select></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={approximate} onChange={(e) => setApproximate(e.target.checked)} />Fechas aproximadas</label>
          <div className="grid min-w-0 gap-3 sm:col-span-2">
            <BookCover book={{ id: book?.id ?? 'preview', title: values.title || 'Nuevo libro', authors: values.authors.split('\n').filter(Boolean), coverUrl: preview }} className="w-28" />
            <label htmlFor={fieldId('cover')} className="font-semibold">Subir o reemplazar portada</label>
            <input id={fieldId('cover')} type="file" accept={AVATAR_ACCEPT} onChange={chooseFile} className="min-w-0 max-w-full text-sm" aria-invalid={!!coverError || !!errors.cover} aria-describedby={`${fieldId('cover-help')}${coverError || errors.cover ? ` ${fieldId('cover-error')}` : ''}`} />
            <p id={fieldId('cover-help')} className="text-sm text-bark">JPEG, PNG o WebP, hasta 2 MB. Se aplicará al guardar.</p>
            {(coverError || errors.cover) && <p id={fieldId('cover-error')} role="alert">{coverError || errors.cover}</p>}
            {readingFile && <p role="status">Leyendo portada…</p>}
            <div className="flex flex-wrap gap-3"><button type="button" className={buttonClass} onClick={() => resetCover('remove')}>Quitar portada</button><button type="button" className={buttonClass} onClick={() => resetCover('keep')}>Conservar portada guardada</button></div>
          </div>
        </fieldset>
        {book?.originVote && <p className="text-bark">Votación de origen (solo lectura): <Link className="text-moss underline" to={`/votaciones/${encodeURIComponent(book.originVote.id)}`}>{book.originVote.label}</Link></p>}
        {saveError && <p role="alert">{saveError}</p>}
        <button type="submit" disabled={saving || readingFile} className="justify-self-start rounded-lg bg-forest px-5 py-2 text-parchment disabled:opacity-60">{saving ? 'Guardando…' : saveError ? 'Reintentar guardar' : 'Guardar libro'}</button>
      </form>
    </Card>
  </div>
}
