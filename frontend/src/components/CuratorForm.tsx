import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useAdminAccess } from '../admin/context'
import { useApi, useApiData } from '../api/hooks'
import type { AdminMembers } from '../api/types'
import { ADMIN_LIST_CHANGED, adminErrorKind } from '../lib/admin'

// The «Sin curaduría» option.
const NOBODY = ''

// «Curaduría» (#70): the admin records who the club chose as curator, an
// assignment for the next vote with no admin powers (§3, §5.4). Existing
// votes keep their recorded curator; the server checks every rule.
export function CuratorForm({
  members,
  onSaved,
  onChanged,
}: {
  members: AdminMembers
  onSaved: (data: AdminMembers) => void
  // The list changed meanwhile: the page reloads it.
  onChanged: () => void
}) {
  const api = useApi()
  const { forbid } = useAdminAccess()
  // Only to mention the draft or open vote; the note is left out if it fails.
  const votes = useApiData((client) => client.getVotes())
  const current = members.curator?.id ?? NOBODY
  const options = members.members.filter((e) => e.status === 'active')
  // The choice in the select, kept only while the saved curator is the one
  // it was made against and the person is still an option.
  const [choice, setChoice] = useState<{ base: string; value: string } | null>(null)
  const selected =
    choice && choice.base === current && (choice.value === NOBODY || options.some((e) => e.member.id === choice.value))
      ? choice.value
      : current
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const running = useRef(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)
  useLayoutEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    buttonRef.current?.focus()
  })
  const selectId = useId()
  const hintId = useId()

  const nameOf = (id: string) => options.find((e) => e.member.id === id)?.member.displayName ?? ''

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (running.current) return
    setFailure(null)
    // Nothing to save: no call.
    if (selected === current) {
      setStatus(
        current === NOBODY
          ? 'No hay cambios: sigue sin haber nadie en la curaduría.'
          : `No hay cambios: la curaduría sigue siendo de ${nameOf(current)}.`,
      )
      return
    }
    setStatus('')
    running.current = true
    setSaving(true)
    try {
      const data = await api.setCurator(selected === NOBODY ? null : selected)
      onSaved(data)
      setChoice(null)
      setStatus(
        data.curator ? `La curaduría es ahora de ${data.curator.displayName}.` : 'Ahora no hay nadie en la curaduría.',
      )
    } catch (error) {
      const kind = adminErrorKind(error)
      if (kind === 'changed') {
        setStatus(ADMIN_LIST_CHANGED)
        onChanged()
      } else if (kind === 'forbidden') {
        forbid()
      } else if (kind === 'failed') {
        setFailure('No se ha podido guardar la curaduría. Inténtalo de nuevo.')
      }
    } finally {
      running.current = false
      setSaving(false)
      // Keep focus on the button, never on the page body.
      refocus.current = true
    }
  }

  const vote = votes.status === 'ready' ? votes.data.current : null

  return (
    <div className="grid min-w-0 gap-4">
      <p className="break-words text-forest">
        {members.curator
          ? `Ahora la curaduría es de ${members.curator.displayName}.`
          : 'Ahora no hay nadie en la curaduría.'}
      </p>
      {vote && (
        <p className="max-w-prose break-words text-bark">
          {vote.status === 'draft' ? 'Hay una votación en preparación' : 'Hay una votación abierta'}: en el historial
          seguirá constando con la curaduría de {vote.curator.displayName}, y quien tenga la curaduría podrá
          gestionarla desde ahora.
        </p>
      )}
      <form noValidate onSubmit={(event) => void submit(event)} className="grid min-w-0 gap-3">
        <div className="grid min-w-0 gap-1">
          <label htmlFor={selectId} className="font-semibold text-forest">
            Persona en la curaduría
          </label>
          <p id={hintId} className="max-w-prose text-sm text-bark">
            La curaduría prepara la próxima votación. Es un encargo que elige el club, sin permisos de administración.
          </p>
          <select
            id={selectId}
            aria-describedby={hintId}
            value={selected}
            onChange={(event) => {
              setChoice({ base: current, value: event.target.value })
              setStatus('')
            }}
            className="w-full max-w-xs min-w-0 rounded-lg border border-wood/60 bg-paper p-2 text-forest"
          >
            <option value={NOBODY}>Sin curaduría</option>
            {options.map((entry) => (
              <option key={entry.member.id} value={entry.member.id}>
                {entry.member.displayName}
              </option>
            ))}
          </select>
        </div>
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
            className="rounded-lg border-2 border-forest px-5 py-2 font-semibold text-forest hover:bg-sage/50 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar curaduría'}
          </button>
          <p role="status" className={status ? 'max-w-prose font-semibold break-words text-moss' : 'sr-only'}>
            {status}
          </p>
        </div>
      </form>
    </div>
  )
}
