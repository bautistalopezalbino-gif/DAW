import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Check, Eraser, Highlighter, Minus, PenLine, Plus, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { CANVAS_WIDTH, hitsStroke, strokeColor, strokePath, type Stroke } from '../../lib/drawing'

type Tool = 'pen' | 'marker' | 'eraser'

const COLORS: [string, string][] = [
  ['ink', 'Tinta'],
  ['#e03131', 'Rojo'],
  ['#1971c2', 'Azul'],
  ['#2f9e44', 'Verde'],
  ['#f08c00', 'Naranja'],
  ['#9c36b5', 'Morado'],
]
const WIDTHS = [2, 4, 8]

export default function DrawingView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const saved = node.attrs.strokes as Stroke[]
  const height = node.attrs.height as number
  const [strokes, setStrokes] = useState<Stroke[]>(saved)
  const [editing, setEditing] = useState(saved.length === 0)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('ink')
  const [width, setWidth] = useState(4)
  const [current, setCurrent] = useState<Stroke | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const drawing = useRef<Stroke | null>(null)
  const erased = useRef(false)
  const strokesRef = useRef(saved)

  function setLocal(list: Stroke[]) {
    strokesRef.current = list
    setStrokes(list)
  }

  // Cambios externos (deshacer del editor, recarga)
  useEffect(() => setLocal(saved), [saved])

  const canEdit = editing && editor.isEditable

  function toCanvas(e: PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect()
    const scale = CANVAS_WIDTH / rect.width
    return [Math.round((e.clientX - rect.left) * scale * 10) / 10, Math.round((e.clientY - rect.top) * scale * 10) / 10]
  }

  function erase(x: number, y: number) {
    const list = strokesRef.current
    const rest = list.filter((s) => !hitsStroke(s, x, y, 6))
    if (rest.length !== list.length) {
      erased.current = true
      setLocal(rest)
    }
  }

  function onDown(e: PointerEvent<SVGSVGElement>) {
    if (!canEdit || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const [x, y] = toCanvas(e)
    if (tool === 'eraser') {
      erased.current = false
      drawing.current = { points: [], color: '', width: 0 }
      erase(x, y)
      return
    }
    const stroke: Stroke =
      tool === 'marker'
        ? { points: [x, y], color: color === 'ink' ? '#fcc419' : color, width: width * 4, opacity: 0.35 }
        : { points: [x, y], color, width }
    drawing.current = stroke
    setCurrent(stroke)
  }

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const d = drawing.current
    if (!d) return
    const [x, y] = toCanvas(e)
    if (tool === 'eraser') {
      erase(x, y)
      return
    }
    const p = d.points
    if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) < 1.5) return
    d.points = [...p, x, y]
    setCurrent({ ...d })
  }

  function onUp() {
    const d = drawing.current
    drawing.current = null
    if (!d) return
    if (tool === 'eraser') {
      if (erased.current) updateAttributes({ strokes: strokesRef.current })
      return
    }
    setCurrent(null)
    const next = [...strokesRef.current, d]
    setLocal(next)
    updateAttributes({ strokes: next })
  }

  function undo() {
    const next = strokesRef.current.slice(0, -1)
    setLocal(next)
    updateAttributes({ strokes: next })
  }

  function clear() {
    if (!strokes.length || !window.confirm('¿Borrar todo el dibujo?')) return
    setLocal([])
    updateAttributes({ strokes: [] })
  }

  function resize(delta: number) {
    updateAttributes({ height: Math.min(1600, Math.max(160, height + delta)) })
  }

  const all = current ? [...strokes, current] : strokes

  return (
    <NodeViewWrapper className="not-prose my-4" contentEditable={false}>
      <div
        className={`overflow-hidden rounded-lg border bg-white dark:bg-slate-900 ${
          canEdit ? 'border-[var(--nb-color)] shadow-sm' : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {canEdit ? (
            <>
              <ToolBtn title="Lápiz" active={tool === 'pen'} onClick={() => setTool('pen')}><PenLine size={15} /></ToolBtn>
              <ToolBtn title="Subrayador" active={tool === 'marker'} onClick={() => setTool('marker')}><Highlighter size={15} /></ToolBtn>
              <ToolBtn title="Borrador (toca un trazo)" active={tool === 'eraser'} onClick={() => setTool('eraser')}><Eraser size={15} /></ToolBtn>
              <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
              {COLORS.map(([c, label]) => (
                <button
                  key={c}
                  title={label}
                  onClick={() => {
                    setColor(c)
                    if (tool === 'eraser') setTool('pen')
                  }}
                  className={`h-5 w-5 rounded-full border-2 ${color === c ? 'border-slate-500 dark:border-slate-300' : 'border-transparent'}`}
                >
                  <span
                    className={`block h-full w-full rounded-full ${c === 'ink' ? 'bg-slate-900 dark:bg-slate-100' : ''}`}
                    style={c === 'ink' ? undefined : { background: c }}
                  />
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
              {WIDTHS.map((w) => (
                <ToolBtn key={w} title={`Grosor ${w}`} active={width === w} onClick={() => setWidth(w)}>
                  <span className="block rounded-full bg-current" style={{ width: w + 3, height: w + 3 }} />
                </ToolBtn>
              ))}
              <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
              <ToolBtn title="Deshacer trazo" onClick={undo} disabled={!strokes.length}><Undo2 size={15} /></ToolBtn>
              <ToolBtn title="Menos alto" onClick={() => resize(-120)}><Minus size={15} /></ToolBtn>
              <ToolBtn title="Más alto" onClick={() => resize(120)}><Plus size={15} /></ToolBtn>
              <ToolBtn title="Borrar todo el dibujo" onClick={clear}><Eraser size={15} className="text-red-500" /></ToolBtn>
              <div className="ml-auto flex items-center gap-1">
                <ToolBtn title="Eliminar bloque" onClick={() => window.confirm('¿Eliminar este dibujo?') && deleteNode()}><Trash2 size={15} /></ToolBtn>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                  <Check size={13} /> Listo
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="px-1 text-xs text-slate-500">Dibujo</span>
              {editor.isEditable && (
                <button onClick={() => setEditing(true)} className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">
                  <PenLine size={13} /> Editar dibujo
                </button>
              )}
            </>
          )}
        </div>
        <svg
          ref={svgRef}
          data-drawing-canvas=""
          viewBox={`0 0 ${CANVAS_WIDTH} ${height}`}
          className={`block w-full text-slate-900 dark:text-slate-100 ${canEdit ? (tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair') : ''}`}
          style={{ touchAction: canEdit ? 'none' : 'auto' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {canEdit && (
            <pattern id="drawing-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeOpacity="0.07" />
            </pattern>
          )}
          {canEdit && <rect width="100%" height="100%" fill="url(#drawing-grid)" />}
          {all.map((s, i) => (
            <path
              key={i}
              d={strokePath(s.points)}
              stroke={strokeColor(s.color)}
              strokeWidth={s.width}
              strokeOpacity={s.opacity ?? 1}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {!canEdit && strokes.length === 0 && (
            <text x={CANVAS_WIDTH / 2} y={height / 2} textAnchor="middle" fill="currentColor" opacity="0.35" fontSize="18">
              Dibujo vacío
            </text>
          )}
        </svg>
      </div>
    </NodeViewWrapper>
  )
}

function ToolBtn(props: { title: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      title={props.title}
      aria-label={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`grid h-7 w-7 place-items-center rounded-md disabled:opacity-30 ${
        props.active ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      {props.children}
    </button>
  )
}
