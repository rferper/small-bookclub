import { useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useFocusOnMount, useSession } from '../session/hooks'
import { ActionButton } from './ActionButton'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio' },
  { to: '/biblioteca', label: 'Biblioteca' },
  { to: '/reuniones', label: 'Reuniones' },
  { to: '/votaciones', label: 'Votaciones' },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/miembros', label: 'Miembros' },
  { to: '/mi-perfil', label: 'Mi perfil' },
]

const ADMIN_ITEM = { to: '/administracion', label: 'Administración' }

export function Layout() {
  const { session, signOut } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  // After signing in, focus starts at the top of the page, not on the removed button.
  const top = useRef<HTMLDivElement>(null)
  useFocusOnMount(top)

  // Hiding the admin link is cosmetic; the backend refuses admin actions to members.
  const isAdmin = session?.status === 'signedIn' && session.user.role === 'admin'
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 ${isActive ? 'bg-sage font-semibold text-forest' : 'text-forest hover:bg-sage/50'}`

  return (
    <div ref={top} tabIndex={-1} className="min-h-screen outline-none">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:bg-paper focus:p-2">
        Saltar al contenido
      </a>
      <header className="border-b border-wood/30 bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="font-serif text-2xl text-forest">
            Club de Lectura
          </NavLink>
          <button
            type="button"
            className="rounded-md border border-wood/50 px-3 py-1.5 text-forest sm:hidden"
            aria-expanded={menuOpen}
            aria-controls="menu-principal"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Cerrar menú' : 'Menú'}
          </button>
        </div>
        <div
          id="menu-principal"
          className={`mx-auto max-w-6xl px-4 pb-3 sm:flex sm:items-start sm:justify-between sm:gap-4 ${menuOpen ? 'block' : 'hidden'}`}
        >
          <nav aria-label="Principal">
            <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === '/'} className={linkClass} onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <ActionButton
            variant="quiet"
            label="Cerrar sesión"
            onAction={signOut}
            errorMessage="No se ha podido cerrar la sesión. Inténtalo de nuevo."
            className="mt-2 sm:mt-0 sm:max-w-56 sm:shrink-0 sm:text-right"
          />
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
