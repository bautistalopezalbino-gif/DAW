import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userTags } from '../lib/api'
import { normalizeTag, SUGGESTED_TAGS, tagColor } from '../lib/tags'
import { TagChip } from './ui'

export default function TagBar({ tags, onChange, readOnly }: { tags: string[]; onChange: (tags: string[]) => void; readOnly?: boolean }) {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [known, setKnown] = useState<string[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    userTags()
      .then((r) => setKnown(r.map((t) => t.tag)))
      .catch(() => {})
  }, [])

  const suggestions = useMemo(() => {
    const q = normalizeTag(input)
    return [...new Set([...SUGGESTED_TAGS, ...known])].filter((t) => !tags.includes(t) && t.includes(q)).slice(0, 8)
  }, [input, known, tags])

  function add(raw: string) {
    const t = normalizeTag(raw)
    setInput('')
    if (!t || tags.includes(t)) return
    onChange([...tags, t])
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagChip
          key={t}
          tag={t}
          color={tagColor(t)}
          onClick={() => navigate(`/etiqueta/${encodeURIComponent(t)}`)}
          onRemove={readOnly ? undefined : () => onChange(tags.filter((x) => x !== t))}
        />
      ))}
      {!readOnly && (
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                add(input)
              } else if (e.key === 'Backspace' && !input && tags.length) {
                onChange(tags.slice(0, -1))
              }
            }}
            placeholder={tags.length ? '+ etiqueta' : '+ Añadir etiqueta (examen, duda…)'}
            className="w-44 bg-transparent px-1 py-0.5 text-xs text-slate-600 outline-none placeholder:text-slate-400 dark:text-slate-300"
          />
          {focused && suggestions.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-1 flex w-64 flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {suggestions.map((t) => (
                <button key={t} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(t)}>
                  <TagChip tag={t} color={tagColor(t)} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
