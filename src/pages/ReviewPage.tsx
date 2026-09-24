import { Layers, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAssistant } from '../components/assistant/AssistantProvider'
import CardDialog from '../components/CardDialog'
import ErrorBanner from '../components/ErrorBanner'
import { btnPrimary } from '../components/ui'
import { getNotebook, NOTEBOOKS, type NotebookSlug } from '../data/notebooks'
import { deleteCard, listCards, reviewCard, type Flashcard, type Grade } from '../lib/cards'
import { timeAgo } from '../lib/format'

type Tab = 'estudiar' | 'tarjetas'

const isDue = (c: Flashcard) => new Date(c.due_at).getTime() <= Date.now()

export default function ReviewPage() {
  const [cards, setCards] = useState<Flashcard[] | null>(null)
  const [filter, setFilter] = useState<NotebookSlug | ''>('')
  const [tab, setTab] = useState<Tab>('estudiar')
  const [queue, setQueue] = useState<Flashcard[]>([])
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [editing, setEditing] = useState<Flashcard | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const assistant = useAssistant()

  const load = useCallback(() => {
    listCards()
      .then(setCards)
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(load, [load])
  // Recarga al volver a la pestaña
  useEffect(() => {
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  const visible = useMemo(() => (cards ?? []).filter((c) => !filter || c.notebook === filter), [cards, filter])
  const dueCount = (slug?: NotebookSlug) => (cards ?? []).filter((c) => isDue(c) && (!slug || c.notebook === slug)).length

  function startSession() {
    setQueue(visible.filter(isDue).sort(() => Math.random() - 0.5))
    setRevealed(false)
    setReviewed(0)
  }
  // Nueva sesión al cargar las tarjetas o cambiar de cuaderno
  useEffect(startSession, [cards === null, filter])

  const current = queue[0]

  async function grade(g: Grade) {
    if (!current) return
    setRevealed(false)
    try {
      const updated = await reviewCard(current, g)
      setCards((list) => list?.map((c) => (c.id === updated.id ? updated : c)) ?? null)
      setQueue((q) => (g === 'again' ? [...q.slice(1), updated] : q.slice(1)))
      setReviewed((n) => n + 1)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Atajos: espacio muestra la respuesta; 1/2/3 califican
  useEffect(() => {
    if (tab !== 'estudiar') return
    const onKey = (e: KeyboardEvent) => {
      if (editing || (e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === ' ' && !revealed) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed && ['1', '2', '3'].includes(e.key)) {
        void grade((['again', 'good', 'easy'] as Grade[])[Number(e.key) - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function remove(c: Flashcard) {
    if (!window.confirm('¿Borrar esta tarjeta?')) return
    await deleteCard(c.id).catch((e: Error) => setError(e.message))
    setCards((list) => list?.filter((x) => x.id !== c.id) ?? null)
  }

  const nb = current ? getNotebook(current.notebook) : undefined

  return (
    <div className="h-full overflow-y-auto">
      <ErrorBanner error={error} />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex-1 text-2xl font-bold tracking-tight">Tarjetas de repaso</h1>
          <button
            onClick={() => assistant.openCards()}
            className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Sparkles size={16} /> Generar con IA
          </button>
          <button onClick={() => setEditing('new')} className={`${btnPrimary} flex items-center gap-1.5`}>
            <Plus size={16} /> Nueva tarjeta
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Repaso espaciado: las tarjetas que aciertas vuelven cada vez más tarde (1, 3, 7, 14, 30 días…).
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          <FilterChip active={!filter} onClick={() => setFilter('')} label="Todos" count={dueCount()} />
          {NOTEBOOKS.map((n) => (
            <FilterChip key={n.slug} active={filter === n.slug} onClick={() => setFilter(n.slug)} label={n.code} color={n.color} count={dueCount(n.slug)} />
          ))}
        </div>

        <div className="mt-5 flex gap-4 border-b border-slate-200 text-sm dark:border-slate-800">
          {(['estudiar', 'tarjetas'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-1 pb-2 font-medium ${tab === t ? 'border-blue-700 text-slate-900 dark:text-white' : 'border-transparent text-slate-500'}`}
            >
              {t === 'estudiar' ? 'Estudiar' : `Mis tarjetas (${visible.length})`}
            </button>
          ))}
        </div>

        {cards === null && !error && <p className="mt-6 text-sm text-slate-500">Cargando…</p>}

        {cards !== null && tab === 'estudiar' && (
          <div className="mt-6">
            {current ? (
              <>
                <p className="mb-2 text-xs text-slate-500">
                  Quedan {queue.length} · repasadas {reviewed}
                </p>
                <div
                  className="rounded-xl border border-slate-200 border-t-4 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  style={{ borderTopColor: nb?.color }}
                >
                  <p className="text-xs font-semibold" style={{ color: nb?.color }}>{nb?.name}</p>
                  <p className="mt-3 whitespace-pre-wrap text-xl font-medium">{current.front}</p>
                  {revealed ? (
                    <div className="mt-6 border-t border-dashed border-slate-200 pt-5 dark:border-slate-700">
                      <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{current.back || <i className="text-slate-400">(sin respuesta)</i>}</p>
                    </div>
                  ) : (
                    <button onClick={() => setRevealed(true)} className="mt-6 w-full rounded-lg border border-dashed border-slate-300 py-3 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                      Mostrar respuesta <kbd className="ml-1 text-xs">espacio</kbd>
                    </button>
                  )}
                </div>
                {revealed && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <GradeBtn onClick={() => grade('again')} className="bg-red-600 hover:bg-red-700" label="Otra vez" hint="1 · la repites hoy" />
                    <GradeBtn onClick={() => grade('good')} className="bg-blue-700 hover:bg-blue-800" label="Bien" hint="2" />
                    <GradeBtn onClick={() => grade('easy')} className="bg-green-600 hover:bg-green-700" label="Fácil" hint="3" />
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                <Layers size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="mt-3 font-medium">{reviewed ? '¡Repaso terminado por hoy! 🎉' : 'No tienes tarjetas pendientes.'}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {visible.length
                    ? 'Vuelve mañana para las siguientes.'
                    : 'Crea tarjetas aquí o desde un apunte: selecciona texto y en el menú «⋯» elige «Crear tarjeta de repaso».'}
                </p>
                {visible.length > 0 && (
                  <button
                    onClick={() => setQueue([...visible].sort(() => Math.random() - 0.5))}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <RotateCcw size={14} /> Repasar todas igualmente
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {cards !== null && tab === 'tarjetas' && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {visible.length === 0 && <p className="text-sm text-slate-500">No hay tarjetas en este cuaderno.</p>}
            {visible.map((c) => {
              const n = getNotebook(c.notebook)
              return (
                <div key={c.id} className="rounded-lg border border-l-4 border-slate-200 p-3 dark:border-slate-800" style={{ borderLeftColor: n?.color }}>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 whitespace-pre-wrap font-medium">{c.front}</p>
                    <button onClick={() => setEditing(c)} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Editar"><Pencil size={14} /></button>
                    <button onClick={() => remove(c)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" title="Borrar"><Trash2 size={14} /></button>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-slate-500">{c.back}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {n?.code} · nivel {c.box} · {isDue(c) ? 'pendiente' : `próximo repaso ${timeAgo(c.due_at)}`}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editing && (
        <CardDialog
          card={editing === 'new' ? undefined : editing}
          defaults={{ notebook: filter || 'pro' }}
          onClose={() => setEditing(null)}
          onSaved={(saved) =>
            setCards((list) => {
              const rest = (list ?? []).filter((c) => c.id !== saved.id)
              return [saved, ...rest]
            })
          }
        />
      )}
    </div>
  )
}

function FilterChip({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        active ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
      {count > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">{count}</span>}
    </button>
  )
}

function GradeBtn({ onClick, className, label, hint }: { onClick: () => void; className: string; label: string; hint: string }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-3 py-3 text-white ${className}`}>
      <span className="block font-semibold">{label}</span>
      <span className="block text-xs opacity-80">{hint}</span>
    </button>
  )
}
