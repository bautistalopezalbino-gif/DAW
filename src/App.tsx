import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import Home from './pages/Home'
import Login from './pages/Login'

// Las páginas pesadas (editor, impresión) se cargan solo cuando se abren
const NotebookPage = lazy(() => import('./pages/NotebookPage'))
const PrintPage = lazy(() => import('./pages/PrintPage'))
const ReviewPage = lazy(() => import('./pages/ReviewPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const TrashPage = lazy(() => import('./pages/TrashPage'))
const TagPage = lazy(() => import('./pages/TagPage'))

const lazyPage = (page: ReactNode) => (
  <Suspense fallback={<p className="p-6 text-sm text-slate-500">Cargando…</p>}>{page}</Suspense>
)

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="grid h-full place-items-center text-sm text-slate-500">Cargando…</div>
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="imprimir/:kind/:id" element={lazyPage(<PrintPage />)} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="c/:slug/:sectionId?/:noteId?" element={lazyPage(<NotebookPage />)} />
        <Route path="s/:ownerId/:slug/:sectionId?/:noteId?" element={lazyPage(<NotebookPage />)} />
        <Route path="repaso" element={lazyPage(<ReviewPage />)} />
        <Route path="calendario" element={lazyPage(<CalendarPage />)} />
        <Route path="etiqueta/:tag?" element={lazyPage(<TagPage />)} />
        <Route path="ajustes" element={lazyPage(<SettingsPage />)} />
        <Route path="papelera" element={lazyPage(<TrashPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
