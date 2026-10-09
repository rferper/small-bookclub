import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useApiData } from '../api/hooks'

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
  const user = useApiData((api) => api.getCurrentUser())
  const [menuOpen, setMenuOpen] = useState(false)

  // Hiding the admin link is cosmetic; the backend refuses admin actions to members.
  const isAdmin = user.status === 'ready' && user.data.role === 'admin'
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 ${isActive ? 'bg-sage font-semibold text-forest' : 'text-forest hover:bg-sage/50'}`

  return (
    <div className="min-h-screen">
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
            className="rounded-md border border-wood/50 px-3 py-1.5 text-forest lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="menu-principal"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Cerrar menú' : 'Menú'}
          </button>
        </div>
        <nav
          id="menu-principal"
          aria-label="Principal"
          className={`mx-auto max-w-6xl px-4 pb-3 lg:block ${menuOpen ? 'block' : 'hidden'}`}
        >
          <ul className="flex flex-col gap-1 lg:flex-row lg:flex-wrap">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} className={linkClass} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
