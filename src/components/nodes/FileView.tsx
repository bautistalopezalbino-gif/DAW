import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Download, Eye, EyeOff, FileText, Paperclip } from 'lucide-react'
import { useState } from 'react'
import { formatSize, signedUrl } from '../../lib/storage'

export default function FileView({ node, selected }: NodeViewProps) {
  const { path, name, size, mime } = node.attrs as { path: string; name: string; size: number; mime: string }
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isPdf = mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')

  async function open() {
    try {
      window.open(await signedUrl(path), '_blank', 'noopener')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function togglePreview() {
    if (preview) return setPreview(null)
    try {
      setPreview(await signedUrl(path))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <NodeViewWrapper className="not-prose my-3" data-drag-handle>
      <div
        className={`overflow-hidden rounded-lg border bg-slate-50 dark:bg-slate-900 ${
          selected ? 'border-[var(--nb-color)]' : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          {isPdf ? <FileText size={22} className="shrink-0 text-red-600" /> : <Paperclip size={20} className="shrink-0 text-slate-500" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="text-xs text-slate-500">{formatSize(size)}{error && <span className="text-red-600"> · {error}</span>}</div>
          </div>
          {isPdf && (
            <button onClick={togglePreview} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
              {preview ? <EyeOff size={14} /> : <Eye size={14} />} {preview ? 'Ocultar' : 'Ver'}
            </button>
          )}
          <button onClick={open} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
            <Download size={14} /> Abrir
          </button>
        </div>
        {preview && <iframe src={preview} title={name} className="h-[70vh] w-full border-t border-slate-200 bg-white dark:border-slate-700" />}
      </div>
    </NodeViewWrapper>
  )
}
