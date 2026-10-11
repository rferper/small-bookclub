import { createBrowserRouter, RouterProvider } from 'react-router'
import { ApiProvider } from './api/ApiContext'
import { CONFIGURATION_ERROR, createApiClient } from './api/factory'
import { routes } from './routes'

// Configuration is decided before creating the router or requesting a session.
function startup() {
  try {
    const client = createApiClient(import.meta.env.VITE_API_MODE, window.location.search)
    return { client, router: createBrowserRouter(routes) }
  } catch { return null }
}
const configured = startup()

export default function App() {
  if (!configured) return <ConfigurationError />
  return (
    <ApiProvider client={configured.client}>
      <RouterProvider router={configured.router} />
    </ApiProvider>
  )
}

export function ConfigurationError() {
  return <main className="mx-auto max-w-md px-4 py-10">
    <h1 className="font-serif text-2xl text-forest">No podemos iniciar el sitio</h1>
    <p role="alert" className="mt-4 text-bark">{CONFIGURATION_ERROR}</p>
  </main>
}
