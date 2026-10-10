import { useId, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type Ref } from 'react'
import { ApiError } from '../api/client'
import { useApi } from '../api/hooks'
import type { AvatarChange, BookSummary, MyProfile } from '../api/types'
import {
  AVATAR_ACCEPT,
  avatarProblem,
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  displayNameProblem,
  isTooLong,
  QUOTE_MAX_LENGTH,
  readAsDataUrl,
  type AvatarProblem,
  type DisplayNameProblem,
} from '../lib/profile'
import { Avatar } from './Avatar'
import { FavouriteBooksField } from './FavouriteBooksField'

const smallButton = 'rounded-md border border-forest px-3 py-1.5 text-forest hover:bg-sage/50'
const inputClass = 'w-full min-w-0 rounded-lg border border-wood/60 bg-paper p-2 text-forest aria-[invalid=true]:border-2 aria-[invalid=true]:border-bark'

const NAME_MESSAGES: Record<DisplayNameProblem, string> = {
  empty: 'Escribe un nombre.',
  tooLong: `El nombre puede tener como máximo ${DISPLAY_NAME_MAX_LENGTH} caracteres.`,
  notOneLine: 'Escribe el nombre en una sola línea.',
}

const AVATAR_MESSAGES: Record<AvatarProblem, string> = {
  type: 'La foto debe ser JPEG, PNG o WebP.',
  empty: 'Ese archivo está vacío. Elige otra foto.',
  tooLarge: 'La foto puede ocupar como máximo 2 MB.',
}

type TextField = 'displayName' | 'bio' | 'favouriteQuote'
const TEXT_FIELDS: readonly TextField[] = ['displayName', 'bio', 'favouriteQuote']

// The avatar change waiting for «Guardar cambios»: nothing is sent before.
type PendingAvatar = { kind: 'keep' } | { kind: 'remove' } | { kind: 'replace'; file: File; previewUrl: string }

type SaveError = 'invalid' | 'failed'

// The «Tu perfil» form on Mi perfil (#94). Everything is saved at once with
// one atomic call; the server checks every rule again.
export function ProfileForm({ profile }: { profile: MyProfile }) {
  const api = useApi()
  // The profile as last saved: the avatar shown and the options come from it.
  const [saved, setSaved] = useState(profile)
  const [displayName, setDisplayName] = useState(profile.member.displayName)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [quote, setQuote] = useState(profile.favouriteQuote ?? '')
  const [favourites, setFavourites] = useState<BookSummary[]>(profile.favouriteBooks)
  const [avatar, setAvatar] = useState<PendingAvatar>({ kind: 'keep' })
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<TextField, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<SaveError | null>(null)
  const [savedStatus, setSavedStatus] = useState('')
  // Only the latest file choice may set the preview.
  const fileChoice = useRef(0)

  const fields = useRef<Partial<Record<TextField | 'file', HTMLInputElement | HTMLTextAreaElement | null>>>({})
  const focusNext = useRef<(() => HTMLElement | null | undefined) | null>(null)
  useLayoutEffect(() => {
    const find = focusNext.current
    if (!find) return
    focusNext.current = null
    find()?.focus()
  })

  const edit = (field: TextField, value: string) => {
    if (field === 'displayName') setDisplayName(value)
    else if (field === 'bio') setBio(value)
    else setQuote(value)
    // Editing a field clears its error.
    setErrors((current) => {
      const rest = { ...current }
      delete rest[field]
      return rest
    })
  }

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    // So the same file can be chosen again later.
    input.value = ''
    if (!file) return
    const choice = ++fileChoice.current
    const problem = avatarProblem(file)
    if (problem) {
      // The choice is dropped; the previous preview stays and nothing is sent.
      setAvatarError(AVATAR_MESSAGES[problem])
      return
    }
    try {
      const previewUrl = await readAsDataUrl(file)
      if (choice !== fileChoice.current) return
      setAvatarError(null)
      setAvatar({ kind: 'replace', file, previewUrl })
    } catch {
      if (choice === fileChoice.current) setAvatarError('No se ha podido leer la foto. Prueba con otra.')
    }
  }

  const removePhoto = () => {
    fileChoice.current++
    setAvatarError(null)
    setAvatar({ kind: 'remove' })
    focusNext.current = () => document.getElementById(keepId)
  }

  const keepPhoto = () => {
    fileChoice.current++
    setAvatarError(null)
    setAvatar({ kind: 'keep' })
    focusNext.current = () => fields.current.file
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSavedStatus('')
    const found: Partial<Record<TextField, string>> = {}
    const nameProblem = displayNameProblem(displayName)
    if (nameProblem) found.displayName = NAME_MESSAGES[nameProblem]
    if (isTooLong(bio, BIO_MAX_LENGTH)) found.bio = `Este texto puede tener como máximo ${BIO_MAX_LENGTH} caracteres.`
    if (isTooLong(quote, QUOTE_MAX_LENGTH)) found.favouriteQuote = `La cita puede tener como máximo ${QUOTE_MAX_LENGTH} caracteres.`
    setErrors(found)
    const firstInvalid = TEXT_FIELDS.find((field) => found[field])
    if (firstInvalid) {
      setSaveError(null)
      focusNext.current = () => fields.current[firstInvalid]
      return
    }

    const change: AvatarChange =
      avatar.kind === 'replace' ? { action: 'replace', file: avatar.file } : { action: avatar.kind }
    setSaving(true)
    setSaveError(null)
    try {
      const result = await api.updateMyProfile({
        displayName,
        bio,
        favouriteQuote: quote,
        favouriteBookIds: favourites.map((b) => b.id),
        avatar: change,
      })
      // Show what the server saved (trimmed, blank as empty).
      fileChoice.current++
      setSaved(result)
      setDisplayName(result.member.displayName)
      setBio(result.bio ?? '')
      setQuote(result.favouriteQuote ?? '')
      setFavourites(result.favouriteBooks)
      setAvatar({ kind: 'keep' })
      setAvatarError(null)
      setSavedStatus('Tu perfil se ha guardado.')
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null
      // A 401 already sends the visitor to the sign-in screen. Otherwise every
      // entered value stays as it is, the pending photo included.
      if (status !== 401) setSaveError(status === 400 ? 'invalid' : 'failed')
    } finally {
      setSaving(false)
    }
  }

  const ids = {
    displayName: useId(),
    bio: useId(),
    favouriteQuote: useId(),
  }
  const fileId = useId()
  const fileHintId = useId()
  const fileErrorId = useId()
  const keepId = useId()
  const hasImage = avatar.kind === 'replace' || (avatar.kind === 'keep' && saved.member.avatarUrl !== null)

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid min-w-0 gap-6">
      <TextInput
        id={ids.displayName}
        label="Nombre visible"
        hint={`Entre 1 y ${DISPLAY_NAME_MAX_LENGTH} caracteres. Es el nombre que verá el club.`}
        error={errors.displayName}
        inputRef={(el) => {
          fields.current.displayName = el
        }}
      >
        {(props) => (
          <input
            {...props}
            type="text"
            required
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            autoComplete="nickname"
            value={displayName}
            onChange={(event) => edit('displayName', event.target.value)}
            className={`${inputClass} max-w-md`}
          />
        )}
      </TextInput>

      <div className="grid min-w-0 gap-3">
        <p className="font-semibold text-forest">Foto</p>
        <div className="flex min-w-0 flex-wrap items-start gap-4">
          <span className="shrink-0">
            {avatar.kind === 'replace' ? (
              <img
                src={avatar.previewUrl}
                alt="Vista previa de tu nueva foto"
                width={96}
                height={96}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <Avatar member={avatar.kind === 'remove' ? { ...saved.member, avatarUrl: null } : saved.member} size={96} />
            )}
          </span>
          <div className="grid min-w-0 flex-1 basis-56 gap-2">
            <label htmlFor={fileId} className="font-semibold text-forest">
              Elegir una foto
            </label>
            <p id={fileHintId} className="text-sm text-bark">
              JPEG, PNG o WebP, hasta 2 MB.
            </p>
            <input
              ref={(el) => {
                fields.current.file = el
              }}
              id={fileId}
              type="file"
              accept={AVATAR_ACCEPT}
              aria-invalid={avatarError ? true : undefined}
              aria-describedby={avatarError ? `${fileHintId} ${fileErrorId}` : fileHintId}
              onChange={(event) => void chooseFile(event)}
              className="w-full max-w-full min-w-0 text-sm text-forest file:mr-3 file:rounded-md file:border file:border-forest file:bg-paper file:px-3 file:py-1.5 file:text-forest"
            />
            {avatarError && (
              <p id={fileErrorId} className="font-semibold text-bark">
                {avatarError}
              </p>
            )}
            {avatar.kind === 'replace' && <p className="text-moss">La nueva foto se guardará al pulsar «Guardar cambios».</p>}
            {avatar.kind === 'remove' && <p className="text-moss">Tu foto se quitará al pulsar «Guardar cambios».</p>}
            <div className="flex flex-wrap gap-2">
              {hasImage && (
                <button type="button" className={smallButton} onClick={removePhoto}>
                  Quitar foto
                </button>
              )}
              {avatar.kind !== 'keep' && (
                <button id={keepId} type="button" className={smallButton} onClick={keepPhoto}>
                  Mantener la foto actual
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <TextInput
        id={ids.bio}
        label="Sobre mí"
        hint={`Opcional. Hasta ${BIO_MAX_LENGTH} caracteres.`}
        error={errors.bio}
        inputRef={(el) => {
          fields.current.bio = el
        }}
      >
        {(props) => (
          <textarea
            {...props}
            rows={5}
            maxLength={BIO_MAX_LENGTH}
            value={bio}
            onChange={(event) => edit('bio', event.target.value)}
            className={`${inputClass} max-w-prose`}
          />
        )}
      </TextInput>

      <TextInput
        id={ids.favouriteQuote}
        label="Cita favorita"
        hint={`Opcional. Hasta ${QUOTE_MAX_LENGTH} caracteres.`}
        error={errors.favouriteQuote}
        inputRef={(el) => {
          fields.current.favouriteQuote = el
        }}
      >
        {(props) => (
          <textarea
            {...props}
            rows={3}
            maxLength={QUOTE_MAX_LENGTH}
            value={quote}
            onChange={(event) => edit('favouriteQuote', event.target.value)}
            className={`${inputClass} max-w-prose`}
          />
        )}
      </TextInput>

      <FavouriteBooksField chosen={favourites} options={saved.favouriteOptions} onChange={setFavourites} />

      {saveError && (
        <p role="alert" className="max-w-prose font-semibold text-bark">
          {saveError === 'invalid'
            ? 'Algunos datos no son válidos. Revísalos y vuelve a intentarlo.'
            : 'No se ha podido guardar tu perfil. Inténtalo de nuevo.'}
        </p>
      )}
      <div className="grid justify-items-start gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-forest px-5 py-2.5 font-semibold text-parchment hover:bg-moss disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <p role="status" className={savedStatus ? 'font-semibold text-moss' : 'sr-only'}>
          {savedStatus}
        </p>
      </div>
    </form>
  )
}

interface FieldProps {
  id: string
  ref: Ref<HTMLInputElement & HTMLTextAreaElement>
  'aria-invalid': true | undefined
  'aria-describedby': string
}

// A labelled field with its limit as a hint and, after a refused save, its
// error in text; the control is described by both.
function TextInput({
  id,
  label,
  hint,
  error,
  inputRef,
  children,
}: {
  id: string
  label: string
  hint: string
  error: string | undefined
  inputRef: (el: HTMLInputElement | HTMLTextAreaElement | null) => void
  children: (props: FieldProps) => ReactNode
}) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="font-semibold text-forest">
        {label}
      </label>
      <p id={hintId} className="text-sm text-bark">
        {hint}
      </p>
      {children({
        id,
        ref: inputRef,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? `${hintId} ${errorId}` : hintId,
      })}
      {error && (
        <p id={errorId} className="font-semibold text-bark">
          {error}
        </p>
      )}
    </div>
  )
}
