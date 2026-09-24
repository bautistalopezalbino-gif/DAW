import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { ArrowLeft, Pin, PinOff, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Notebook } from '../data/notebooks'
import { deleteNote, getNote, updateNote, type Note, type NoteSummary } from '../lib/api'
import { editorExtensions } from '../lib/editorExtensions'
import Toolbar from './Toolbar'

interface Props {
  noteId: string
  notebook: Notebook
  sectionTitle?: string
  onSaved: (note: NoteSummary) => void
  onDeleted: (id: string) => void
  onBack: () => void
}

export default function NoteEditor(props: Props) {
  const [note, setNote] = useState<Note | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getNote(props.noteId)
      .then((n) => !cancelled && setNote(n))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [props.noteId])

  if (error) return <p className="p-6 text-sm text-red-600">No se pudo abrir el apunte: {error}</p>
  if (!note) return <p className="p-6 text-sm text-slate-500">Abriendo apunte…</p>
  return <EditorInner {...props} note={note} />
}

type Patch = Partial<{ title: string; content: JSONContent; content_text: string; pinned: boolean }>
type Status = 'saved' | 'saving' | 'unsaved' | 'error'

function EditorInner({ note, notebook, sectionTitle, onSaved, onDeleted, onBack }: Props & { note: Note }) {
  const [title, setTitle] = useState(note.title)
  const [pinned, setPinned] = useState(note.pinned)
  const [status, setStatus] = useState<Status>('saved')
  const pending = useRef<Patch>({})
  const timer = useRef<number | undefined>(undefined)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved

  // Guarda lo pendiente; las llamadas se encadenan para no pisarse entre sí
  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    chain.current = chain.current.then(async () => {
      const patch = pending.current
      if (Object.keys(patch).length === 0) return
      pending.current = {}
      setStatus('saving')
      try {
        const saved = await updateNote(note.id, patch)
        onSavedRef.current(saved)
        setStatus(Object.keys(pending.current).length ? 'unsaved' : 'saved')
      } catch {
        pending.current = { ...patch, ...pending.current }
        setStatus('error')
        timer.current = window.setTimeout(flush, 5000)
      }
    })
    return chain.current
  }, [note.id])

  const schedule = useCallback(
    (patch: Patch, delay = 800) => {
      Object.assign(pending.current, patch)
      setStatus('unsaved')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, delay)
    },
    [flush],
  )

  const editor = useEditor({
    extensions: editorExtensions,
    content: note.content ?? '',
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-slate max-w-none dark:prose-invert prose-pre:p-0 prose-headings:tracking-tight',
      },
    },
    onUpdate: ({ editor }) =>
      schedule({ content: editor.getJSON(), content_text: editor.getText({ blockSeparator: '\n' }) }),
  })

  // Guardar al salir del apunte o cerrar la pestaña
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        flush()
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      flush()
    }
  }, [flush])

  // Ctrl+S guarda al momento
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        flush()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flush])

  async function remove() {
    if (!window.confirm(`¿Borrar el apunte «${title || 'Sin título'}»? No se puede deshacer.`)) return
    pending.current = {}
    window.clearTimeout(timer.current)
    await deleteNote(note.id)
    onDeleted(note.id)
  }

  function togglePin() {
    setPinned(!pinned)
    schedule({ pinned: !pinned }, 0)
  }

  const statusText: Record<Status, string> = {
    saved: 'Guardado',
    saving: 'Guardando…',
    unsaved: 'Sin guardar',
    error: 'Error al guardar · reintentando',
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
        <button onClick={onBack} className="rounded p-1 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800" aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <span className="truncate text-slate-500">
          <span className="font-medium" style={{ color: notebook.color }}>{notebook.code}</span>
          {sectionTitle && <> · {sectionTitle}</>}
        </span>
        <span className={`ml-auto shrink-0 text-xs ${status === 'error' ? 'text-red-600' : 'text-slate-400'}`}>
          {statusText[status]}
        </span>
        <button
          onClick={togglePin}
          title={pinned ? 'Quitar de fijados' : 'Fijar'}
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          style={pinned ? { color: notebook.color } : undefined}
        >
          {pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
        <button onClick={remove} title="Borrar apunte" className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950">
          <Trash2 size={16} />
        </button>
      </div>

      {editor && <Toolbar editor={editor} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-8 sm:px-10">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              schedule({ title: e.target.value })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                editor?.commands.focus('start')
              }
            }}
            placeholder="Título del apunte"
            className="mb-4 w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
          />
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
