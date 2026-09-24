import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export const inputCls =
  'w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700'

export const btnPrimary =
  'rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60'

export const btnGhost =
  'rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-[8vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Menú desplegable con posición fija (no lo recortan los paneles con scroll). */
export function Menu({
  label,
  title,
  className,
  style: btnStyle,
  align = 'left',
  children,
}: {
  label: ReactNode
  title?: string
  className?: string
  style?: CSSProperties
  align?: 'left' | 'right'
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const s: CSSProperties = { position: 'fixed', maxHeight: '70vh' }
    if (align === 'right') s.right = Math.max(8, window.innerWidth - r.right)
    else s.left = Math.min(r.left, window.innerWidth - 248)
    if (r.bottom + 340 > window.innerHeight && r.top > 340) s.bottom = window.innerHeight - r.top + 4
    else s.top = r.bottom + 4
    setStyle(s)
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button ref={btn} type="button" title={title} aria-label={title} aria-expanded={open} className={className} style={btnStyle} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <div
          ref={panel}
          style={style}
          className="z-40 w-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </>
  )
}

export function MenuItem({
  icon,
  children,
  hint,
  onClick,
  danger,
}: {
  icon?: ReactNode
  children: ReactNode
  hint?: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
        danger ? 'text-red-600' : ''
      }`}
    >
      {icon && <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>}
      <span className="min-w-0">
        <span className="block">{children}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</div>
}

export function TagChip({ tag, color, onRemove, onClick }: { tag: string; color: string; onRemove?: () => void; onClick?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      <button type="button" onClick={onClick} className={onClick ? 'hover:underline' : 'cursor-default'}>
        #{tag}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Quitar ${tag}`} className="rounded-full opacity-60 hover:opacity-100">
          <X size={11} />
        </button>
      )}
    </span>
  )
}
