import { createBrowserRouter, RouterProvider } from 'react-router'
import { ApiProvider } from './api/ApiContext'
import { mockOptionsFromQuery } from './api/mock/devOptions'
import { createMockClient } from './api/mock/mockClient'
import { routes } from './routes'

// The mock client stands in for the backend until it exists (docs/decisions.md).
// Its session can be chosen with ?mock-session=... (see frontend/README.md).
const client = createMockClient(mockOptionsFromQuery(window.location.search))
const router = createBrowserRouter(routes)

export default function App() {
  return (
    <ApiProvider client={client}>
      <RouterProvider router={router} />
    </ApiProvider>
  )
}
