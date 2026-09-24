import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { signedUrl } from '../../lib/storage'

const SIZES: [string, string, string][] = [
  ['s', 'S', '33%'],
  ['m', 'M', '50%'],
  ['l', 'L', '75%'],
  ['full', '100%', '100%'],
]

export default function ImageView({ node, selected, updateAttributes }: NodeViewProps) {
  const { src, path, alt, size } = node.attrs as { src: string | null; path: string | null; alt: string | null; size: string }
  const [url, setUrl] = useState<string | null>(path ? null : src)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    signedUrl(path)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [path])

  const width = SIZES.find(([k]) => k === size)?.[2] ?? '100%'

  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      <div className="relative mx-auto" style={{ width }}>
        {url && !failed ? (
          <img
            src={url}
            alt={alt ?? ''}
            draggable={false}
            onError={() => setFailed(true)}
            className={`block w-full rounded-lg ${selected ? 'ring-2 ring-[var(--nb-color)] ring-offset-2 dark:ring-offset-slate-950' : ''}`}
          />
        ) : (
          <div className="grid h-40 place-items-center rounded-lg bg-slate-100 text-sm text-slate-500 dark:bg-slate-800">
            {failed ? 'No se pudo cargar la imagen' : 'Cargando imagen…'}
          </div>
        )}
        {selected && (
          <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md bg-slate-900/80 p-1 text-xs text-white shadow">
            {SIZES.map(([key, label]) => (
              <button
                key={key}
                onClick={() => updateAttributes({ size: key })}
                className={`rounded px-1.5 py-0.5 ${size === key ? 'bg-white/25' : 'hover:bg-white/15'}`}
                title={`Tamaño ${label}`}
              >
                {label}
              </button>
            ))}
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="rounded p-1 hover:bg-white/15" title="Abrir a tamaño completo">
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
