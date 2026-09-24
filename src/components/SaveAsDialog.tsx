import { Check, Download, FileCode2, FileText, FileType, Globe, Printer, Type } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import type { Notebook } from '../data/notebooks'
import type { Section } from '../lib/api'
import { slugify } from '../lib/download'
import { loadExport } from '../lib/exportData'
import { buildFile, FORMATS, pickSaveLocation, writeFile, type Format } from '../lib/saveAs'
import { btnGhost, btnPrimary, inputCls, Modal } from './ui'

type Scope = { kind: 'apunte'; noteId: string; title: string } | { kind: 'temas'; sections: Section[]; preselected: string[] }

const ICONS: Record<Format, ReactNode> = {
  pdf: <FileType size={18} className="text-red-600" />,
  doc: <FileText size={18} className="text-blue-600" />,
  md: <FileCode2 size={18} className="text-slate-600 dark:text-slate-300" />,
  html: <Globe size={18} className="text-orange-500" />,
  txt: <Type size={18} className="text-slate-500" />,
}

/** «Guardar como…»: elegir formato, nombre y (en un cuaderno) qué unidades incluir. */
export default function SaveAsDialog({ notebook, scope, onClose }: { notebook: Notebook; scope: Scope; onClose: () => void }) {
  const [format, setFormat] = useState<Format>('pdf')
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(scope.kind === 'temas' ? scope.preselected : []))
  const [status, setStatus] = useState<'idle' | 'working' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const sections = scope.kind === 'temas' ? scope.sections : []
  const selected = sections.filter((s) => chosen.has(s.id))
  const suggested = useMemo(() => {
    if (scope.kind === 'apunte') return scope.title || 'apunte'
    if (selected.length === 1) return selected[0].title
    return selected.length === sections.length ? notebook.name : `${notebook.name} (${selected.length} temas)`
  }, [scope, selected, sections.length, notebook.name])
  const [name, setName] = useState<string | null>(null)
  const baseName = name ?? suggested
  const ext = FORMATS.find((f) => f.id === format)!.ext
  const filename = `${slugify(baseName) || 'apuntes'}.${ext}`

  const target = (): [kind: 'apunte' | 'tema' | 'temas', id: string] | null => {
    if (scope.kind === 'apunte') return ['apunte', scope.noteId]
    if (!selected.length) return null
    return [selected.length === 1 ? 'tema' : 'temas', selected.map((s) => s.id).join(',')]
  }

  async function save() {
    const t = target()
    if (!t) return
    setError(null)
    // La ventana de «Guardar como» del sistema hay que pedirla justo al pulsar
    const handle = await pickSaveLocation(filename, format)
    if (handle === 'cancelled') return
    setStatus('working')
    try {
      const data = await loadExport(t[0], t[1], format !== 'txt')
      await writeFile(await buildFile(data, format), filename, handle)
      setStatus('done')
    } catch (e) {
      setError((e as Error).message)
      setStatus('idle')
    }
  }

  function print() {
    const t = target()
    if (t) window.open(`/imprimir/${t[0]}/${t[1]}`, '_blank')
  }

  function toggle(id: string) {
    setChosen((set) => {
      const next = new Set(set)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setStatus('idle')
  }

  const all = chosen.size === sections.length

  return (
    <Modal title="Guardar como…" onClose={onClose} wide>
      <div className="space-y-5">
        {scope.kind === 'temas' && (
          <div>
            <p className="mb-2 text-sm font-medium">Unidades de «{notebook.name}»</p>
            <label className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm dark:border-slate-800">
              <input type="checkbox" checked={all} onChange={() => setChosen(all ? new Set() : new Set(sections.map((s) => s.id)))} />
              Todo el cuaderno ({sections.length} temas)
            </label>
            <ul className="mt-1 grid max-h-40 gap-x-4 overflow-y-auto sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input type="checkbox" checked={chosen.has(s.id)} onChange={() => toggle(s.id)} />
                    <span className="truncate">{s.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">Formato</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFormat(f.id)
                  setStatus('idle')
                }}
                aria-pressed={format === f.id}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left ${
                  format === f.id ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 dark:bg-blue-950' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <span className="mt-0.5">{ICONS[f.id]}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {f.label} <span className="font-normal text-slate-400">.{f.ext}</span>
                  </span>
                  <span className="block text-xs text-slate-500">{f.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Nombre del archivo</span>
          <div className="mt-1 flex items-center gap-2">
            <input value={baseName} onChange={(e) => setName(e.target.value)} className={inputCls} />
            <span className="shrink-0 text-slate-400">.{ext}</span>
          </div>
        </label>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">No se pudo guardar: {error}</p>}
        {status === 'done' && (
          <p className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            <Check size={15} /> Guardado como <b>{filename}</b>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={print} disabled={!target()} className={`${btnGhost} flex items-center gap-1.5`} title="Abrir la vista de impresión">
            <Printer size={15} /> Imprimir
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className={btnGhost}>Cerrar</button>
          <button type="button" onClick={save} disabled={!target() || status === 'working'} className={`${btnPrimary} flex items-center gap-2`}>
            <Download size={15} /> {status === 'working' ? 'Preparando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
