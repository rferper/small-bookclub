import { useId } from 'react'
import { useSession } from '../session/hooks'
import { ActionButton } from './ActionButton'

// Demo sign-in for the public demo instance with fictional data (#75).
// Render it only when the session says a demo sign-in is offered; the backend
// offers it only with DEMO_MODE on.
export function DemoSignIn() {
  const { signIn } = useSession()
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="mt-8 border-t border-wood/40 pt-6">
      <h2 id={headingId} className="text-xl text-forest">
        Versión de demostración
      </h2>
      <p className="mt-2 text-bark">
        Esta es una demo con datos ficticios. Puedes entrar con una cuenta de prueba para echar un vistazo.
      </p>
      <ActionButton
        variant="secondary"
        label="Entrar con una cuenta de prueba"
        onAction={() => signIn((api) => api.startDemoSignIn())}
        errorMessage="No se ha podido entrar con la cuenta de prueba. Inténtalo de nuevo."
        className="mt-4"
      />
    </section>
  )
}
