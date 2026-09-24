import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useAuth } from './lib/auth'
import Home from './pages/Home'
import Login from './pages/Login'

// El editor (TipTap + resaltado de código) se carga solo al abrir un cuaderno
const NotebookPage = lazy(() => import('./pages/NotebookPage'))

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid h-full place-items-center text-sm text-slate-500">Cargando…</div>
    )
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
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="c/:slug/:sectionId?/:noteId?" element={
            <Suspense fallback={<p className="p-6 text-sm text-slate-500">Cargando…</p>}>
              <NotebookPage />
            </Suspense>
          } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
