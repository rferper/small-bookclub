import { Link } from 'react-router'

// Stand-in for sections that are not built yet.
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="rounded-xl border border-wood/30 bg-paper p-6">
      <h1 className="text-3xl text-forest">{title}</h1>
      <p className="mt-2 text-bark">Esta sección todavía se está preparando.</p>
    </section>
  )
}

export function NotFoundPage() {
  return (
    <section className="rounded-xl border border-wood/30 bg-paper p-6">
      <h1 className="text-3xl text-forest">Página no encontrada</h1>
      <p className="mt-2 text-bark">Parece que esta página se ha perdido entre las estanterías.</p>
      <Link to="/" className="mt-3 inline-block text-moss underline underline-offset-4">
        Volver al inicio
      </Link>
    </section>
  )
}
