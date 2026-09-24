import { Tag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ErrorBanner from '../components/ErrorBanner'
import NoteCards from '../components/NoteCards'
import { notesByTag, userTags, type NoteWithPlace } from '../lib/api'
import { tagColor } from '../lib/tags'

export default function TagPage() {
  const { tag } = useParams()
  const [tags, setTags] = useState<{ tag: string; uses: number }[]>([])
  const [notes, setNotes] = useState<NoteWithPlace[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    userTags()
      .then(setTags)
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    setNotes(null)
    if (tag) notesByTag(tag).then(setNotes).catch((e: Error) => setError(e.message))
  }, [tag])

  return (
    <div className="h-full overflow-y-auto">
      <ErrorBanner error={error} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Tag size={22} /> {tag ? <span style={{ color: tagColor(tag) }}>#{tag}</span> : 'Etiquetas'}
        </h1>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Link
              key={t.tag}
              to={`/etiqueta/${encodeURIComponent(t.tag)}`}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${t.tag === tag ? 'ring-2 ring-current' : ''}`}
              style={{ color: tagColor(t.tag), background: `color-mix(in srgb, ${tagColor(t.tag)} 14%, transparent)` }}
            >
              #{t.tag} <span className="opacity-60">{t.uses}</span>
            </Link>
          ))}
          {tags.length === 0 && !error && (
            <p className="text-sm text-slate-500">Aún no has etiquetado apuntes. Dentro de un apunte, añade etiquetas debajo del título.</p>
          )}
        </div>
        {tag && notes === null && !error && <p className="mt-6 text-sm text-slate-500">Cargando…</p>}
        {notes && notes.length === 0 && <p className="mt-6 text-sm text-slate-500">No hay apuntes con esta etiqueta.</p>}
        {notes && <NoteCards notes={notes} />}
      </div>
    </div>
  )
}
