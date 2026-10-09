import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { BookPage } from './pages/BookPage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { NotFoundPage, PlaceholderPage } from './pages/PlaceholderPage'
import { SessionGate } from './session/SessionGate'

// Every route sits behind the session gate, so no page renders (or loads
// club data) until the visitor is a signed-in member.
export const routes: RouteObject[] = [
  {
    element: <SessionGate />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'biblioteca', element: <LibraryPage /> },
          { path: 'biblioteca/:bookId', element: <BookPage /> },
          { path: 'reuniones', element: <PlaceholderPage title="Reuniones" /> },
          { path: 'reuniones/:meetingId', element: <PlaceholderPage title="Reunión" /> },
          { path: 'votaciones', element: <PlaceholderPage title="Votaciones" /> },
          { path: 'votaciones/:voteId', element: <PlaceholderPage title="Votación" /> },
          { path: 'estadisticas', element: <PlaceholderPage title="Estadísticas" /> },
          { path: 'miembros', element: <PlaceholderPage title="Miembros" /> },
          { path: 'mi-perfil', element: <PlaceholderPage title="Mi perfil" /> },
          { path: 'administracion', element: <PlaceholderPage title="Administración" /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
