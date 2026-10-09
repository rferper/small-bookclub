import { createBrowserRouter, RouterProvider } from 'react-router'
import { ApiProvider } from './api/ApiContext'
import { createMockClient } from './api/mock/mockClient'
import { routes } from './routes'

// The mock client stands in for the backend until it exists (docs/decisions.md).
const client = createMockClient()
const router = createBrowserRouter(routes)

export default function App() {
  return (
    <ApiProvider client={client}>
      <RouterProvider router={router} />
    </ApiProvider>
  )
}
