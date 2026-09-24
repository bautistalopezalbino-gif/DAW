import { isChangeOrigin } from '@tiptap/extension-collaboration'
import { EditorContent, useEditor } from '@tiptap/react'
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap'
import {
  ArrowLeft, Eye, FileDown, FileText, Layers, MoreHorizontal, Pin, PinOff, Printer, Trash2, Wifi,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import type { Notebook } from '../data/notebooks'
import {
  deleteNote, getNote, getNoteYdoc, updateNote, type Note, type NotePatch, type NoteSummary, type Role,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { createNoteDoc, DB_ORIGIN, FIELD, fromBase64, SupabaseProvider, toBase64, userFor } from '../lib/collab'
import { docToMarkdown, docToText, resolveUrls } from '../lib/docExport'
import { downloadFile, slugify } from '../lib/download'
import { createEditorExtensions } from '../lib/editorExtensions'
import { removeNoteFiles, uploadFile, type NoteLocation } from '../lib/storage'
import { TAGS_CHANGED } from '../lib/tags'
import CardDialog from './CardDialog'
import Presence from './Presence'
import TagBar from './TagBar'
import Toolbar from './Toolbar'
import { Menu, MenuItem } from './ui'

interface Props {
  noteId: string
  notebook: Notebook
  ownerId: string
  role: Role
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
  return <CollabSession {...props} note={note} />
}

interface Collab {
  doc: Y.Doc
  provider: SupabaseProvider
}

/** Crea el documento Yjs y la conexión en tiempo real del apunte. */
function CollabSession(props: Props & { note: Note }) {
  const { note, role } = props
  const [collab, setCollab] = useState<Collab | null>(null)

  useEffect(() => {
    const doc = createNoteDoc(note.ydoc, note.content)
    const provider = new SupabaseProvider(note.id, doc, role !== 'lector')
    setCollab({ doc, provider })
    return () => {
      provider.destroy()
      doc.destroy()
    }
  }, [note, role])

  if (!collab) return <p className="p-6 text-sm text-slate-500">Conectando…</p>
  return <EditorInner key={collab.doc.guid} {...props} collab={collab} />
}

type Pending = Partial<Pick<NotePatch, 'title' | 'tags' | 'pinned'>> & { content?: true }
type Status = 'saved' | 'saving' | 'unsaved' | 'error'

function EditorInner({
  note, notebook, ownerId, role, sectionTitle, onSaved, onDeleted, onBack, collab,
}: Props & { note: Note; collab: Collab }) {
  const { session } = useAuth()
  const email = session?.user.email ?? 'anónimo'
  const canWrite = role !== 'lector'
  const { doc, provider } = collab
  const [title, setTitle] = useState(note.title)
  const [tags, setTags] = useState<string[]>(note.tags ?? [])
  const [pinned, setPinned] = useState(note.pinned)
  const [status, setStatus] = useState<Status>('saved')
  const [uploading, setUploading] = useState(0)
  const [cardText, setCardText] = useState<string | null>(null)
  const pending = useRef<Pending>({})
  const timer = useRef<number | undefined>(undefined)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const alive = useRef(true)
  const docAlive = useRef(true)
  const titleRef = useRef<HTMLInputElement>(null)
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const loc: NoteLocation = useMemo(() => ({ ownerId, notebook: notebook.slug, noteId: note.id }), [ownerId, notebook.slug, note.id])

  useEffect(() => {
    const off = () => (docAlive.current = false)
    doc.on('destroy', off)
    return () => doc.off('destroy', off)
  }, [doc])

  /**
   * Fusiona el estado local con el guardado en la base de datos (CRDT) antes de escribir,
   * para no pisar cambios de otra persona aunque no hayan llegado por tiempo real.
   */
  const mergedContent = useCallback(
    async (localState: Uint8Array): Promise<NotePatch> => {
      const remote = await getNoteYdoc(note.id)
      const tmp = new Y.Doc()
      Y.applyUpdate(tmp, localState)
      if (remote) {
        const remoteState = fromBase64(remote)
        Y.applyUpdate(tmp, remoteState)
        if (docAlive.current) Y.applyUpdate(doc, remoteState, DB_ORIGIN)
      }
      const content = yXmlFragmentToProsemirrorJSON(tmp.getXmlFragment(FIELD))
      const ydoc = toBase64(Y.encodeStateAsUpdate(tmp))
      tmp.destroy()
      return { content, content_text: docToText(content), ydoc }
    },
    [doc, note.id],
  )

  // Guarda lo pendiente; las llamadas se encadenan para no pisarse entre sí
  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    const patch = pending.current
    if (Object.keys(patch).length === 0) return chain.current
    pending.current = {}
    const localState = patch.content ? Y.encodeStateAsUpdate(doc) : null
    chain.current = chain.current.then(async () => {
      setStatus('saving')
      try {
        const { content: _dirty, ...fields } = patch
        const body: NotePatch = { ...fields }
        if (localState) Object.assign(body, await mergedContent(localState))
        const saved = await updateNote(note.id, body)
        onSavedRef.current(saved)
        if (fields.tags) window.dispatchEvent(new Event(TAGS_CHANGED))
        setStatus(Object.keys(pending.current).length ? 'unsaved' : 'saved')
      } catch {
        pending.current = { ...patch, ...pending.current }
        setStatus('error')
        if (alive.current) timer.current = window.setTimeout(flush, 5000)
      }
    })
    return chain.current
  }, [doc, note.id, mergedContent])

  const schedule = useCallback(
    (patch: Pending, delay = 800) => {
      if (!canWrite) return
      Object.assign(pending.current, patch)
      setStatus('unsaved')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, delay)
    },
    [flush, canWrite],
  )

  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  const handleFiles = useCallback(
    async (files: File[], pos: number | null) => {
      for (const file of files) {
        setUploading((n) => n + 1)
        try {
          const up = await uploadFile(file, loc)
          const node = file.type.startsWith('image/')
            ? { type: 'image', attrs: { path: up.path, alt: file.name } }
            : { type: 'fileAttachment', attrs: { path: up.path, name: up.name, size: up.size, mime: up.mime } }
          const ed = editorRef.current
          if (!ed) continue
          if (pos !== null) ed.chain().focus().insertContentAt(pos, node).run()
          else ed.chain().focus().insertBlock(node).run()
        } catch (e) {
          window.alert(`No se pudo subir «${file.name}»: ${(e as Error).message}`)
        } finally {
          setUploading((n) => n - 1)
        }
      }
    },
    [loc],
  )

  const user = useMemo(() => userFor(email), [email])
  const extensions = useMemo(
    () => createEditorExtensions((files, pos) => void handleFiles(files, pos), { doc, provider, user, field: FIELD }),
    [doc, provider, user, handleFiles],
  )

  const editor = useEditor(
    {
      extensions,
      editable: canWrite,
      editorProps: {
        attributes: {
          class: 'tiptap prose prose-slate max-w-none dark:prose-invert prose-pre:p-0 prose-headings:tracking-tight',
        },
      },
      // Solo guarda quien hace el cambio; los cambios que llegan de otras personas no se reenvían
      onUpdate: ({ transaction }) => {
        if (!isChangeOrigin(transaction)) schedule({ content: true })
      },
    },
    [extensions],
  )
  editorRef.current = editor

  // Título en tiempo real
  useEffect(
    () =>
      provider.onMeta((meta) => {
        if (meta.title !== undefined && document.activeElement !== titleRef.current) setTitle(meta.title)
      }),
    [provider],
  )

  // Guardar al salir del apunte o cerrar la pestaña
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        void flush()
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      alive.current = false
      void flush()
    }
  }, [flush])

  // Ctrl+S guarda al momento
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void flush()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flush])

  async function remove() {
    if (!window.confirm(`¿Borrar el apunte «${title || 'Sin título'}»? No se puede deshacer.`)) return
    pending.current = {}
    window.clearTimeout(timer.current)
    await removeNoteFiles(loc).catch(() => {})
    await deleteNote(note.id)
    onDeleted(note.id)
  }

  function togglePin() {
    setPinned(!pinned)
    schedule({ pinned: !pinned }, 0)
  }

  function changeTags(next: string[]) {
    setTags(next)
    schedule({ tags: next }, 0)
  }

  async function exportMarkdown() {
    if (!editor) return
    await flush()
    const json = editor.getJSON()
    const urls = await resolveUrls([json], 7 * 24 * 3600)
    const header = `# ${title || 'Sin título'}\n\n` + (tags.length ? tags.map((t) => `#${t}`).join(' ') + '\n\n' : '')
    downloadFile(`${slugify(title)}.md`, header + docToMarkdown(json, urls) + '\n', 'text/markdown')
  }

  async function print() {
    await flush()
    window.open(`/imprimir/apunte/${note.id}`, '_blank')
  }

  function newCard() {
    const sel = editor?.state.selection
    setCardText(sel && !sel.empty ? editor!.state.doc.textBetween(sel.from, sel.to, '\n') : '')
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
        <span className="min-w-0 truncate text-slate-500">
          <span className="font-medium" style={{ color: notebook.color }}>{notebook.code}</span>
          {sectionTitle && <> · {sectionTitle}</>}
        </span>
        {!canWrite && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Eye size={12} /> Solo lectura
          </span>
        )}
        <span className="ml-auto" />
        <Presence awareness={provider.awareness} />
        {uploading > 0 && <span className="shrink-0 text-xs text-slate-500">Subiendo {uploading}…</span>}
        {canWrite && (
          <span className={`hidden shrink-0 text-xs sm:inline ${status === 'error' ? 'text-red-600' : 'text-slate-400'}`}>
            {statusText[status]}
          </span>
        )}
        {canWrite && (
          <button
            onClick={togglePin}
            title={pinned ? 'Quitar de fijados' : 'Fijar'}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            style={pinned ? { color: notebook.color } : undefined}
          >
            {pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
        )}
        <Menu
          title="Más opciones"
          align="right"
          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          label={<MoreHorizontal size={16} />}
        >
          {(close) => (
            <>
              <MenuItem icon={<Layers size={15} />} hint="Usa el texto seleccionado como pregunta" onClick={() => (close(), newCard())}>
                Crear tarjeta de repaso
              </MenuItem>
              <MenuItem icon={<FileDown size={15} />} onClick={() => (close(), void exportMarkdown())}>
                Descargar como Markdown
              </MenuItem>
              <MenuItem icon={<Printer size={15} />} hint="Desde el diálogo de impresión, «Guardar como PDF»" onClick={() => (close(), void print())}>
                Imprimir / PDF
              </MenuItem>
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                <Wifi size={13} /> Edición en tiempo real activa
              </div>
              {canWrite && (
                <MenuItem icon={<Trash2 size={15} />} danger onClick={() => (close(), void remove())}>
                  Borrar apunte
                </MenuItem>
              )}
            </>
          )}
        </Menu>
      </div>

      {editor && canWrite && <Toolbar editor={editor} onPickFiles={(files) => void handleFiles(files, null)} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-8 sm:px-10">
          <input
            ref={titleRef}
            value={title}
            readOnly={!canWrite}
            onChange={(e) => {
              setTitle(e.target.value)
              schedule({ title: e.target.value })
              provider.sendMeta({ title: e.target.value })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                editor?.commands.focus('start')
              }
            }}
            placeholder="Título del apunte"
            className="mb-2 w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
          />
          <TagBar tags={tags} onChange={changeTags} readOnly={!canWrite} />
          <EditorContent editor={editor} />
          {editor?.isEmpty && !canWrite && (
            <p className="flex items-center gap-2 text-sm text-slate-400"><FileText size={15} /> Apunte vacío</p>
          )}
        </div>
      </div>

      {cardText !== null && (
        <CardDialog
          defaults={{ notebook: notebook.slug, front: cardText, note_id: note.id }}
          onClose={() => setCardText(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
