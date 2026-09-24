import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ErrorBanner from '../components/ErrorBanner'
import EventDialog from '../components/EventDialog'
import { btnPrimary } from '../components/ui'
import { getNotebook } from '../data/notebooks'
import { isoDate, KIND_LABEL, listEvents, relativeDay, upcomingEvents, type CalendarEvent } from '../lib/events'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function monthTitle(d: Date): string {
  const name = d.toLocaleDateString('es-ES', { month: 'long' })
  return `${name[0].toUpperCase()}${name.slice(1)} ${d.getFullYear()}`
}
const KIND_ICON = { examen: '📝', entrega: '📦', otro: '📌' }

export default function CalendarPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([])
  const [dialog, setDialog] = useState<{ event?: CalendarEvent; date?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Semanas de lunes a domingo que cubren el mes
  const days = useMemo(() => {
    const start = new Date(month)
    start.setDate(1 - ((month.getDay() + 6) % 7))
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    end.setDate(end.getDate() + ((7 - end.getDay()) % 7))
    const list: Date[] = []
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) list.push(new Date(d))
    return list
  }, [month])

  const load = useCallback(() => {
    Promise.all([listEvents(isoDate(days[0]), isoDate(days[days.length - 1])), upcomingEvents(10)])
      .then(([e, u]) => {
        setEvents(e)
        setUpcoming(u)
      })
      .catch((e: Error) => setError(e.message))
  }, [days])
  useEffect(load, [load])

  const today = isoDate(new Date())
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  return (
    <div className="h-full overflow-y-auto">
      <ErrorBanner error={error} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex-1 text-2xl font-bold tracking-tight">Calendario</h1>
          <button onClick={() => setDialog({ date: today })} className={`${btnPrimary} flex items-center gap-1.5`}>
            <Plus size={16} /> Examen o entrega
          </button>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <button onClick={() => shift(-1)} className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Mes anterior"><ChevronLeft size={18} /></button>
              <button onClick={() => shift(1)} className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Mes siguiente"><ChevronRight size={18} /></button>
              <h2 className="text-lg font-semibold">{monthTitle(month)}</h2>
              <button
                onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
                className="ml-auto rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Hoy
              </button>
            </div>
            <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 text-sm dark:border-slate-800">
              {WEEKDAYS.map((d) => (
                <div key={d} className="border-b border-slate-200 bg-slate-50 py-1.5 text-center text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  {d}
                </div>
              ))}
              {days.map((d) => {
                const iso = isoDate(d)
                const inMonth = d.getMonth() === month.getMonth()
                const dayEvents = events.filter((e) => e.date === iso)
                return (
                  <div
                    key={iso}
                    onClick={() => setDialog({ date: iso })}
                    className={`min-h-20 cursor-pointer border-b border-r border-slate-100 p-1 hover:bg-slate-50 sm:min-h-24 dark:border-slate-800 dark:hover:bg-slate-900 ${
                      inMonth ? '' : 'bg-slate-50/60 text-slate-400 dark:bg-slate-900/40'
                    }`}
                  >
                    <span
                      className={`mb-0.5 inline-grid h-6 w-6 place-items-center rounded-full text-xs ${
                        iso === today ? 'bg-blue-700 font-bold text-white' : ''
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <div className="space-y-0.5">
                      {dayEvents.map((e) => {
                        const nb = getNotebook(e.notebook ?? undefined)
                        return (
                          <button
                            key={e.id}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setDialog({ event: e })
                            }}
                            className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] font-medium text-white ${e.done ? 'opacity-50 line-through' : ''}`}
                            style={{ background: nb?.color ?? '#64748b' }}
                            title={`${KIND_LABEL[e.kind]}: ${e.title}`}
                          >
                            {KIND_ICON[e.kind]} {e.title}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Próximos</h2>
            {upcoming.length === 0 && <p className="mt-3 text-sm text-slate-500">Nada pendiente. Pulsa un día del calendario para añadir un examen o una entrega.</p>}
            <ul className="mt-3 space-y-2">
              {upcoming.map((e) => {
                const nb = getNotebook(e.notebook ?? undefined)
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => setDialog({ event: e })}
                      className="w-full rounded-lg border border-l-4 border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                      style={{ borderLeftColor: nb?.color ?? '#64748b' }}
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {KIND_ICON[e.kind]} {KIND_LABEL[e.kind]} {nb && `· ${nb.code}`}
                        <span className={`ml-auto font-semibold ${relativeDay(e.date) === 'hoy' || relativeDay(e.date) === 'mañana' ? 'text-red-600' : ''}`}>
                          {relativeDay(e.date)}
                        </span>
                      </div>
                      <div className="mt-0.5 font-medium">{e.title}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(e.date + 'T00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>
        </div>
      </div>

      {dialog && <EventDialog event={dialog.event} date={dialog.date} onClose={() => setDialog(null)} onChanged={load} />}
    </div>
  )
}
