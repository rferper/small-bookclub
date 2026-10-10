import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useApiData } from '../api/hooks'
import { useAdminAccess } from '../admin/context'
import { BookForm } from '../components/BookForm'
import { BookStatusLabel } from '../components/BookStatusLabel'
import { Card, EmptyState } from '../components/Card'
import { Loading, LoadError } from '../components/Status'

const adminBookPath = (id: string) => `/administracion/libros/${encodeURIComponent(id)}/editar`
const linkClass = 'text-moss underline underline-offset-4 hover:text-forest'

// All routes are children of AdminGuard; the client enforces permission too.
export function AdminBooksPage() {
  const books = useApiData((api) => api.listAdminBooks())
  const { forbid } = useAdminAccess()
  useEffect(() => { if (books.status === 'error' && books.error instanceof ApiError && books.error.status === 403) forbid() }, [books, forbid])
  return <div className="grid gap-6">
    <Link to="/administracion" className={linkClass}>Volver a Administración</Link>
    <h1 className="text-3xl text-forest sm:text-4xl">Libros</h1>
    <p><Link to="/administracion/libros/nuevo" className={linkClass}>Añadir libro</Link></p>
    <Card title="Catálogo">
      {books.status === 'loading' && <Loading />}
      {books.status === 'error' && <LoadError onRetry={books.reload} message="No se ha podido cargar el catálogo." />}
      {books.status === 'ready' && (books.data.length ? <ul className="grid gap-3">{books.data.map((book) => <li key={book.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-wood/20 py-3">
        <Link to={adminBookPath(book.id)} className={`min-w-0 break-words ${linkClass}`}>Editar «{book.title}»</Link><BookStatusLabel status={book.status} />
      </li>)}</ul> : <EmptyState>Aún no hay libros en el catálogo. Puedes añadir el primero cuando quieras.</EmptyState>)}
    </Card>
  </div>
}

export function AdminBookCreatePage() { return <BookForm /> }

export function AdminBookEditPage() {
  const { bookId = '' } = useParams()
  return <EditBook key={bookId} bookId={bookId} />
}

function EditBook({ bookId }: { bookId: string }) {
  const book = useApiData((api) => api.getAdminBook(bookId))
  const { forbid } = useAdminAccess()
  useEffect(() => { if (book.status === 'error' && book.error instanceof ApiError && book.error.status === 403) forbid() }, [book, forbid])
  if (book.status === 'loading') return <Loading />
  if (book.status === 'error') {
    if (book.error instanceof ApiError && book.error.status === 404) return <section><h1 className="text-3xl">No encontramos este libro</h1><Link to="/administracion/libros" className={linkClass}>Volver a Libros</Link></section>
    return <LoadError onRetry={book.reload} message="No se ha podido cargar este libro." />
  }
  return <BookForm book={book.data} />
}
