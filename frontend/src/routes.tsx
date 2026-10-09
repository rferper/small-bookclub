import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { BookPage } from './pages/BookPage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { MeetingPage } from './pages/MeetingPage'
import { MeetingsPage } from './pages/MeetingsPage'
import { NotFoundPage, PlaceholderPage } from './pages/PlaceholderPage'
import { VotePage } from './pages/VotePage'
import { VotesPage } from './pages/VotesPage'
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
          { path: 'reuniones', element: <MeetingsPage /> },
          { path: 'reuniones/:meetingId', element: <MeetingPage /> },
          { path: 'votaciones', element: <VotesPage /> },
          { path: 'votaciones/:voteId', element: <VotePage /> },
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
