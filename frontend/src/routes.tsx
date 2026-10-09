import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage, PlaceholderPage } from './pages/PlaceholderPage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'biblioteca', element: <PlaceholderPage title="Biblioteca" /> },
      { path: 'biblioteca/:bookId', element: <PlaceholderPage title="Ficha del libro" /> },
      { path: 'reuniones', element: <PlaceholderPage title="Reuniones" /> },
      { path: 'reuniones/:meetingId', element: <PlaceholderPage title="Reunión" /> },
      { path: 'votaciones', element: <PlaceholderPage title="Votaciones" /> },
      { path: 'estadisticas', element: <PlaceholderPage title="Estadísticas" /> },
      { path: 'miembros', element: <PlaceholderPage title="Miembros" /> },
      { path: 'mi-perfil', element: <PlaceholderPage title="Mi perfil" /> },
      { path: 'administracion', element: <PlaceholderPage title="Administración" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
