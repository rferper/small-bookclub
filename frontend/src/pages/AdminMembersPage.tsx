import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AdminOnlyMessage } from '../admin/AdminGuard'
import { useAdminAccess } from '../admin/context'
import { ApiError } from '../api/client'
import { useApi, useApiData } from '../api/hooks'
import type { AdminMember, AdminMembers } from '../api/types'
import { AddMemberForm } from '../components/AddMemberForm'
import { Avatar } from '../components/Avatar'
import { Card } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CuratorForm } from '../components/CuratorForm'
import { LoadError, Loading } from '../components/Status'
import { ADMIN_LIST_CHANGED, adminErrorKind } from '../lib/admin'
import { formatLongDate } from '../lib/format'

const smallButton =
  'rounded-md border border-forest px-3 py-1.5 text-forest hover:bg-sage/50 disabled:cursor-not-allowed disabled:opacity-50'
const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

// «Miembros y curaduría» (#70): the member allowlist and the curator
// assignment, for the admin. Behind AdminGuard; every rule is the server's.
export function AdminMembersPage() {
  const loaded = useApiData((api) => api.getAdminMembers())

  // The server refused the admin call: the same message as the guard.
  if (loaded.status === 'error' && loaded.error instanceof ApiError && loaded.error.status === 403) {
    return <AdminOnlyMessage focusOnMount />
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl break-words text-forest sm:text-4xl">Miembros y curaduría</h1>
        <p className="mt-2">
          <Link to="/administracion" className={linkClass}>
            Volver a Administración
          </Link>
        </p>
      </div>
      {loaded.status === 'loading' && <Loading />}
      {loaded.status === 'error' && <LoadError onRetry={loaded.reload} message="No se ha podido cargar la lista de miembros." />}
      {loaded.status === 'ready' && <AdminMembersView loaded={loaded.data} reload={loaded.reload} />}
    </div>
  )
}

function AdminMembersView({ loaded, reload }: { loaded: AdminMembers; reload: () => void }) {
  // The list as the last change returned it, until the next load replaces it.
  const [saved, setSaved] = useState<{ from: AdminMembers; data: AdminMembers } | null>(null)
  const data = saved && saved.from === loaded ? saved.data : loaded
  const update = (next: AdminMembers) => setSaved({ from: loaded, data: next })

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[auto_1fr] lg:items-start">
      <Card title="Añadir un miembro" className="min-w-0 lg:col-start-2 lg:row-start-1">
        <AddMemberForm members={data} onAdded={update} onChanged={reload} />
      </Card>
      <MemberList data={data} onSaved={update} onChanged={reload} />
      <Card title="Curaduría" className="min-w-0 lg:col-start-2 lg:row-start-2">
        <CuratorForm members={data} onSaved={update} onChanged={reload} />
      </Card>
    </div>
  )
}

function MemberList({
  data,
  onSaved,
  onChanged,
}: {
  data: AdminMembers
  onSaved: (data: AdminMembers) => void
  // A change was refused with a 409: the page reloads the list.
  onChanged: () => void
}) {
  const api = useApi()
  const { forbid } = useAdminAccess()
  // Keys of the controls whose call is in flight; a ref too, so a double
  // click cannot start the same call twice.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const running = useRef(new Set<string>())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('')
  const [revoking, setRevoking] = useState<AdminMember | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Where keyboard focus goes after the next render, so it never falls back
  // to the page body when the focused control disappears or moves.
  const focusNext = useRef<(() => HTMLElement | null) | null>(null)
  useLayoutEffect(() => {
    const find = focusNext.current
    if (!find) return
    focusNext.current = null
    find()?.focus()
  })
  const byKey = (key: string) => listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) ?? null

  const setPendingKey = (key: string, on: boolean) => {
    if (on) running.current.add(key)
    else running.current.delete(key)
    setPending(new Set(running.current))
  }

  // Runs one change. Returns the new list, 'failed' after an error that
  // leaves the list as it was, or null when something else takes over (a 409
  // reloads the list, a 403 shows the guard's message, a 401 the sign-in).
  const run = async (key: string, call: () => Promise<AdminMembers>): Promise<AdminMembers | 'failed' | null> => {
    if (running.current.has(key)) return null
    setPendingKey(key, true)
    setErrors((current) => withoutKey(current, key))
    setStatus('')
    try {
      return await call()
    } catch (error) {
      const kind = adminErrorKind(error)
      if (kind === 'changed') {
        setStatus(ADMIN_LIST_CHANGED)
        onChanged()
      }
      if (kind === 'forbidden') forbid()
      return kind === 'failed' ? 'failed' : null
    } finally {
      setPendingKey(key, false)
    }
  }

  const openRevoke = (entry: AdminMember) => {
    setDialogError(null)
    setRevoking(entry)
  }

  const cancelRevoke = () => {
    const entry = revoking
    setRevoking(null)
    if (entry) focusNext.current = () => byKey(`revoke:${entry.member.id}`)
  }

  const confirmRevoke = async () => {
    if (!revoking) return
    const { id, displayName } = revoking.member
    setDialogError(null)
    const result = await run(`revoke:${id}`, () => api.revokeMember(id))
    if (result === 'failed') {
      setDialogError(`No se ha podido retirar el acceso a ${displayName}. Inténtalo de nuevo.`)
      return
    }
    setRevoking(null)
    if (!result) {
      focusNext.current = () => headingRef.current
      return
    }
    onSaved(result)
    setStatus(`${displayName} ya no tiene acceso al club. Su historia en el club se mantiene.`)
    focusNext.current = () => headingRef.current
  }

  const restore = async (entry: AdminMember) => {
    const { id, displayName } = entry.member
    const key = `restore:${id}`
    const result = await run(key, () => api.restoreMember(id))
    if (result === 'failed') {
      setErrors((current) => ({ ...current, [key]: `No se ha podido devolver el acceso a ${displayName}. Inténtalo de nuevo.` }))
      return
    }
    if (!result) return
    onSaved(result)
    setStatus(`${displayName} vuelve a tener acceso al club.`)
    // The restored member's own entry, now in the active group.
    focusNext.current = () => byKey(`revoke:${id}`) ?? headingRef.current
  }

  const active = data.members.filter((e) => e.status === 'active')
  const revoked = data.members.filter((e) => e.status === 'revoked')

  return (
    <Card
      title="Miembros"
      headingRef={headingRef}
      className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1"
    >
      <div ref={listRef} className="grid gap-5">
        <p role="status" className={status ? 'max-w-prose font-semibold text-moss' : 'sr-only'}>
          {status}
        </p>
        <section aria-labelledby="miembros-con-acceso" className="grid gap-3">
          <h3 id="miembros-con-acceso" className="text-lg text-forest">
            Con acceso
          </h3>
          <ul className="grid gap-3">
            {active.map((entry) => (
              <MemberItem key={entry.member.id} entry={entry}>
                {!entry.isMe && (
                  <button
                    type="button"
                    data-key={`revoke:${entry.member.id}`}
                    aria-label={`Retirar el acceso a ${entry.member.displayName}`}
                    className={smallButton}
                    disabled={pending.has(`revoke:${entry.member.id}`)}
                    onClick={() => openRevoke(entry)}
                  >
                    Retirar el acceso
                  </button>
                )}
              </MemberItem>
            ))}
          </ul>
        </section>
        {revoked.length > 0 && (
          <section aria-labelledby="miembros-sin-acceso" className="grid gap-3">
            <h3 id="miembros-sin-acceso" className="text-lg text-forest">
              Sin acceso
            </h3>
            <ul className="grid gap-3">
              {revoked.map((entry) => {
                const key = `restore:${entry.member.id}`
                return (
                  <MemberItem key={entry.member.id} entry={entry}>
                    <button
                      type="button"
                      data-key={key}
                      aria-label={`Devolver el acceso a ${entry.member.displayName}`}
                      className={smallButton}
                      disabled={pending.has(key)}
                      onClick={() => void restore(entry)}
                    >
                      Devolver el acceso
                    </button>
                    {errors[key] && (
                      <p role="alert" className="font-semibold text-bark">
                        {errors[key]}
                      </p>
                    )}
                  </MemberItem>
                )
              })}
            </ul>
          </section>
        )}
      </div>
      {revoking && (
        <ConfirmDialog
          title={`¿Retirar el acceso a ${revoking.member.displayName}?`}
          confirmLabel="Retirar el acceso"
          busy={pending.has(`revoke:${revoking.member.id}`)}
          error={dialogError}
          onCancel={cancelRevoke}
          onConfirm={() => void confirmRevoke()}
        >
          <p>Ya no podrá entrar al club con su cuenta de Discord, y su sesión abierta se cerrará.</p>
          <p>Sus votos, valoraciones y asistencias pasadas se quedan en la historia del club.</p>
          {revoking.isCurator && (
            <p className="font-semibold">Ahora tiene la curaduría, así que el club se quedará sin nadie en la curaduría.</p>
          )}
          <p className="text-bark">Si cambias de idea, podrás devolverle el acceso más adelante.</p>
        </ConfirmDialog>
      )}
    </Card>
  )
}

function MemberItem({ entry, children }: { entry: AdminMember; children: ReactNode }) {
  const labels = [
    entry.role === 'admin' ? 'Administración' : null,
    entry.isCurator ? 'Curaduría actual' : null,
  ].filter((label): label is string => label !== null)
  return (
    <li className="grid min-w-0 gap-3 rounded-lg border border-wood/30 bg-parchment/60 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <span className="shrink-0">
          <Avatar member={entry.member} />
        </span>
        <div className="grid min-w-0 gap-1">
          <p className="font-semibold break-words text-forest">
            {entry.member.displayName}
            {entry.isMe && ' (tú)'}
            {labels.map((label) => (
              <span key={label} className="font-normal text-moss">
                {' · '}
                {label}
              </span>
            ))}
          </p>
          <p className="text-sm text-bark">
            ID de Discord: <span className="font-mono break-all text-forest">{entry.discordId}</span>
          </p>
          <p className="text-sm text-forest">
            {entry.status === 'active'
              ? 'Con acceso'
              : entry.revokedAt
                ? `Acceso retirado el ${formatLongDate(entry.revokedAt)}`
                : 'Acceso retirado'}
          </p>
        </div>
      </div>
      <div className="grid min-w-0 justify-items-start gap-2 sm:justify-items-end">{children}</div>
    </li>
  )
}

function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  const rest = { ...record }
  delete rest[key]
  return rest
}
