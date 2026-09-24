import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  Check, Eraser, FoldHorizontal, FoldVertical, Highlighter, MoveHorizontal, PanelLeftClose, PanelLeftOpen, PenLine, Trash2,
  Type, Undo2, UnfoldHorizontal, UnfoldVertical,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import {
  baseline, CANVAS_WIDTH, DRAW_FONT, hitsStroke, LINE_HEIGHT, strokeColor, strokePath, TEXT_SIZES, type DrawingText, type Stroke,
} from '../../lib/drawing'
import { usePanelsHidden } from '../../lib/focusMode'

type Tool = 'pen' | 'marker' | 'text' | 'eraser'

const COLORS: [string, string][] = [
  ['ink', 'Tinta'],
  ['#e03131', 'Rojo'],
  ['#1971c2', 'Azul'],
  ['#2f9e44', 'Verde'],
  ['#f08c00', 'Naranja'],
  ['#9c36b5', 'Morado'],
]
const WIDTHS = [2, 4, 8]
const MIN_W = 300
const MAX_W = 3000
const MIN_H = 120
const MAX_H = 2400
const clamp = (v: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, v)))

interface Snapshot {
  strokes: Stroke[]
  texts: DrawingText[]
}

/** Texto que se está escribiendo (encima del dibujo, en un cuadro de texto). */
type Editing = DrawingText & { isNew: boolean }

export default function DrawingView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const saved = node.attrs.strokes as Stroke[]
  const savedTexts = (node.attrs.texts ?? []) as DrawingText[]
  const savedW = (node.attrs.width as number) || CANVAS_WIDTH
  const savedH = node.attrs.height as number
  const [strokes, setStrokes] = useState<Stroke[]>(saved)
  const [texts, setTexts] = useState<DrawingText[]>(savedTexts)
  const [size, setSize] = useState({ w: savedW, h: savedH })
  const [editing, setEditing] = useState(saved.length === 0 && savedTexts.length === 0)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('ink')
  const [width, setWidth] = useState(4)
  const [textSize, setTextSize] = useState(TEXT_SIZES[1])
  const [current, setCurrent] = useState<Stroke | null>(null)
  const [writing, setWriting] = useState<Editing | null>(null)
  const [scale, setScale] = useState(1)
  const [panelsHidden, setPanelsHidden] = usePanelsHidden()
  const svgRef = useRef<SVGSVGElement>(null)
  const drawing = useRef<Stroke | null>(null)
  const erased = useRef(false)
  const strokesRef = useRef(saved)
  const textsRef = useRef(savedTexts)
  const writingRef = useRef<Editing | null>(null)
  const history = useRef<Snapshot[]>([])
  const dragText = useRef<{ id: string; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null)
  const resizing = useRef<{ x: number; y: number; w: number; h: number; ratio: number; axis: 'x' | 'y' | 'xy' } | null>(null)
  const sizeRef = useRef(size)
  sizeRef.current = size

  function setLocal(list: Stroke[]) {
    strokesRef.current = list
    setStrokes(list)
  }
  function setLocalTexts(list: DrawingText[]) {
    textsRef.current = list
    setTexts(list)
  }

  // Cambios externos (deshacer del editor, otra persona editando, recarga)
  useEffect(() => setLocal(saved), [saved])
  useEffect(() => setLocalTexts((node.attrs.texts ?? []) as DrawingText[]), [node.attrs.texts])
  useEffect(() => setSize({ w: savedW, h: savedH }), [savedW, savedH])

  // Escala en pantalla (el lienzo se encoge si no cabe)
  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const update = () => setScale(el.getBoundingClientRect().width / sizeRef.current.w || 1)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [size.w])

  const canEdit = editing && editor.isEditable

  /** Guarda un cambio de trazos o textos (y permite deshacerlo). */
  function commit(next: Partial<Snapshot>) {
    history.current = [...history.current.slice(-49), { strokes: strokesRef.current, texts: textsRef.current }]
    if (next.strokes) setLocal(next.strokes)
    if (next.texts) setLocalTexts(next.texts)
    updateAttributes(next)
  }

  function toCanvas(e: { clientX: number; clientY: number }) {
    const rect = svgRef.current!.getBoundingClientRect()
    const k = sizeRef.current.w / rect.width
    return [Math.round((e.clientX - rect.left) * k * 10) / 10, Math.round((e.clientY - rect.top) * k * 10) / 10]
  }

  /** Texto que hay en ese punto (según lo que ocupa en pantalla). */
  function textAt(x: number, y: number, pad = 6): DrawingText | undefined {
    for (const t of [...textsRef.current].reverse()) {
      const el = svgRef.current?.querySelector<SVGTextElement>(`[data-text-id="${t.id}"]`)
      let box = { x: t.x, y: t.y, width: t.size * 0.6 * Math.max(...t.text.split('\n').map((l) => l.length)), height: t.size * LINE_HEIGHT * t.text.split('\n').length }
      try {
        if (el) box = el.getBBox()
      } catch {
        /* sin medidas (elemento oculto): se usa la aproximación */
      }
      if (x >= box.x - pad && x <= box.x + box.width + pad && y >= box.y - pad && y <= box.y + box.height + pad) return t
    }
  }

  function erase(x: number, y: number) {
    const list = strokesRef.current
    const rest = list.filter((s) => !hitsStroke(s, x, y, 6))
    const hit = textAt(x, y, 2)
    if (rest.length !== list.length || hit) {
      if (!erased.current) history.current = [...history.current.slice(-49), { strokes: list, texts: textsRef.current }]
      erased.current = true
      setLocal(rest)
      if (hit) setLocalTexts(textsRef.current.filter((t) => t.id !== hit.id))
    }
  }

  // ---------- Texto ----------

  function startWriting(t: Editing | null) {
    writingRef.current = t
    setWriting(t)
  }

  /** Termina el texto que se está escribiendo y lo guarda (si queda vacío, se quita). */
  function finishWriting() {
    const t = writingRef.current
    if (!t) return
    startWriting(null)
    const text = t.text.replace(/\s+$/, '')
    const exists = textsRef.current.some((x) => x.id === t.id)
    const item: DrawingText = { id: t.id, x: t.x, y: t.y, text, color: t.color, size: t.size }
    let next: DrawingText[]
    if (!text.trim()) {
      if (!exists) return
      next = textsRef.current.filter((x) => x.id !== t.id)
    } else if (exists) {
      const old = textsRef.current.find((x) => x.id === t.id)!
      if (old.text === text && old.color === t.color && old.size === t.size) return
      next = textsRef.current.map((x) => (x.id === t.id ? item : x))
    } else next = [...textsRef.current, item]
    commit({ texts: next })
  }

  function onDown(e: PointerEvent<SVGSVGElement>) {
    if (!canEdit || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.preventDefault()
    const [x, y] = toCanvas(e)
    if (tool === 'text') {
      finishWriting()
      const hit = textAt(x, y)
      if (hit) {
        // Arrastrar mueve el texto; un toque sin mover lo edita
        e.currentTarget.setPointerCapture(e.pointerId)
        dragText.current = { id: hit.id, dx: x - hit.x, dy: y - hit.y, sx: x, sy: y, moved: false }
        return
      }
      startWriting({ id: crypto.randomUUID(), x, y: Math.max(0, y - textSize * 0.65), text: '', color, size: textSize, isNew: true })
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
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
    const drag = dragText.current
    if (drag) {
      const [x, y] = toCanvas(e)
      if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) < 4) return
      if (!drag.moved) history.current = [...history.current.slice(-49), { strokes: strokesRef.current, texts: textsRef.current }]
      drag.moved = true
      setLocalTexts(textsRef.current.map((t) => (t.id === drag.id ? { ...t, x: x - drag.dx, y: y - drag.dy } : t)))
      return
    }
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
    const drag = dragText.current
    if (drag) {
      dragText.current = null
      if (drag.moved) updateAttributes({ texts: textsRef.current })
      else {
        const t = textsRef.current.find((x) => x.id === drag.id)
        if (t) startWriting({ ...t, isNew: false })
      }
      return
    }
    const d = drawing.current
    drawing.current = null
    if (!d) return
    if (tool === 'eraser') {
      if (erased.current) updateAttributes({ strokes: strokesRef.current, texts: textsRef.current })
      return
    }
    setCurrent(null)
    const next = [...strokesRef.current, d]
    history.current = [...history.current.slice(-49), { strokes: strokesRef.current, texts: textsRef.current }]
    setLocal(next)
    updateAttributes({ strokes: next })
  }

  function undo() {
    finishWriting()
    const prev = history.current.pop()
    if (prev) {
      setLocal(prev.strokes)
      setLocalTexts(prev.texts)
      updateAttributes({ strokes: prev.strokes, texts: prev.texts })
    } else if (strokesRef.current.length) {
      const next = strokesRef.current.slice(0, -1)
      setLocal(next)
      updateAttributes({ strokes: next })
    }
  }

  function clear() {
    if ((!strokes.length && !texts.length) || !window.confirm('¿Borrar todo el dibujo?')) return
    commit({ strokes: [], texts: [] })
  }

  // ---------- Tamaño ----------

  function resize(w: number, h: number) {
    const next = { w: clamp(w, MIN_W, MAX_W), h: clamp(h, MIN_H, MAX_H) }
    setSize(next)
    updateAttributes({ width: next.w, height: next.h })
  }

  /** Ancho disponible en pantalla (el del apunte, con los paneles como estén ahora). */
  function available() {
    const pane = svgRef.current?.closest('[data-editor-scroll]')
    return pane ? pane.clientWidth - 32 : size.w
  }

  function onResizeDown(axis: 'x' | 'y' | 'xy') {
    return (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      const rect = svgRef.current!.getBoundingClientRect()
      resizing.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h, ratio: size.w / rect.width, axis }
    }
  }
  function onResizeMove(e: PointerEvent<HTMLDivElement>) {
    const r = resizing.current
    if (!r) return
    setSize({
      w: r.axis === 'y' ? r.w : clamp(r.w + (e.clientX - r.x) * r.ratio, MIN_W, MAX_W),
      h: r.axis === 'x' ? r.h : clamp(r.h + (e.clientY - r.y) * r.ratio, MIN_H, MAX_H),
    })
  }
  function onResizeUp() {
    if (!resizing.current) return
    resizing.current = null
    updateAttributes({ width: sizeRef.current.w, height: sizeRef.current.h })
  }

  const all = current ? [...strokes, current] : strokes
  const selectTool = (t: Tool) => {
    if (t !== 'text') finishWriting()
    setTool(t)
  }
  const handle = { onPointerMove: onResizeMove, onPointerUp: onResizeUp, onPointerCancel: onResizeUp }

  // Se sale del ancho del texto (hasta el ancho del apunte) y se centra
  const wrapperStyle: CSSProperties = {
    width: `min(${size.w}px, calc(100cqw - 2rem))`,
    position: 'relative',
    left: '50%',
    transform: 'translateX(-50%)',
  }

  return (
    <NodeViewWrapper className="drawing-block not-prose my-4" style={wrapperStyle} contentEditable={false}>
      <div
        className={`rounded-lg border bg-white dark:bg-slate-900 ${
          canEdit ? 'border-[var(--nb-color)] shadow-sm' : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <div
          className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          // Pulsar la barra no quita el foco al texto que se está escribiendo (así se le puede cambiar el color o el tamaño)
          onMouseDown={(e) => writingRef.current && e.preventDefault()}
        >
          {canEdit ? (
            <>
              <ToolBtn title="Lápiz" active={tool === 'pen'} onClick={() => selectTool('pen')}><PenLine size={15} /></ToolBtn>
              <ToolBtn title="Subrayador" active={tool === 'marker'} onClick={() => selectTool('marker')}><Highlighter size={15} /></ToolBtn>
              <ToolBtn title="Texto (toca donde quieras escribir; arrastra un texto para moverlo)" active={tool === 'text'} onClick={() => selectTool('text')}>
                <Type size={15} />
              </ToolBtn>
              <ToolBtn title="Borrador (toca un trazo o un texto)" active={tool === 'eraser'} onClick={() => selectTool('eraser')}><Eraser size={15} /></ToolBtn>
              <Sep />
              {COLORS.map(([c, label]) => (
                <button
                  key={c}
                  title={label}
                  aria-label={label}
                  onClick={() => {
                    setColor(c)
                    if (tool === 'eraser') setTool('pen')
                    if (writingRef.current) startWriting({ ...writingRef.current, color: c })
                  }}
                  className={`h-5 w-5 rounded-full border-2 ${color === c ? 'border-slate-500 dark:border-slate-300' : 'border-transparent'}`}
                >
                  <span
                    className={`block h-full w-full rounded-full ${c === 'ink' ? 'bg-slate-900 dark:bg-slate-100' : ''}`}
                    style={c === 'ink' ? undefined : { background: c }}
                  />
                </button>
              ))}
              <Sep />
              {tool === 'text'
                ? TEXT_SIZES.map((s, i) => (
                    <ToolBtn
                      key={s}
                      title={['Texto pequeño', 'Texto mediano', 'Texto grande'][i]}
                      active={textSize === s}
                      onClick={() => {
                        setTextSize(s)
                        if (writingRef.current) startWriting({ ...writingRef.current, size: s })
                      }}
                    >
                      <span className="font-semibold leading-none" style={{ fontSize: 10 + i * 3 }}>A</span>
                    </ToolBtn>
                  ))
                : WIDTHS.map((w) => (
                    <ToolBtn key={w} title={`Grosor ${w}`} active={width === w} onClick={() => setWidth(w)}>
                      <span className="block rounded-full bg-current" style={{ width: w + 3, height: w + 3 }} />
                    </ToolBtn>
                  ))}
              <Sep />
              <ToolBtn title="Deshacer en el dibujo" onClick={undo} disabled={!strokes.length && !history.current.length}><Undo2 size={15} /></ToolBtn>
              <ToolBtn title="Borrar todo el dibujo" onClick={clear}><Eraser size={15} className="text-red-500" /></ToolBtn>
              <Sep />
              <ToolBtn title="Menos ancho" onClick={() => resize(size.w - 200, size.h)}><FoldHorizontal size={15} /></ToolBtn>
              <ToolBtn title="Más ancho" onClick={() => resize(size.w + 200, size.h)}><UnfoldHorizontal size={15} /></ToolBtn>
              <ToolBtn title="Menos alto" onClick={() => resize(size.w, size.h - 120)}><FoldVertical size={15} /></ToolBtn>
              <ToolBtn title="Más alto" onClick={() => resize(size.w, size.h + 120)}><UnfoldVertical size={15} /></ToolBtn>
              <ToolBtn title="Ocupar todo el ancho del apunte" onClick={() => resize(available(), size.h)}><MoveHorizontal size={15} /></ToolBtn>
              <ToolBtn
                title={panelsHidden ? 'Mostrar los paneles laterales' : 'Ocultar los paneles laterales (más espacio para dibujar)'}
                className="hidden md:grid"
                active={panelsHidden}
                onClick={() => setPanelsHidden(!panelsHidden)}
              >
                {panelsHidden ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              </ToolBtn>
              <div className="ml-auto flex items-center gap-1">
                <ToolBtn title="Eliminar bloque" onClick={() => window.confirm('¿Eliminar este dibujo?') && deleteNode()}><Trash2 size={15} /></ToolBtn>
                <button
                  onClick={() => {
                    finishWriting()
                    setEditing(false)
                  }}
                  className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                >
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

        <div className="relative overflow-hidden rounded-b-lg">
          <svg
            ref={svgRef}
            data-drawing-canvas=""
            viewBox={`0 0 ${size.w} ${size.h}`}
            className={`block w-full text-slate-900 dark:text-slate-100 ${
              canEdit ? (tool === 'eraser' ? 'cursor-cell' : tool === 'text' ? 'cursor-text' : 'cursor-crosshair') : ''
            }`}
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
            {texts
              .filter((t) => t.id !== writing?.id)
              .map((t) => (
                <text
                  key={t.id}
                  data-text-id={t.id}
                  fill={strokeColor(t.color)}
                  fontSize={t.size}
                  fontFamily={DRAW_FONT}
                  style={{ whiteSpace: 'pre', cursor: canEdit && tool === 'text' ? 'move' : undefined, userSelect: 'none' }}
                >
                  {t.text.split('\n').map((line, i) => (
                    <tspan key={i} x={t.x} y={baseline(t, i)}>{line}</tspan>
                  ))}
                </text>
              ))}
            {!canEdit && strokes.length === 0 && texts.length === 0 && (
              <text x={size.w / 2} y={size.h / 2} textAnchor="middle" fill="currentColor" opacity="0.35" fontSize="18">
                Dibujo vacío
              </text>
            )}
          </svg>

          {writing && (
            <TextBox
              value={writing}
              scale={scale}
              onChange={(text) => startWriting({ ...writing, text })}
              onDone={finishWriting}
            />
          )}

          {canEdit && (
            <>
              <div title="Arrastra para hacerlo más ancho" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize hover:bg-[var(--nb-color)]/20" onPointerDown={onResizeDown('x')} {...handle} />
              <div title="Arrastra para hacerlo más alto" className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize hover:bg-[var(--nb-color)]/20" onPointerDown={onResizeDown('y')} {...handle} />
              <div
                title="Arrastra para cambiar el tamaño"
                aria-label="Cambiar el tamaño del dibujo"
                className="absolute bottom-0 right-0 grid h-5 w-5 cursor-nwse-resize place-items-center rounded-tl-md bg-[var(--nb-color)] text-white opacity-80 hover:opacity-100"
                onPointerDown={onResizeDown('xy')}
                {...handle}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </>
          )}
        </div>
      </div>
      {canEdit && (
        <p className="mt-1 text-right text-[11px] text-slate-400">
          {size.w} × {size.h}
          {scale < 0.9 && ' · se ve reducido porque no cabe en pantalla'}
        </p>
      )}
    </NodeViewWrapper>
  )
}

/** Cuadro para escribir encima del dibujo, en la misma posición y tamaño que tendrá el texto. */
function TextBox({ value, scale, onChange, onDone }: { value: Editing; scale: number; onChange: (text: string) => void; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const lines = value.text.split('\n')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [value.id])

  const fontSize = value.size * scale
  return (
    <textarea
      ref={ref}
      aria-label="Texto del dibujo"
      value={value.text}
      rows={lines.length}
      placeholder="Escribe…"
      spellCheck
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        e.stopPropagation()
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') {
          e.preventDefault()
          onDone()
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute resize-none overflow-hidden whitespace-pre bg-white/70 p-0 text-slate-900 outline-dashed outline-1 outline-[color:var(--nb-color)] placeholder:text-slate-400 dark:bg-slate-900/70 dark:text-slate-100"
      style={{
        left: value.x * scale,
        top: value.y * scale,
        fontSize,
        lineHeight: LINE_HEIGHT,
        fontFamily: DRAW_FONT,
        color: value.color === 'ink' ? undefined : value.color,
        width: `${Math.max(6, ...lines.map((l) => l.length + 2))}ch`,
        border: 0,
        paddingTop: fontSize * 0.02,
      }}
    />
  )
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
}

function ToolBtn(props: { title: string; onClick: () => void; active?: boolean; disabled?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <button
      title={props.title}
      aria-label={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`${props.className ?? 'grid'} h-7 w-7 place-items-center rounded-md disabled:opacity-30 ${
        props.active ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      {props.children}
    </button>
  )
}
