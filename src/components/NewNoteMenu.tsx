import { FilePlus, LayoutTemplate, Plus } from 'lucide-react'
import type { Notebook } from '../data/notebooks'
import { templatesFor, type Template } from '../data/templates'
import { Menu, MenuItem, MenuLabel } from './ui'

export default function NewNoteMenu({
  notebook,
  onCreate,
  variant = 'inline',
}: {
  notebook: Notebook
  onCreate: (template: Template | null) => void
  variant?: 'inline' | 'button'
}) {
  const { specific, general } = templatesFor(notebook.slug)
  const className =
    variant === 'button'
      ? 'mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white'
      : 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'

  return (
    <Menu
      title="Nuevo apunte"
      className={className}
      style={variant === 'button' ? { background: notebook.color } : undefined}
      label={
        <span className="inline-flex items-center gap-2">
          <Plus size={14} /> Nuevo apunte
        </span>
      }
    >
      {(close) => {
        const pick = (t: Template | null) => {
          close()
          onCreate(t)
        }
        return (
          <>
            <MenuItem icon={<FilePlus size={15} />} onClick={() => pick(null)}>
              En blanco
            </MenuItem>
            {specific.length > 0 && <MenuLabel>Plantillas de {notebook.code}</MenuLabel>}
            {specific.map((t) => (
              <MenuItem key={t.id} icon={<LayoutTemplate size={15} />} hint={t.description} onClick={() => pick(t)}>
                {t.name}
              </MenuItem>
            ))}
            <MenuLabel>Generales</MenuLabel>
            {general.map((t) => (
              <MenuItem key={t.id} icon={<LayoutTemplate size={15} />} hint={t.description} onClick={() => pick(t)}>
                {t.name}
              </MenuItem>
            ))}
          </>
        )
      }}
    </Menu>
  )
}
