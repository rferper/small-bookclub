import { useSession } from '../session/hooks'
import { ActionButton } from './ActionButton'

export function SignInButton({ className }: { className?: string }) {
  const { signIn } = useSession()
  return (
    <ActionButton
      label="Entrar con Discord"
      onAction={() => signIn((api) => api.startSignIn())}
      errorMessage="No se ha podido iniciar sesión. Inténtalo de nuevo."
      className={className}
    />
  )
}
