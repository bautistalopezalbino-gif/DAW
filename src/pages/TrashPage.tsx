import { FileText, FolderOpen, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ErrorBanner from '../components/ErrorBanner'
import { getNotebook } from '../data/notebooks'
import {
  deleteNote, deleteSection, listTrash, notebookBase, restoreNote, restoreSection, sectionNoteIds, TRASH_DAYS,
  type TrashedNote, type TrashedSection,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { removeNoteFiles } from '../lib/storage'

const DAY = 24 * 3600 * 1000
const daysLeft = (deletedAt: string) => Math.max(0, Math.ceil(TRASH_DAYS - (Date.now() - new Date(deletedAt).getTime()) / DAY))
const expired = (deletedAt: string) => Date.now() - new Date(deletedAt).getTime() > TRASH_DAYS * DAY

/** Borra del todo un apunte y sus archivos. */
async function purgeNote(n: { id: string; user_id: string; notebook: string }) {
  await removeNoteFiles({ ownerId: n.user_id, notebook: n.notebook, noteId: n.id }).catch(() => {})
  await deleteNote(n.id)
}

/** Borra del todo un tema, sus apuntes y sus archivos. */
async function purgeSection(s: TrashedSection) {
  const ids = await sectionNoteIds(s.id)
  await Promise.all(ids.map((id) => removeNoteFiles({ ownerId: s.user_id, notebook: s.notebook, noteId: id }).catch(() => {})))
  await deleteSection(s.id)
}

export default function TrashPage() {
  const { session } = useAuth()
  const myId = session!.user.id
  const [notes, setNotes] = useState<TrashedNote[] | null>(null)
  const [sections, setSections] = useState<TrashedSection[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const t = await listTrash()
      // Lo que lleva más de 30 días se borra del todo
      const oldNotes = t.notes.filter((n) => expired(n.deleted_at))
      const oldSections = t.sections.filter((s) => expired(s.deleted_at))
      if (oldNotes.length || oldSections.length) {
        await Promise.all([
          ...oldNotes.map((n) => purgeNote({ ...n, notebook: n.sections?.notebook ?? '' }).catch(() => {})),
          ...oldSections.map((s) => purgeSection(s).catch(() => {})),
        ])
      }
      setNotes(t.notes.filter((n) => !expired(n.deleted_at)))
      setSections(t.sections.filter((s) => !expired(s.deleted_at)))
    } catch (e) {
      setError((e as Error).message)
      setNotes([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id)
    setError(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // Apuntes cuyo tema también está en la papelera: van dentro del tema
  const looseNotes = (notes ?? []).filter((n) => !n.sections?.deleted_at)
  const total = looseNotes.length + sections.length

  function emptyTrash() {
    if (!window.confirm(`¿Vaciar la papelera? Se borrarán para siempre ${total} elemento(s).`)) return
    void run('todo', async () => {
      await Promise.all([
        ...(notes ?? []).map((n) => purgeNote({ ...n, notebook: n.sections?.notebook ?? '' })),
        ...sections.map((s) => purgeSection(s)),
      ])
    })
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Trash2 size={22} /> Papelera</h1>
            <p className="mt-1 text-sm text-slate-500">
              Los apuntes y temas borrados se guardan {TRASH_DAYS} días. Después se borran para siempre.
            </p>
          </div>
          {total > 0 && (
            <button
              onClick={emptyTrash}
              disabled={busy !== null}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
            >
              Vaciar papelera
            </button>
          )}
        </div>

        <ErrorBanner error={error} />
        {notes === null && <p className="mt-6 text-sm text-slate-500">Cargando…</p>}
        {notes !== null && total === 0 && !error && (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <Trash2 size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-3 font-medium">La papelera está vacía</p>
            <p className="mt-1 text-sm text-slate-500">Cuando borres un apunte o un tema aparecerá aquí y podrás recuperarlo.</p>
          </div>
        )}

        {sections.length > 0 && (
          <Group title="Temas">
            {sections.map((s) => {
              const nb = getNotebook(s.notebook)
              const count = s.notes?.[0]?.count ?? 0
              return (
                <Row
                  key={s.id}
                  icon={<FolderOpen size={16} style={{ color: nb?.color }} />}
                  title={s.title}
                  detail={`${nb?.name ?? s.notebook} · ${count} apunte${count === 1 ? '' : 's'}`}
                  deletedAt={s.deleted_at}
                  busy={busy === s.id || busy === 'todo'}
                  onRestore={() => run(s.id, () => restoreSection(s.id))}
                  onPurge={() =>
                    window.confirm(`¿Borrar para siempre el tema «${s.title}» y sus ${count} apuntes?`) && void run(s.id, () => purgeSection(s))
                  }
                  link={`${notebookBase(s.notebook, s.user_id, myId)}/${s.id}`}
                />
              )
            })}
          </Group>
        )}

        {looseNotes.length > 0 && (
          <Group title="Apuntes">
            {looseNotes.map((n) => {
              const nb = getNotebook(n.sections?.notebook)
              return (
                <Row
                  key={n.id}
                  icon={<FileText size={16} style={{ color: nb?.color }} />}
                  title={n.title || 'Sin título'}
                  detail={`${nb?.name ?? ''} · ${n.sections?.title ?? ''}`}
                  deletedAt={n.deleted_at}
                  busy={busy === n.id || busy === 'todo'}
                  onRestore={() => run(n.id, () => restoreNote(n.id))}
                  onPurge={() =>
                    window.confirm(`¿Borrar para siempre «${n.title || 'Sin título'}»?`) &&
                    void run(n.id, () => purgeNote({ ...n, notebook: n.sections?.notebook ?? '' }))
                  }
                  link={n.sections ? `${notebookBase(n.sections.notebook, n.user_id, myId)}/${n.section_id}/${n.id}` : undefined}
                />
              )
            })}
          </Group>
        )}
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">{children}</div>
    </section>
  )
}

function Row(props: {
  icon: React.ReactNode
  title: string
  detail: string
  deletedAt: string
  busy: boolean
  onRestore: () => void
  onPurge: () => void
  link?: string
}) {
  const left = daysLeft(props.deletedAt)
  const [restored, setRestored] = useState(false)
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="shrink-0">{props.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{props.title}</p>
        <p className="truncate text-xs text-slate-500">
          {props.detail} · borrado {timeAgo(props.deletedAt)} ·{' '}
          <span className={left <= 3 ? 'text-red-600' : ''}>se borra en {left} día{left === 1 ? '' : 's'}</span>
        </p>
      </div>
      {restored && props.link ? (
        <Link to={props.link} className="text-xs font-medium text-violet-600 hover:underline">Abrir</Link>
      ) : (
        <button
          onClick={() => {
            setRestored(true)
            props.onRestore()
          }}
          disabled={props.busy}
          className="flex shrink-0 items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          <RotateCcw size={13} /> Restaurar
        </button>
      )}
      <button
        onClick={props.onPurge}
        disabled={props.busy}
        title="Borrar para siempre"
        aria-label={`Borrar para siempre ${props.title}`}
        className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
