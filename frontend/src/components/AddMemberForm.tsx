import { useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useAdminAccess } from '../admin/context'
import { ApiError } from '../api/client'
import { useApi } from '../api/hooks'
import type { AdminMembers } from '../api/types'
import { adminErrorKind, DISCORD_ID_MAX_DIGITS, DISCORD_ID_MIN_DIGITS, discordIdProblem } from '../lib/admin'
import { DISPLAY_NAME_MAX_LENGTH, displayNameProblem, type DisplayNameProblem } from '../lib/profile'

const inputClass =
  'w-full min-w-0 rounded-lg border border-wood/60 bg-paper p-2 text-forest aria-[invalid=true]:border-2 aria-[invalid=true]:border-bark'

const DISCORD_ID_MESSAGE = `Escribe un ID de Discord de ${DISCORD_ID_MIN_DIGITS} a ${DISCORD_ID_MAX_DIGITS} cifras.`

const NAME_MESSAGES: Record<DisplayNameProblem, string> = {
  empty: 'Escribe un nombre.',
  tooLong: `El nombre puede tener como máximo ${DISPLAY_NAME_MAX_LENGTH} caracteres.`,
  notOneLine: 'Escribe el nombre en una sola línea.',
}

type Field = 'discordId' | 'displayName'
const FIELDS: readonly Field[] = ['discordId', 'displayName']

// «Añadir un miembro» (#70): adding a Discord user id to the allowlist
// approves that member at once. Nothing is fetched from Discord; the server
// checks every rule again.
export function AddMemberForm({
  members,
  onAdded,
  onChanged,
}: {
  // The list as the page shows it, to say whose id a duplicate is.
  members: AdminMembers
  onAdded: (data: AdminMembers) => void
  // The list changed meanwhile: the page reloads it.
  onChanged: () => void
}) {
  const api = useApi()
  const { forbid } = useAdminAccess()
  const [values, setValues] = useState<Record<Field, string>>({ discordId: '', displayName: '' })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const running = useRef(false)
  const fields = useRef<Partial<Record<Field, HTMLInputElement | null>>>({})
  const buttonRef = useRef<HTMLButtonElement>(null)
  const focusNext = useRef<(() => HTMLElement | null | undefined) | null>(null)
  useLayoutEffect(() => {
    const find = focusNext.current
    if (!find) return
    focusNext.current = null
    find()?.focus()
  })

  const edit = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    // Editing a field clears its error.
    setErrors((current) => {
      const rest = { ...current }
      delete rest[field]
      return rest
    })
  }

  // Whose id it is, from the list on the page; a revoked entry points to
  // «Devolver el acceso» instead of adding the person again.
  const duplicateMessage = (discordId: string) => {
    const entry = members.members.find((e) => e.discordId === discordId)
    if (!entry) return 'Ese ID de Discord ya está en la lista.'
    const name = entry.member.displayName
    return entry.status === 'revoked'
      ? `Ese ID de Discord ya está en la lista: es de ${name}, que ahora no tiene acceso. Puedes usar «Devolver el acceso» en su entrada.`
      : `Ese ID de Discord ya está en la lista: es de ${name}.`
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (running.current) return
    setStatus('')
    setFailure(null)
    const found: Partial<Record<Field, string>> = {}
    if (discordIdProblem(values.discordId)) found.discordId = DISCORD_ID_MESSAGE
    const nameProblem = displayNameProblem(values.displayName)
    if (nameProblem) found.displayName = NAME_MESSAGES[nameProblem]
    setErrors(found)
    const firstInvalid = FIELDS.find((field) => found[field])
    if (firstInvalid) {
      focusNext.current = () => fields.current[firstInvalid]
      return
    }

    running.current = true
    setSaving(true)
    try {
      const data = await api.addMember({ discordId: values.discordId, displayName: values.displayName })
      const name = values.displayName.trim()
      onAdded(data)
      setValues({ discordId: '', displayName: '' })
      setStatus(`${name} ya puede entrar al club con Discord.`)
      // Ready to add someone else.
      focusNext.current = () => fields.current.discordId
    } catch (error) {
      const kind = adminErrorKind(error)
      // Every entered value stays as it is.
      if (kind === 'changed') {
        const discordId = values.discordId.trim()
        // An id we did not know about: the list is out of date.
        if (!members.members.some((e) => e.discordId === discordId)) onChanged()
        setErrors({ discordId: duplicateMessage(discordId) })
        focusNext.current = () => fields.current.discordId
      } else if (kind === 'forbidden') {
        forbid()
      } else if (kind === 'failed') {
        setFailure(
          error instanceof ApiError && error.status === 400
            ? 'Algunos datos no son válidos. Revísalos y vuelve a intentarlo.'
            : 'No se ha podido añadir a esta persona. Inténtalo de nuevo.',
        )
        focusNext.current = () => buttonRef.current
      }
    } finally {
      running.current = false
      setSaving(false)
    }
  }

  const ids = { discordId: useId(), displayName: useId() }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid min-w-0 gap-5">
      <TextField
        id={ids.discordId}
        label="ID de Discord"
        hint={`El ID numérico de la cuenta de Discord, de ${DISCORD_ID_MIN_DIGITS} a ${DISCORD_ID_MAX_DIGITS} cifras. Solo esa cuenta podrá entrar al club.`}
        error={errors.discordId}
      >
        {(props) => (
          <input
            {...props}
            ref={(el) => {
              fields.current.discordId = el
            }}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            required
            value={values.discordId}
            onChange={(event) => edit('discordId', event.target.value)}
            className={`${inputClass} max-w-xs font-mono`}
          />
        )}
      </TextField>
      <TextField
        id={ids.displayName}
        label="Nombre visible"
        hint={`Hasta ${DISPLAY_NAME_MAX_LENGTH} caracteres. Después podrá cambiarlo en Mi perfil.`}
        error={errors.displayName}
      >
        {(props) => (
          <input
            {...props}
            ref={(el) => {
              fields.current.displayName = el
            }}
            type="text"
            autoComplete="off"
            required
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            value={values.displayName}
            onChange={(event) => edit('displayName', event.target.value)}
            className={`${inputClass} max-w-md`}
          />
        )}
      </TextField>
      {failure && (
        <p role="alert" className="max-w-prose font-semibold text-bark">
          {failure}
        </p>
      )}
      <div className="grid justify-items-start gap-2">
        <button
          ref={buttonRef}
          type="submit"
          disabled={saving}
          className="rounded-lg bg-forest px-5 py-2.5 font-semibold text-parchment hover:bg-moss disabled:opacity-60"
        >
          {saving ? 'Añadiendo…' : 'Añadir miembro'}
        </button>
        <p role="status" className={status ? 'max-w-prose font-semibold break-words text-moss' : 'sr-only'}>
          {status}
        </p>
      </div>
    </form>
  )
}

interface FieldProps {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string
}

// A labelled input with its hint and, when invalid, its error in text; the
// input is described by both.
function TextField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint: string
  error: string | undefined
  children: (props: FieldProps) => ReactNode
}) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="font-semibold text-forest">
        {label}
      </label>
      <p id={hintId} className="max-w-prose text-sm text-bark">
        {hint}
      </p>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? `${hintId} ${errorId}` : hintId,
      })}
      {error && (
        <p id={errorId} className="max-w-prose font-semibold break-words text-bark">
          {error}
        </p>
      )}
    </div>
  )
}
