// Deliberately independent of session/API hooks: either provider may have failed.
// Never render the caught error, which can contain private data or a stack trace.
export function UnexpectedErrorPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-10 text-forest">
      <section className="rounded-xl border border-wood/30 bg-paper p-6">
        <h1 className="font-serif text-3xl">No hemos podido abrir esta página</h1>
        <p role="alert" className="mt-4 text-bark">
          Algo ha fallado. Puedes volver al inicio e intentarlo de nuevo dentro de un momento.
        </p>
        <a href="/" className="mt-4 inline-block rounded-lg bg-forest px-4 py-2 text-parchment">
          Volver al inicio
        </a>
      </section>
    </main>
  )
}
