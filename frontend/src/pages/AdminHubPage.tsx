import { Link } from 'react-router'

// The admin sections that exist. Each later Administración issue adds its
// own entry here (#95–#101); there are no placeholders for the others.
const SECTIONS = [
  {
    to: '/administracion/miembros',
    title: 'Miembros y curaduría',
    description: 'Añade miembros con su ID de Discord, retira o devuelve el acceso y elige quién tiene la curaduría.',
  },
]

// Administración (#70): the hub that the admin screens plug into. Behind
// AdminGuard, like every admin route.
export function AdminHubPage() {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl text-forest sm:text-4xl">Administración</h1>
        <p className="mt-2 max-w-prose text-bark">Aquí se cuida la organización del club, con calma y paso a paso.</p>
      </div>
      <ul className="grid max-w-4xl gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.to} className="min-w-0 rounded-xl border border-wood/30 bg-paper p-5 shadow-sm">
            <Link to={section.to} className="font-serif text-xl break-words text-moss underline underline-offset-4 hover:text-forest">
              {section.title}
            </Link>
            <p className="mt-2 text-bark">{section.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
