import { useRef, type ReactNode } from 'react'
import { useFocusOnMount } from '../session/hooks'

// Full-page frame for the screens shown instead of the club: sign-in,
// access denied and session errors. They have no navigation or club data.
export function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useFocusOnMount(heading)

  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-wood/30 bg-paper p-6 shadow-sm sm:p-8">
        <h1 ref={heading} tabIndex={-1} className="text-3xl text-forest">
          {title}
        </h1>
        {children}
      </div>
    </main>
  )
}
