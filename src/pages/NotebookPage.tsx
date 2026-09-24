import { ArrowDown, ArrowUp, ChevronRight, FileText, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import ErrorBanner from '../components/ErrorBanner'
import NoteEditor from '../components/NoteEditor'
import { getNotebook } from '../data/notebooks'
import {
  createNote, createSection, deleteSection, listNotes, listSections, moveSection, renameSection,
  type NoteSummary, type Section,
} from '../lib/api'
import { timeAgo } from '../lib/format'

export default function NotebookPage() {
  const { slug, sectionId, noteId } = useParams()
  const notebook = getNotebook(slug)
  const navigate = useNavigate()
  const [sections, setSections] = useState<Section[] | null>(null)
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fail = (e: Error) => setError(e.message)

  useEffect(() => {
    if (!notebook) return
    setSections(null)
    setError(null)
    listSections(notebook.slug).then(setSections).catch(fail)
  }, [notebook])

  // Si no hay tema elegido, abre el primero
  useEffect(() => {
    if (sections && sections.length > 0 && !sectionId) {
      navigate(`/c/${slug}/${sections[0].id}`, { replace: true })
    }
  }, [sections, sectionId, slug, navigate])

  useEffect(() => {
    setNotes([])
    if (sectionId) listNotes(sectionId).then(setNotes).catch(fail)
  }, [sectionId])

  if (!notebook) return <Navigate to="/" replace />

  const base = `/c/${notebook.slug}`
  const current = sections?.find((s) => s.id === sectionId)

  async function addSection() {
    if (!notebook || !sections) return
    const position = sections.reduce((m, s) => Math.max(m, s.position), -1) + 1
    try {
      const s = await createSection(notebook.slug, `Tema ${sections.length + 1}`, position)
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

  async function removeSection(s: Section) {
    if (!window.confirm(`¿Borrar el tema «${s.title}» y todos sus apuntes? No se puede deshacer.`)) return
    try {
      await deleteSection(s.id)
      const rest = sections!.filter((x) => x.id !== s.id)
      setSections(rest)
      navigate(rest[0] ? `${base}/${rest[0].id}` : base)
    } catch (e) {
      fail(e as Error)
    }
  }

  async function addNote() {
    if (!sectionId) return
    try {
      const n = await createNote(sectionId)
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
    setNotes((list) => list.filter((n) => n.id !== id))
    navigate(`${base}/${sectionId}`)
  }

  return (
    <div className="flex h-full" style={{ '--nb-color': notebook.color } as CSSProperties}>
      {/* Panel de temas y apuntes */}
      <div
        className={`${noteId ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-slate-200 md:w-72 dark:border-slate-800`}
      >
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800" style={{ borderTop: `4px solid ${notebook.color}` }}>
          <p className="text-xs font-bold tracking-widest" style={{ color: notebook.color }}>{notebook.code}</p>
          <h1 className="text-lg font-bold leading-tight">{notebook.name}</h1>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <ErrorBanner error={error} />
          {sections === null && !error && <p className="p-2 text-sm text-slate-500">Cargando…</p>}
          {sections?.length === 0 && (
            <div className="p-4 text-center text-sm text-slate-500">
              <p>Este cuaderno aún no tiene temas.</p>
              <p className="mt-1">Crea uno por cada unidad didáctica.</p>
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
                      onDoubleClick={() => setEditingId(s.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-sm font-medium"
                    >
                      <ChevronRight size={14} className={`shrink-0 text-slate-400 transition ${active ? 'rotate-90' : ''}`} />
                      <span className="truncate">{s.title}</span>
                    </Link>
                  )}
                  {editingId !== s.id && (
                    <div className={`${active ? 'flex' : 'hidden group-hover:flex'} shrink-0 items-center text-slate-400`}>
                      <IconBtn title="Renombrar" onClick={() => setEditingId(s.id)}><Pencil size={13} /></IconBtn>
                      <IconBtn title="Subir" onClick={() => move(i, -1)}><ArrowUp size={13} /></IconBtn>
                      <IconBtn title="Bajar" onClick={() => move(i, 1)}><ArrowDown size={13} /></IconBtn>
                      <IconBtn title="Borrar tema" onClick={() => removeSection(s)}><Trash2 size={13} /></IconBtn>
                    </div>
                  )}
                </div>

                {active && (
                  <div className="ml-4 mt-0.5 border-l border-slate-200 pl-2 dark:border-slate-700">
                    {notes.map((n) => (
                      <Link
                        key={n.id}
                        to={`${base}/${s.id}/${n.id}`}
                        className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${
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
                          <span className="block text-xs text-slate-400">{timeAgo(n.updated_at)}</span>
                        </span>
                      </Link>
                    ))}
                    <button
                      onClick={addNote}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <Plus size={14} /> Nuevo apunte
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

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
      </div>

      {/* Editor */}
      <div className={`${noteId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1`}>
        {noteId ? (
          <NoteEditor
            key={noteId}
            noteId={noteId}
            notebook={notebook}
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
                <p>Elige un apunte de «{current.title}» o crea uno nuevo.</p>
                <button onClick={addNote} className="mt-4 rounded-md px-4 py-2 font-medium text-white" style={{ background: notebook.color }}>
                  Nuevo apunte
                </button>
              </>
            ) : (
              <p>Crea un tema para empezar a escribir en este cuaderno.</p>
            )}
          </div>
        )}
      </div>
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
