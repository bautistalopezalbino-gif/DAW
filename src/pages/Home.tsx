import { CalendarDays, Layers, Pin, Sparkles, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAssistant } from '../components/assistant/AssistantProvider'
import ErrorBanner from '../components/ErrorBanner'
import NoteCards from '../components/NoteCards'
import { getNotebook, NOTEBOOKS } from '../data/notebooks'
import { pinnedNotes, recentNotes, type NoteWithPlace } from '../lib/api'
import { useAuth } from '../lib/auth'
import { countDue } from '../lib/cards'
import { KIND_LABEL, relativeDay, upcomingEvents, type CalendarEvent } from '../lib/events'
import { sharedWithMe, type Share } from '../lib/shares'

export default function Home() {
  const { session } = useAuth()
  const [recent, setRecent] = useState<NoteWithPlace[]>([])
  const [pinned, setPinned] = useState<NoteWithPlace[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [due, setDue] = useState(0)
  const [shared, setShared] = useState<Share[]>([])
  const [error, setError] = useState<string | null>(null)
  const assistant = useAssistant()

  useEffect(() => {
    const fail = (e: Error) => setError(e.message)
    Promise.all([recentNotes(), pinnedNotes()])
      .then(([r, p]) => {
        setRecent(r)
        setPinned(p)
      })
      .catch(fail)
    upcomingEvents(4).then(setEvents).catch(fail)
    countDue().then(setDue).catch(fail)
    sharedWithMe(session?.user.email ?? '').then(setShared).catch(fail)
  }, [session])

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
              className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-l-md rounded-r-xl p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: n.color }}
            >
              <span className="absolute inset-y-0 left-2 w-1 bg-white/40" />
              <span className="ml-3 text-xs font-bold tracking-widest opacity-80">{n.code}</span>
              <span className="ml-3 mt-auto text-lg font-bold leading-tight">{n.name}</span>
              <span className="ml-3 mt-1 text-xs leading-snug opacity-85">{n.description}</span>
            </Link>
          ))}
        </div>

        <button
          onClick={() => assistant.setOpen(true)}
          className="mt-8 flex w-full items-center gap-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 p-4 text-left text-white shadow-sm transition hover:shadow-lg"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/20">
            <Sparkles size={22} />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">Asistente IA</span>
            <span className="block text-sm opacity-90">
              Resuelve dudas, explica código, crea tarjetas y tests desde tus apuntes. Ábrelo desde cualquier página con Ctrl+J.
            </span>
          </span>
        </button>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Link to="/calendario" className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
              <CalendarDays size={15} /> Próximos exámenes y entregas
            </h2>
            {events.length === 0 && <p className="mt-3 text-sm text-slate-500">Nada a la vista. Añade fechas en el calendario.</p>}
            <ul className="mt-2 space-y-1.5">
              {events.map((e) => {
                const nb = getNotebook(e.notebook ?? undefined)
                const soon = ['hoy', 'mañana'].includes(relativeDay(e.date))
                return (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: nb?.color ?? '#64748b' }} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-slate-500">{KIND_LABEL[e.kind]}:</span> {e.title}
                    </span>
                    <span className={`shrink-0 text-xs font-semibold ${soon ? 'text-red-600' : 'text-slate-500'}`}>{relativeDay(e.date)}</span>
                  </li>
                )
              })}
            </ul>
          </Link>
          <Link to="/repaso" className="flex flex-col rounded-xl border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
              <Layers size={15} /> Tarjetas de repaso
            </h2>
            <p className="mt-3 text-3xl font-bold">{due}</p>
            <p className="text-sm text-slate-500">{due === 1 ? 'tarjeta pendiente hoy' : 'tarjetas pendientes hoy'}</p>
          </Link>
        </div>

        {shared.length > 0 && (
          <section className="mt-10">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-slate-500">
              <Users size={14} /> Compartidos conmigo
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shared.map((s) => {
                const nb = getNotebook(s.notebook)
                return (
                  <Link
                    key={s.id}
                    to={`/s/${s.owner_id}/${s.notebook}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    <span className="grid h-10 w-8 shrink-0 place-items-center rounded-sm text-[10px] font-bold text-white" style={{ background: nb?.color }}>
                      {nb?.code}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{nb?.name}</span>
                      <span className="block truncate text-xs text-slate-500">de {s.owner_email} · {s.role}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {pinned.length > 0 && (
          <section className="mt-10">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-slate-500">
              <Pin size={14} /> Fijados
            </h2>
            <NoteCards notes={pinned} />
          </section>
        )}
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Recientes</h2>
          {recent.length === 0 && !error && (
            <p className="mt-3 text-sm text-slate-500">Aún no tienes apuntes. Entra en un cuaderno, crea un tema y empieza a escribir.</p>
          )}
          <NoteCards notes={recent} />
        </section>
      </div>
    </div>
  )
}
