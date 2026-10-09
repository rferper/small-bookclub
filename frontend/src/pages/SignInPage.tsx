import { AuthScreen } from '../components/AuthScreen'
import { DemoSignIn } from '../components/DemoSignIn'
import { SignInButton } from '../components/SignInButton'
import { useSession } from '../session/hooks'

// Shown at any URL while nobody is signed in. There is deliberately no way to
// sign up or ask for access: members are added by the club's administrator.
export function SignInPage() {
  const { session, signedOut } = useSession()
  const demo = session?.status === 'anonymous' && session.demoSignInAvailable
  return (
    <AuthScreen title="Club de Lectura">
      {signedOut && (
        <p role="status" className="mt-4 rounded-md bg-sage px-3 py-2 text-forest">
          Has cerrado sesión. ¡Hasta pronto!
        </p>
      )}
      <p className="mt-4 text-lg text-forest">
        Te damos la bienvenida a la biblioteca privada del club. Los miembros entran con su cuenta de Discord.
      </p>
      <SignInButton className="mt-6" />
      {demo && <DemoSignIn />}
    </AuthScreen>
  )
}
