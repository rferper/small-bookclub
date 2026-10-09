import { useId, type ReactNode } from 'react'

// A soft paper surface with a serif heading, used for each homepage block.
export function Card({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className={`rounded-xl border border-wood/30 bg-paper p-5 shadow-sm ${className}`}>
      <h2 id={headingId} className="mb-3 text-xl text-forest">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-bark italic">{children}</p>
}
