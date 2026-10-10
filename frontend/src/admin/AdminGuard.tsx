import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useSession } from '../session/hooks'
import { AdminAccessContext } from './context'

// Wraps every Administración route (#70), so each admin page gets the same
// behaviour: the admin sees the page; anyone else (a member, or the current
// curator, who is a member with an assignment) gets a calm message instead,
// and the page never loads, so no admin call is made. A 403 from any admin
// call shows the same message.
//
// This guard is cosmetic, based on the session role. The backend enforces
// admin access on every admin endpoint (#11).
export function AdminGuard() {
  const { session } = useSession()
  const { pathname } = useLocation()
  // The page where the server refused an admin call; another admin page
  // tries again (and gets its own 403 if the role really changed).
  const [forbiddenAt, setForbiddenAt] = useState<string | null>(null)
  const access = useMemo(() => ({ forbid: () => setForbiddenAt(pathname) }), [pathname])
  const isAdmin = session?.status === 'signedIn' && session.user.role === 'admin'

  if (!isAdmin) return <AdminOnlyMessage />
  if (forbiddenAt === pathname) return <AdminOnlyMessage focusOnMount />
  return (
    <AdminAccessContext.Provider value={access}>
      <Outlet />
    </AdminAccessContext.Provider>
  )
}

// Shown instead of an admin page. With `focusOnMount` (it replaced a page
// that was open) it takes keyboard focus, so focus never falls to the body.
export function AdminOnlyMessage({ focusOnMount = false }: { focusOnMount?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    if (focusOnMount) heading.current?.focus()
  }, [focusOnMount])
  return (
    <section className="rounded-xl border border-wood/30 bg-paper p-6">
      <h1 ref={heading} tabIndex={-1} className="text-3xl text-forest">
        Sección reservada
      </h1>
      <p className="mt-2 max-w-prose text-bark">Esta sección es solo para la administración del club.</p>
      <Link to="/" className="mt-3 inline-block text-moss underline underline-offset-4">
        Volver al inicio
      </Link>
    </section>
  )
}
