import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotebook } from '../data/notebooks'
import { noteUrl, searchNotes, type NoteWithPlace } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function SearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NoteWithPlace[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { session } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      searchNotes(q)
        .then((r) => {
          if (!cancelled) {
            setResults(r)
            setActive(0)
            setError(null)
          }
        })
        .catch((e: Error) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setLoading(false))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  function open(n: NoteWithPlace) {
    navigate(noteUrl(n, session!.user.id))
    onClose()
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && results[active]) open(results[active])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-700">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar en todos los cuadernos…"
            className="w-full bg-transparent py-3.5 outline-none"
          />
          <kbd className="rounded border border-slate-200 px-1.5 text-[10px] text-slate-400 dark:border-slate-700">Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {error && <p className="p-4 text-sm text-red-600">{error}</p>}
          {!error && query.trim().length >= 2 && !loading && results.length === 0 && (
            <p className="p-4 text-sm text-slate-500">Sin resultados para «{query}».</p>
          )}
          {results.map((n, i) => {
            const nb = getNotebook(n.sections?.notebook)
            return (
              <button
                key={n.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => open(n)}
                className={`block w-full px-4 py-3 text-left ${i === active ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
              >
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: nb?.color }} />
                  {nb?.code} · {n.sections?.title}
                </div>
                <div className="mt-0.5 font-medium">{n.title || 'Sin título'}</div>
                <div className="mt-0.5 line-clamp-2 text-sm text-slate-500">{snippet(n.content_text, query)}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function snippet(text: string, query: string): string {
  const word = query.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  const i = text.toLowerCase().indexOf(word)
  if (i < 0) return text.slice(0, 160)
  const start = Math.max(0, i - 60)
  return (start > 0 ? '…' : '') + text.slice(start, start + 180)
}
