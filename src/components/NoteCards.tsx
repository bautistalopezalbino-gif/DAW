import { Link } from 'react-router-dom'
import { getNotebook } from '../data/notebooks'
import { noteUrl, type NoteWithPlace } from '../lib/api'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { tagColor } from '../lib/tags'
import { TagChip } from './ui'

export default function NoteCards({ notes }: { notes: NoteWithPlace[] }) {
  const { session } = useAuth()
  const myId = session!.user.id
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((n) => {
        const nb = getNotebook(n.sections?.notebook)
        return (
          <Link
            key={n.id}
            to={noteUrl(n, myId)}
            className="rounded-lg border border-l-4 border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
            style={{ borderLeftColor: nb?.color }}
          >
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span className="truncate">{nb?.code} · {n.sections?.title}</span>
              {n.user_id !== myId && <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 text-[10px] dark:bg-slate-800">compartido</span>}
            </div>
            <div className="mt-0.5 truncate font-medium">{n.title || 'Sin título'}</div>
            <div className="mt-1 line-clamp-2 text-sm text-slate-500">{n.content_text || '—'}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-400">
              {timeAgo(n.updated_at)}
              {n.tags?.map((t) => <TagChip key={t} tag={t} color={tagColor(t)} />)}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
