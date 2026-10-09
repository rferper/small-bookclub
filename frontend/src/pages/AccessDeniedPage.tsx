import { AuthScreen } from '../components/AuthScreen'
import { DemoSignIn } from '../components/DemoSignIn'
import { SignInButton } from '../components/SignInButton'
import { useSession } from '../session/hooks'

// Shown at any URL when the last sign-in was refused. It shows no club data
// and no account details, and offers no way to request access.
export function AccessDeniedPage() {
  const { session } = useSession()
  const demo = session?.status === 'denied' && session.demoSignInAvailable
  return (
    <AuthScreen title="Esta cuenta no tiene acceso al club">
      <p className="mt-4 text-forest">
        Este club de lectura es privado: solo pueden entrar los miembros que ha añadido la persona que lo administra.
      </p>
      <p className="mt-3 text-forest">
        Si crees que se trata de un error, puedes preguntárselo a quien administra el club.
      </p>
      <p className="mt-3 text-bark">¿Tienes otra cuenta de Discord? Puedes volver a intentarlo con ella.</p>
      <SignInButton className="mt-6" />
      {demo && <DemoSignIn />}
    </AuthScreen>
  )
}
