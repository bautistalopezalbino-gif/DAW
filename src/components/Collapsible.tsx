import { ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'

/** Recuerda (en este navegador) si una sección está plegada. */
export function useCollapsed(key: string): [boolean, () => void] {
  const storageKey = `plegado:${key}`
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  })
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(storageKey, c ? '0' : '1')
      } catch {
        // sin almacenamiento: no se recuerda
      }
      return !c
    })
  return [collapsed, toggle]
}

/** Título de sección con flecha para plegar/desplegar su contenido. */
export function CollapsibleHeading({
  collapsed,
  onToggle,
  children,
  count,
  className = 'px-2 pb-1 pt-4 text-[11px]',
}: {
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
  count?: number
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      title={collapsed ? 'Desplegar' : 'Minimizar'}
      className={`group flex w-full items-center gap-1 font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ${className}`}
    >
      <ChevronRight size={13} className={`shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
      <span className="flex items-center gap-1.5">{children}</span>
      {count !== undefined && <span className="ml-auto rounded-full bg-slate-200 px-1.5 text-[10px] font-medium normal-case text-slate-500 dark:bg-slate-800">{count}</span>}
    </button>
  )
}
