import { AuthScreen } from '../components/AuthScreen'

// Shown when the app cannot find out who is signed in.
export function SessionErrorPage({ onRetry }: { onRetry: () => void }) {
  return (
    <AuthScreen title="Club de Lectura">
      <div role="alert" className="mt-4">
        <p className="text-forest">No hemos podido conectar con el club. Inténtalo de nuevo en un momento.</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-forest px-5 py-2.5 font-semibold text-parchment hover:bg-moss"
        >
          Reintentar
        </button>
      </div>
    </AuthScreen>
  )
}
