import type { RouteObject } from 'react-router'
import { AdminGuard } from './admin/AdminGuard'
import { Layout } from './components/Layout'
import { AdminHubPage } from './pages/AdminHubPage'
import { AdminMembersPage } from './pages/AdminMembersPage'
import { BookPage } from './pages/BookPage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { MeetingPage } from './pages/MeetingPage'
import { MeetingsPage } from './pages/MeetingsPage'
import { MemberProfilePage } from './pages/MemberProfilePage'
import { MembersPage } from './pages/MembersPage'
import { MyProfilePage } from './pages/MyProfilePage'
import { NotFoundPage } from './pages/PlaceholderPage'
import { RatePage } from './pages/RatePage'
import { StatisticsPage } from './pages/StatisticsPage'
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
          { path: 'biblioteca/:bookId/valorar', element: <RatePage /> },
          { path: 'reuniones', element: <MeetingsPage /> },
          { path: 'reuniones/:meetingId', element: <MeetingPage /> },
          { path: 'votaciones', element: <VotesPage /> },
          { path: 'votaciones/:voteId', element: <VotePage /> },
          { path: 'estadisticas', element: <StatisticsPage /> },
          { path: 'miembros', element: <MembersPage /> },
          { path: 'miembros/:memberId', element: <MemberProfilePage /> },
          { path: 'mi-perfil', element: <MyProfilePage /> },
          // Every admin route sits behind one guard (#70); later admin pages
          // (#95–#101) are added as its children.
          {
            path: 'administracion',
            element: <AdminGuard />,
            children: [
              { index: true, element: <AdminHubPage /> },
              { path: 'miembros', element: <AdminMembersPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
