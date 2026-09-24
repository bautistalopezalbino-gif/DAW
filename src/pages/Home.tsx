import { Pin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ErrorBanner from '../components/ErrorBanner'
import { getNotebook, NOTEBOOKS } from '../data/notebooks'
import { noteUrl, pinnedNotes, recentNotes, type NoteWithPlace } from '../lib/api'
import { timeAgo } from '../lib/format'

export default function Home() {
  const [recent, setRecent] = useState<NoteWithPlace[]>([])
  const [pinned, setPinned] = useState<NoteWithPlace[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([recentNotes(), pinnedNotes()])
      .then(([r, p]) => {
        setRecent(r)
        setPinned(p)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      <ErrorBanner error={error} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight">Mis cuadernos</h1>
        <p className="mt-1 text-sm text-slate-500">Elige un módulo para ver sus temas y apuntes.</p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {NOTEBOOKS.map((n) => (
            <Link
              key={n.slug}
              to={`/c/${n.slug}`}
              className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-r-xl rounded-l-md p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: n.color }}
            >
              <span className="absolute inset-y-0 left-2 w-1 bg-white/40" />
              <span className="ml-3 text-xs font-bold tracking-widest opacity-80">{n.code}</span>
              <span className="ml-3 mt-auto text-lg font-bold leading-tight">{n.name}</span>
              <span className="ml-3 mt-1 text-xs leading-snug opacity-85">{n.description}</span>
            </Link>
          ))}
        </div>

        {pinned.length > 0 && <NoteGrid title="Fijados" icon notes={pinned} />}
        <NoteGrid title="Recientes" notes={recent} empty="Aún no tienes apuntes. Entra en un cuaderno, crea un tema y empieza a escribir." />
      </div>
    </div>
  )
}

function NoteGrid({ title, notes, icon, empty }: { title: string; notes: NoteWithPlace[]; icon?: boolean; empty?: string }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-slate-500">
        {icon && <Pin size={14} />} {title}
      </h2>
      {notes.length === 0 && empty && <p className="mt-3 text-sm text-slate-500">{empty}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((n) => {
          const nb = getNotebook(n.sections?.notebook)
          return (
            <Link
              key={n.id}
              to={noteUrl(n)}
              className="rounded-lg border border-slate-200 border-l-4 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
              style={{ borderLeftColor: nb?.color }}
            >
              <div className="text-xs text-slate-500">
                {nb?.code} · {n.sections?.title}
              </div>
              <div className="mt-0.5 truncate font-medium">{n.title || 'Sin título'}</div>
              <div className="mt-1 line-clamp-2 text-sm text-slate-500">{n.content_text || '—'}</div>
              <div className="mt-2 text-xs text-slate-400">{timeAgo(n.updated_at)}</div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
