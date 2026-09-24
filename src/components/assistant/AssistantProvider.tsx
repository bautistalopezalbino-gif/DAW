import type { Editor } from '@tiptap/react'
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getNotebook, type Notebook, type NotebookSlug } from '../../data/notebooks'
import { AIError, clip, streamChat, SYSTEM_PROMPT, type ChatMessage } from '../../lib/ai'
import { noteUrl, searchNotes } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { markdownToHtml } from '../../lib/markdown'

const AssistantPanel = lazy(() => import('./AssistantPanel'))
const CardsGenerator = lazy(() => import('./CardsGenerator'))
const QuizModal = lazy(() => import('./QuizModal'))

/** El apunte abierto ahora mismo (lo registra el editor). */
export interface NoteContext {
  id: string
  title: string
  notebook: Notebook
  canWrite: boolean
  editor: Editor | null
  getText: () => string
}

/** Material de estudio para generar tarjetas o tests. */
export interface StudySource {
  title: string
  notebook: NotebookSlug
  text: string
  noteId?: string | null
}

export interface Range {
  from: number
  to: number
}

export interface Turn {
  id: number
  role: 'user' | 'model'
  text: string // lo que se envía / recibe
  label?: string // texto corto que se muestra en lugar del prompt completo
  range?: Range | null // selección del editor a la que se refiere
  sources?: { title: string; url: string }[]
  error?: string
  pending?: boolean
}

export interface AskOptions {
  label?: string
  useNote?: boolean
  searchNotes?: boolean
  range?: Range | null
}

interface AssistantApi {
  isOpen: boolean
  setOpen: (open: boolean) => void
  turns: Turn[]
  busy: boolean
  note: NoteContext | null
  useNote: boolean
  setUseNote: (v: boolean) => void
  useSearch: boolean
  setUseSearch: (v: boolean) => void
  ask: (prompt: string, opts?: AskOptions) => void
  stop: () => void
  reset: () => void
  setNote: (note: NoteContext | null) => void
  insertAnswer: (markdown: string, mode: 'replace' | 'below' | 'end', range?: Range | null) => void
  openCards: (source?: StudySource) => void
  openQuiz: (source: StudySource) => void
}

const AssistantContext = createContext<AssistantApi | null>(null)

export function useAssistant(): AssistantApi {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error('useAssistant fuera de AssistantProvider')
  return ctx
}

// Palabras significativas de la pregunta unidas con OR para la búsqueda de apuntes
function searchQuery(prompt: string): string {
  const words = prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
  return [...new Set(words)].slice(0, 12).join(' or ')
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const myId = session?.user.id ?? ''
  const [isOpen, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<NoteContext | null>(null)
  const [useNote, setUseNote] = useState(true)
  const [useSearch, setUseSearch] = useState(false)
  const [cards, setCards] = useState<{ source?: StudySource } | null>(null)
  const [quiz, setQuiz] = useState<StudySource | null>(null)
  const abort = useRef<AbortController | null>(null)
  const seq = useRef(0)
  const turnsRef = useRef<Turn[]>([])
  turnsRef.current = turns
  const noteRef = useRef<NoteContext | null>(null)
  noteRef.current = note

  // Ctrl+J abre y cierra el asistente
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const patchTurn = (id: number, patch: Partial<Turn>) =>
    setTurns((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const ask = useCallback(
    (prompt: string, opts: AskOptions = {}) => {
      const text = prompt.trim()
      if (!text || abort.current) return
      setOpen(true)
      const withNote = opts.useNote ?? useNote
      const withSearch = opts.searchNotes ?? useSearch
      const userTurn: Turn = { id: ++seq.current, role: 'user', text, label: opts.label, range: opts.range }
      const reply: Turn = { id: ++seq.current, role: 'model', text: '', pending: true, range: opts.range }
      const history: ChatMessage[] = turnsRef.current
        .filter((t) => !t.error && !t.pending && t.text)
        .map((t) => ({ role: t.role, text: t.text }))
      setTurns((list) => [...list, userTurn, reply])
      setBusy(true)
      const controller = new AbortController()
      abort.current = controller

      void (async () => {
        try {
          let system = SYSTEM_PROMPT
          const current = noteRef.current
          if (withNote && current) {
            system += `\n\nEl alumno tiene abierto el apunte «${current.title || 'Sin título'}» del módulo ${current.notebook.name}. Contenido:\n"""\n${clip(current.getText())}\n"""`
          }
          if (withSearch) {
            const q = searchQuery(text)
            const found = q ? (await searchNotes(q).catch(() => [])).slice(0, 5) : []
            if (found.length) {
              system += `\n\nApuntes del alumno que pueden estar relacionados (úsalos si sirven y di de cuál sale la información):\n${found
                .map((n) => `### ${n.title || 'Sin título'} (${getNotebook(n.sections?.notebook)?.name ?? ''} · ${n.sections?.title ?? ''})\n${clip(n.content_text, 6000)}`)
                .join('\n\n')}`
              patchTurn(reply.id, { sources: found.map((n) => ({ title: n.title || 'Sin título', url: noteUrl(n, myId) })) })
            }
          }
          const answer = await streamChat([...history, { role: 'user', text }], (partial) => patchTurn(reply.id, { text: partial }), {
            system,
            signal: controller.signal,
          })
          patchTurn(reply.id, { text: answer, pending: false, error: answer ? undefined : 'La IA no ha devuelto respuesta.' })
        } catch (e) {
          const aborted = (e as Error).name === 'AbortError'
          setTurns((list) =>
            list.map((t) =>
              t.id === reply.id
                ? { ...t, pending: false, error: aborted ? (t.text ? undefined : 'Cancelado.') : e instanceof AIError ? e.message : 'Algo ha fallado. Vuelve a intentarlo.' }
                : t,
            ),
          )
        } finally {
          abort.current = null
          setBusy(false)
        }
      })()
    },
    [useNote, useSearch, myId],
  )

  const stop = useCallback(() => abort.current?.abort(), [])

  const reset = useCallback(() => {
    abort.current?.abort()
    setTurns([])
  }, [])

  const insertAnswer = useCallback((markdown: string, mode: 'replace' | 'below' | 'end', range?: Range | null) => {
    const current = noteRef.current
    const ed = current?.editor
    if (!ed || !current.canWrite || ed.isDestroyed) return
    const html = markdownToHtml(markdown)
    const size = ed.state.doc.content.size
    if (mode === 'replace' && range && range.to <= size) {
      ed.chain().focus().insertContentAt(range, html).run()
      return
    }
    let pos = size
    if (mode === 'below' && range && range.to <= size) {
      const $to = ed.state.doc.resolve(range.to)
      pos = $to.depth > 0 ? $to.after(1) : range.to
    }
    ed.chain().focus().insertContentAt(pos, html).run()
  }, [])

  const api = useMemo<AssistantApi>(
    () => ({
      isOpen,
      setOpen,
      turns,
      busy,
      note,
      useNote,
      setUseNote,
      useSearch,
      setUseSearch,
      ask,
      stop,
      reset,
      setNote,
      insertAnswer,
      openCards: (source) => setCards({ source }),
      openQuiz: (source) => setQuiz(source),
    }),
    [isOpen, turns, busy, note, useNote, useSearch, ask, stop, reset, insertAnswer],
  )

  return (
    <AssistantContext.Provider value={api}>
      {children}
      <Suspense fallback={null}>
        {isOpen && <AssistantPanel />}
        {cards && <CardsGenerator source={cards.source} onClose={() => setCards(null)} />}
        {quiz && <QuizModal source={quiz} onClose={() => setQuiz(null)} />}
      </Suspense>
    </AssistantContext.Provider>
  )
}
