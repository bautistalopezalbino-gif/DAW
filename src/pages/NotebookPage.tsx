import { ArrowDown, ArrowUp, ChevronRight, FileDown, Headphones, FileQuestion, FileText, Layers, ListTree, Pencil, Pin, Plus, Printer, Sparkles, Trash2, Users } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAssistant } from '../components/assistant/AssistantProvider'
import { useAudioActions } from '../components/audio/AudioProvider'
import ErrorBanner from '../components/ErrorBanner'
import SaveAsDialog from '../components/SaveAsDialog'
import NewNoteMenu from '../components/NewNoteMenu'
import NoteEditor from '../components/NoteEditor'
import ShareDialog from '../components/ShareDialog'
import { Menu, MenuItem, TagChip } from '../components/ui'
import { getNotebook } from '../data/notebooks'
import type { Template } from '../data/templates'
import {
  createNote, createSection, listNotes, listSections, restoreNote, restoreSection, trashNote, trashSection, moveSection, notebookBase, renameSection,
  type NoteSummary, type Role, type Section,
} from '../lib/api'
import { sectionSegments, summarySegments } from '../lib/audioSources'
import { useAuth } from '../lib/auth'
import { usePanelsHidden } from '../lib/focusMode'
import { docToText } from '../lib/docExport'
import { timeAgo } from '../lib/format'
import { sharedWithMe } from '../lib/shares'
import { sectionSource } from '../lib/studySource'
import { tagColor } from '../lib/tags'

export default function NotebookPage() {
  const { ownerId: ownerParam, slug, sectionId, noteId } = useParams()
  const { session } = useAuth()
  const myId = session!.user.id
  const myEmail = session!.user.email ?? ''
  const ownerId = ownerParam ?? myId
  const isMine = ownerId === myId
  const notebook = getNotebook(slug)
  const navigate = useNavigate()
  const [role, setRole] = useState<Role | null | undefined>(isMine ? 'owner' : undefined)
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null)
  const [sections, setSections] = useState<Section[] | null>(null)
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [exporting, setExporting] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fail = (e: Error) => setError(e.message)
  const assistant = useAssistant()
  const audio = useAudioActions()
  const [panelsHidden] = usePanelsHidden()

  // Rol en el cuaderno: propio o compartido conmigo
  useEffect(() => {
    if (!notebook) return
    if (isMine) {
      setRole('owner')
      setOwnerEmail(null)
      return
    }
    setRole(undefined)
    sharedWithMe(myEmail)
      .then((shares) => {
        const s = shares.find((x) => x.owner_id === ownerId && x.notebook === notebook.slug)
        setRole(s?.role ?? null)
        setOwnerEmail(s?.owner_email ?? null)
      })
      .catch(fail)
  }, [notebook, isMine, ownerId, myEmail])

  useEffect(() => {
    if (!notebook || !role) return
    setSections(null)
    setError(null)
    listSections(notebook.slug, ownerId).then(setSections).catch(fail)
  }, [notebook, ownerId, role])

  const base = notebook ? notebookBase(notebook.slug, ownerId, myId) : '/'

  // Si no hay tema elegido, abre el primero
  useEffect(() => {
    if (sections && sections.length > 0 && !sectionId) navigate(`${base}/${sections[0].id}`, { replace: true })
  }, [sections, sectionId, base, navigate])

  useEffect(() => {
    setNotes([])
    if (sectionId && role) listNotes(sectionId).then(setNotes).catch(fail)
  }, [sectionId, role])

  if (!notebook) return <Navigate to="/" replace />
  if (role === null) {
    return (
      <div className="m-auto max-w-sm p-8 text-center text-sm text-slate-500">
        <p className="font-medium text-slate-700 dark:text-slate-300">No tienes acceso a este cuaderno.</p>
        <p className="mt-1">Puede que te hayan quitado el acceso. Pide a su propietario que te invite de nuevo.</p>
        <Link to="/" className="mt-4 inline-block text-blue-700 hover:underline dark:text-blue-400">Volver al inicio</Link>
      </div>
    )
  }

  const canWrite = role === 'owner' || role === 'editor'
  const current = sections?.find((s) => s.id === sectionId)

  async function addSection() {
    if (!notebook || !sections) return
    const position = sections.reduce((m, s) => Math.max(m, s.position), -1) + 1
    try {
      const s = await createSection(notebook.slug, ownerId, `Tema ${sections.length + 1}`, position)
      setSections([...sections, s])
      setEditingId(s.id)
      navigate(`${base}/${s.id}`)
    } catch (e) {
      fail(e as Error)
    }
  }

  async function saveTitle(s: Section, title: string) {
    setEditingId(null)
    const clean = title.trim()
    if (!clean || clean === s.title) return
    setSections((list) => list!.map((x) => (x.id === s.id ? { ...x, title: clean } : x)))
    await renameSection(s.id, clean).catch(fail)
  }

  async function move(index: number, dir: -1 | 1) {
    if (!sections) return
    const a = sections[index]
    const b = sections[index + dir]
    if (!b) return
    // Si las posiciones coinciden, normaliza antes de intercambiar
    const pa = a.position === b.position ? index : a.position
    const pb = a.position === b.position ? index + dir : b.position
    const next = [...sections]
    next[index] = { ...b, position: pa }
    next[index + dir] = { ...a, position: pb }
    setSections(next)
    await moveSection({ ...a, position: pa }, { ...b, position: pb }).catch(fail)
  }

  // Aviso «Enviado a la papelera · Deshacer»
  const [undo, setUndo] = useState<{ text: string; run: () => Promise<void> } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), 7000)
    return () => window.clearTimeout(t)
  }, [undo])

  function trashedNote(n: Pick<NoteSummary, 'id' | 'title'>) {
    setUndo({
      text: `«${n.title || 'Sin título'}» enviado a la papelera`,
      run: async () => {
        await restoreNote(n.id)
        if (sectionId) setNotes(await listNotes(sectionId))
      },
    })
  }

  async function removeNote(n: NoteSummary) {
    try {
      if (n.id === noteId) navigate(`${base}/${sectionId}`)
      await trashNote(n.id)
      setNotes((list) => list.filter((x) => x.id !== n.id))
      trashedNote(n)
    } catch (e) {
      fail(e as Error)
    }
  }

  async function removeSection(s: Section) {
    if (!window.confirm(`¿Enviar el tema «${s.title}» y sus apuntes a la papelera? Podrás recuperarlo durante 30 días.`)) return
    try {
      await trashSection(s.id)
      const rest = sections!.filter((x) => x.id !== s.id)
      setSections(rest)
      navigate(rest[0] ? `${base}/${rest[0].id}` : base)
      setUndo({
        text: `Tema «${s.title}» enviado a la papelera`,
        run: async () => {
          await restoreSection(s.id)
          setSections(await listSections(notebook!.slug, ownerId))
        },
      })
    } catch (e) {
      fail(e as Error)
    }
  }

  async function sectionAI(s: Section, action: 'cards' | 'quiz' | 'summary') {
    try {
      const src = await sectionSource(s.id)
      if (!src.text.trim()) return window.alert('Este tema no tiene apuntes con texto todavía.')
      if (action === 'cards') assistant.openCards({ ...src, noteId: null })
      else if (action === 'quiz') assistant.openQuiz({ ...src, noteId: null })
      else
        assistant.ask(
          `Haz un resumen de todo el tema «${src.title}» (${notebook!.name}) en forma de esquema, con los conceptos clave y lo más importante para el examen.\n\nApuntes del tema:\n${src.text.slice(0, 60000)}`,
          { label: `Resumir el tema «${src.title}»`, useNote: false },
        )
    } catch (e) {
      fail(e as Error)
    }
  }

  function listen(s: Section, summary: boolean) {
    const nb = notebook!
    if (!summary) return audio.playAsync(s.title, nb.name, () => sectionSegments(s.id, s.title, nb.slug))
    audio.playAsync(`Resumen: ${s.title}`, nb.name, async () => {
      const src = await sectionSource(s.id)
      if (!src.text.trim()) throw new Error('Este tema no tiene apuntes con texto todavía.')
      return summarySegments(`Tema: ${src.title}\n\n${src.text}`, nb.slug)
    })
  }

  async function addNote(template: Template | null) {
    if (!sectionId) return
    try {
      const init = template ? { title: template.title(), content: template.content() } : {}
      const n = await createNote(sectionId, init.content ? { ...init, content_text: docToText(init.content) } : init)
      setNotes((list) => [n, ...list])
      navigate(`${base}/${sectionId}/${n.id}`)
    } catch (e) {
      fail(e as Error)
    }
  }

  function onNoteSaved(saved: NoteSummary) {
    setNotes((list) =>
      list
        .map((n) => (n.id === saved.id ? saved : n))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at)),
    )
  }

  function onNoteDeleted(id: string) {
    const n = notes.find((x) => x.id === id)
    if (n) trashedNote(n)
    setNotes((list) => list.filter((n) => n.id !== id))
    navigate(`${base}/${sectionId}`)
  }

  return (
    <div className="flex h-full" style={{ '--nb-color': notebook.color } as CSSProperties}>
      {/* Panel de temas y apuntes */}
      <div
        className={`${noteId ? (panelsHidden ? 'hidden' : 'hidden md:flex') : 'flex'} w-full shrink-0 flex-col border-r border-slate-200 md:w-72 dark:border-slate-800`}
      >
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800" style={{ borderTop: `4px solid ${notebook.color}` }}>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-widest" style={{ color: notebook.color }}>{notebook.code}</p>
              <h1 className="text-lg font-bold leading-tight">{notebook.name}</h1>
            </div>
            <button
              onClick={() => setExporting(sections!.map((x) => x.id))}
              disabled={!sections?.length}
              title="Guardar como PDF, Word…"
              className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <FileDown size={14} /> Guardar
            </button>
            {isMine && (
              <button
                onClick={() => setSharing(true)}
                title="Compartir cuaderno"
                className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Users size={14} /> Compartir
              </button>
            )}
          </div>
          {!isMine && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
              <Users size={12} /> De {ownerEmail ?? '…'} · {role === 'lector' ? 'solo lectura' : 'puedes editar'}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <ErrorBanner error={error} />
          {(sections === null || role === undefined) && !error && <p className="p-2 text-sm text-slate-500">Cargando…</p>}
          {sections?.length === 0 && (
            <div className="p-4 text-center text-sm text-slate-500">
              <p>Este cuaderno aún no tiene temas.</p>
              {canWrite && <p className="mt-1">Crea uno por cada unidad didáctica.</p>}
            </div>
          )}

          {sections?.map((s, i) => {
            const active = s.id === sectionId
            return (
              <div key={s.id} className="mb-0.5">
                <div
                  className={`group flex items-center gap-1 rounded-md pr-1 ${
                    active ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  {editingId === s.id ? (
                    <input
                      autoFocus
                      defaultValue={s.title}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => saveTitle(s, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="m-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none dark:border-slate-600 dark:bg-slate-950"
                    />
                  ) : (
                    <Link
                      to={`${base}/${s.id}`}
                      onDoubleClick={() => canWrite && setEditingId(s.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-sm font-medium"
                    >
                      <ChevronRight size={14} className={`shrink-0 text-slate-400 transition ${active ? 'rotate-90' : ''}`} />
                      <span className="truncate">{s.title}</span>
                    </Link>
                  )}
                  {editingId !== s.id && (
                    <div className={`${active ? 'flex' : 'hidden group-hover:flex'} shrink-0 items-center text-slate-400`}>
                      <IconBtn title="Guardar este tema como…" onClick={() => setExporting([s.id])}>
                        <FileDown size={13} />
                      </IconBtn>
                      <Menu
                        title="Escuchar el tema"
                        align="right"
                        className="rounded p-1 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        label={<Headphones size={13} />}
                      >
                        {(close) => (
                          <>
                            <MenuItem icon={<Headphones size={15} />} hint="Todos los apuntes del tema, uno tras otro" onClick={() => (close(), listen(s, false))}>Escuchar el tema</MenuItem>
                            <MenuItem icon={<ListTree size={15} />} hint="La IA prepara un resumen hablado" onClick={() => (close(), listen(s, true))}>Resumen del tema en audio</MenuItem>
                          </>
                        )}
                      </Menu>
                      <Menu
                        title="IA y exportar"
                        align="right"
                        className="rounded p-1 text-violet-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                        label={<Sparkles size={13} />}
                      >
                        {(close) => (
                          <>
                            <MenuItem icon={<ListTree size={15} />} onClick={() => (close(), void sectionAI(s, 'summary'))}>Resumir el tema con IA</MenuItem>
                            <MenuItem icon={<Layers size={15} />} onClick={() => (close(), void sectionAI(s, 'cards'))}>Tarjetas del tema con IA</MenuItem>
                            <MenuItem icon={<FileQuestion size={15} />} onClick={() => (close(), void sectionAI(s, 'quiz'))}>Test del tema con IA</MenuItem>
                            <MenuItem icon={<Printer size={15} />} onClick={() => (close(), void window.open(`/imprimir/tema/${s.id}`, '_blank'))}>Imprimir / PDF del tema</MenuItem>
                          </>
                        )}
                      </Menu>
                    </div>
                  )}
                  {editingId !== s.id && canWrite && (
                    <div className={`${active ? 'flex' : 'hidden group-hover:flex'} shrink-0 items-center text-slate-400`}>
                      <IconBtn title="Renombrar" onClick={() => setEditingId(s.id)}><Pencil size={13} /></IconBtn>
                      <IconBtn title="Subir" onClick={() => move(i, -1)}><ArrowUp size={13} /></IconBtn>
                      <IconBtn title="Bajar" onClick={() => move(i, 1)}><ArrowDown size={13} /></IconBtn>
                      <IconBtn title="Enviar el tema a la papelera" onClick={() => removeSection(s)}><Trash2 size={13} /></IconBtn>
                    </div>
                  )}
                </div>

                {active && (
                  <div className="ml-4 mt-0.5 border-l border-slate-200 pl-2 dark:border-slate-700">
                    {notes.map((n) => (
                      <Link
                        key={n.id}
                        to={`${base}/${s.id}/${n.id}`}
                        className={`group/note flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${
                          n.id === noteId
                            ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'
                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
                        }`}
                      >
                        {n.pinned ? (
                          <Pin size={14} className="mt-0.5 shrink-0" style={{ color: notebook.color }} />
                        ) : (
                          <FileText size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{n.title || 'Sin título'}</span>
                          <span className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
                            {timeAgo(n.updated_at)}
                            {n.tags?.slice(0, 2).map((t) => <TagChip key={t} tag={t} color={tagColor(t)} />)}
                          </span>
                        </span>
                        {canWrite && (
                          <button
                            title="Enviar a la papelera"
                            aria-label={`Enviar a la papelera ${n.title || 'Sin título'}`}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              void removeNote(n)
                            }}
                            className={`shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 ${
                              n.id === noteId ? 'block' : 'block md:hidden md:group-hover/note:block'
                            }`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </Link>
                    ))}
                    {canWrite && <NewNoteMenu notebook={notebook} onCreate={addNote} />}
                    {!canWrite && notes.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">Sin apuntes</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {canWrite && (
          <div className="border-t border-slate-200 p-2 dark:border-slate-800">
            <button
              onClick={addSection}
              disabled={sections === null}
              className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: notebook.color }}
            >
              <Plus size={16} /> Nuevo tema
            </button>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className={`${noteId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1`}>
        {noteId && role ? (
          <NoteEditor
            key={noteId}
            noteId={noteId}
            notebook={notebook}
            ownerId={ownerId}
            role={role}
            sectionTitle={current?.title}
            onSaved={onNoteSaved}
            onDeleted={onNoteDeleted}
            onBack={() => navigate(`${base}/${sectionId}`)}
          />
        ) : (
          <div className="m-auto max-w-xs p-6 text-center text-sm text-slate-500">
            <FileText size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            {current ? (
              <>
                <p>{canWrite ? `Elige un apunte de «${current.title}» o crea uno nuevo.` : `Elige un apunte de «${current.title}».`}</p>
                {canWrite && <NewNoteMenu notebook={notebook} onCreate={addNote} variant="button" />}
              </>
            ) : (
              <p>{canWrite ? 'Crea un tema para empezar a escribir en este cuaderno.' : 'Este cuaderno todavía no tiene temas.'}</p>
            )}
          </div>
        )}
      </div>

      {exporting && sections && (
        <SaveAsDialog notebook={notebook} scope={{ kind: 'temas', sections, preselected: exporting }} onClose={() => setExporting(null)} />
      )}
      {sharing && <ShareDialog notebook={notebook} myId={myId} myEmail={myEmail} onClose={() => setSharing(false)} />}
      {undo && (
        <div role="status" className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl dark:bg-slate-100 dark:text-slate-900">
          <Trash2 size={15} className="shrink-0 opacity-70" />
          <span className="max-w-[60vw] truncate">{undo.text}</span>
          <button
            onClick={() => {
              const u = undo
              setUndo(null)
              u.run().catch(fail)
            }}
            className="font-semibold text-violet-300 hover:underline dark:text-violet-700"
          >
            Deshacer
          </button>
          <Link to="/papelera" className="text-slate-300 hover:underline dark:text-slate-600">Ver papelera</Link>
        </div>
      )}
    </div>
  )
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className="rounded p-1 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200">
      {children}
    </button>
  )
}
