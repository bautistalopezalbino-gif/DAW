import { FileDown } from 'lucide-react'
import { useState } from 'react'
import type { Notebook } from '../data/notebooks'
import type { Section } from '../lib/api'
import { btnGhost, btnPrimary, Modal } from './ui'

/** Elegir qué temas (unidades) del cuaderno se exportan juntos a PDF. */
export default function ExportPdfDialog({ notebook, sections, onClose }: { notebook: Notebook; sections: Section[]; onClose: () => void }) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(sections.map((s) => s.id)))
  const all = chosen.size === sections.length

  function toggle(id: string) {
    setChosen((set) => {
      const next = new Set(set)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exportPdf() {
    const ids = sections.filter((s) => chosen.has(s.id)).map((s) => s.id)
    if (!ids.length) return
    window.open(`/imprimir/${ids.length === 1 ? 'tema' : 'temas'}/${ids.join(',')}`, '_blank')
    onClose()
  }

  return (
    <Modal title={`Exportar «${notebook.name}» a PDF`} onClose={onClose}>
      {sections.length === 0 ? (
        <p className="text-sm text-slate-500">Este cuaderno aún no tiene temas.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            Marca las unidades que quieres en el PDF. Cada una empieza en una página nueva y, si eliges varias, se añade un índice.
          </p>
          <label className="flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-medium dark:border-slate-800">
            <input type="checkbox" checked={all} onChange={() => setChosen(all ? new Set() : new Set(sections.map((s) => s.id)))} />
            Todo el cuaderno ({sections.length} temas)
          </label>
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {sections.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" checked={chosen.has(s.id)} onChange={() => toggle(s.id)} />
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: notebook.color }} />
                  {s.title}
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Se abrirá el diálogo de impresión: elige <b>«Guardar como PDF»</b> como impresora.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onClose} className={btnGhost}>Cancelar</button>
            <button onClick={exportPdf} disabled={!chosen.size} className={`${btnPrimary} flex items-center gap-2`}>
              <FileDown size={15} /> Crear PDF ({chosen.size})
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
