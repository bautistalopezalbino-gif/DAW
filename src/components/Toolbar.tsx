import { useEditorState, type Editor } from '@tiptap/react'
import {
  Bold, Code, Columns3, Heading1, Heading2, Heading3, Highlighter, Italic, Link2, List,
  ListChecks, ListOrdered, Minus, Quote, Redo2, Rows3, SquareCode, Strikethrough, Table,
  Trash2, Underline, Undo2,
} from 'lucide-react'
import type { ReactNode } from 'react'

export default function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      table: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const c = () => editor.chain().focus()

  function setLink() {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Dirección del enlace (déjalo vacío para quitarlo):', prev ?? 'https://')
    if (url === null) return
    if (url.trim() === '') c().extendMarkRange('link').unsetLink().run()
    else c().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 px-2 py-1.5 dark:border-slate-800">
      <Btn title="Deshacer (Ctrl+Z)" onClick={() => c().undo().run()} disabled={!s.canUndo}><Undo2 size={16} /></Btn>
      <Btn title="Rehacer (Ctrl+Y)" onClick={() => c().redo().run()} disabled={!s.canRedo}><Redo2 size={16} /></Btn>
      <Sep />
      <Btn title="Título 1" active={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()}><Heading1 size={16} /></Btn>
      <Btn title="Título 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 size={16} /></Btn>
      <Btn title="Título 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}><Heading3 size={16} /></Btn>
      <Sep />
      <Btn title="Negrita (Ctrl+B)" active={s.bold} onClick={() => c().toggleBold().run()}><Bold size={16} /></Btn>
      <Btn title="Cursiva (Ctrl+I)" active={s.italic} onClick={() => c().toggleItalic().run()}><Italic size={16} /></Btn>
      <Btn title="Subrayado (Ctrl+U)" active={s.underline} onClick={() => c().toggleUnderline().run()}><Underline size={16} /></Btn>
      <Btn title="Tachado" active={s.strike} onClick={() => c().toggleStrike().run()}><Strikethrough size={16} /></Btn>
      <Btn title="Resaltar" active={s.highlight} onClick={() => c().toggleHighlight().run()}><Highlighter size={16} /></Btn>
      <Btn title="Código en línea" active={s.code} onClick={() => c().toggleCode().run()}><Code size={16} /></Btn>
      <Btn title="Enlace" active={s.link} onClick={setLink}><Link2 size={16} /></Btn>
      <Sep />
      <Btn title="Lista" active={s.bullet} onClick={() => c().toggleBulletList().run()}><List size={16} /></Btn>
      <Btn title="Lista numerada" active={s.ordered} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
      <Btn title="Lista de tareas" active={s.task} onClick={() => c().toggleTaskList().run()}><ListChecks size={16} /></Btn>
      <Btn title="Cita" active={s.quote} onClick={() => c().toggleBlockquote().run()}><Quote size={16} /></Btn>
      <Btn title="Bloque de código" active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()}><SquareCode size={16} /></Btn>
      <Btn title="Línea separadora" onClick={() => c().setHorizontalRule().run()}><Minus size={16} /></Btn>
      <Sep />
      <Btn title="Insertar tabla" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table size={16} /></Btn>
      {s.table && (
        <>
          <Btn title="Añadir fila" onClick={() => c().addRowAfter().run()}><Rows3 size={16} /><span className="text-xs">+</span></Btn>
          <Btn title="Añadir columna" onClick={() => c().addColumnAfter().run()}><Columns3 size={16} /><span className="text-xs">+</span></Btn>
          <Btn title="Borrar fila" onClick={() => c().deleteRow().run()}><Rows3 size={16} /><span className="text-xs">−</span></Btn>
          <Btn title="Borrar columna" onClick={() => c().deleteColumn().run()}><Columns3 size={16} /><span className="text-xs">−</span></Btn>
          <Btn title="Borrar tabla" onClick={() => c().deleteTable().run()}><Trash2 size={16} /></Btn>
        </>
      )}
    </div>
  )
}

function Btn(props: { title: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`flex h-8 shrink-0 items-center rounded-md px-1.5 disabled:opacity-30 ${
        props.active
          ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {props.children}
    </button>
  )
}

function Sep() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
}
