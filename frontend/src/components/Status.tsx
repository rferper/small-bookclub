export function Loading() {
  return (
    <p role="status" className="text-bark">
      Cargando…
    </p>
  )
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-wood/40 bg-paper p-5">
      <p>No se ha podido cargar esta página.</p>
      <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-forest px-4 py-2 text-parchment">
        Reintentar
      </button>
    </div>
  )
}
