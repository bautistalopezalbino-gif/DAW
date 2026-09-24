import { Extension, mergeAttributes, Node, type AnyExtension, type JSONContent } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import dos from 'highlight.js/lib/languages/dos'
import powershell from 'highlight.js/lib/languages/powershell'
import { common, createLowlight } from 'lowlight'
import type * as Y from 'yjs'
import CodeBlockView from '../components/CodeBlockView'
import DrawingView from '../components/nodes/DrawingView'
import FileView from '../components/nodes/FileView'
import ImageView from '../components/nodes/ImageView'
import { CANVAS_WIDTH, strokeColor, strokePath, type Stroke } from './drawing'
import { formatSize } from './storage'

const lowlight = createLowlight(common)
lowlight.register({ powershell, dos })

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawing: {
      insertDrawing: () => ReturnType
    }
    blockInsert: {
      /** Inserta bloques debajo del párrafo actual (sin partirlo) o en lugar de una línea vacía. */
      insertBlock: (content: JSONContent | JSONContent[]) => ReturnType
    }
  }
}

const BlockInsert = Extension.create({
  name: 'blockInsert',
  addCommands() {
    return {
      insertBlock:
        (content) =>
        ({ state, chain }) => {
          const { selection } = state
          if (selection instanceof NodeSelection) return chain().insertContentAt(selection.to, content).run()
          const { $from } = selection
          if ($from.depth === 0) return chain().insertContent(content).run()
          const block = $from.node(1)
          if (block.type.name === 'paragraph' && block.content.size === 0) {
            return chain().insertContentAt({ from: $from.before(1), to: $from.after(1) }, content).run()
          }
          return chain().insertContentAt($from.after(1), content).run()
        },
    }
  },
})

/** Imagen guardada en Supabase Storage (atributo `path`) o externa (`src`). */
export const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      path: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-path'),
        renderHTML: (attrs) => (attrs.path ? { 'data-path': attrs.path } : {}),
      },
      size: {
        default: 'full',
        parseHTML: (el) => el.getAttribute('data-size') ?? 'full',
        renderHTML: (attrs) => ({ 'data-size': attrs.size }),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
}).configure({ inline: false })

/** Archivo adjunto (PDF, ZIP, etc.) guardado en Supabase Storage. */
export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    const data = (name: string, fallback: unknown = null) => ({
      default: fallback,
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? fallback,
      renderHTML: (attrs: Record<string, unknown>) => ({ [`data-${name}`]: attrs[name] }),
    })
    return {
      path: data('path'),
      name: data('name', 'archivo'),
      size: { ...data('size', 0), parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-size') ?? 0) },
      mime: data('mime', ''),
      // Solo para exportar/imprimir: URL firmada temporal (no se guarda con contenido)
      href: { default: null, renderHTML: () => ({}) },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-file-attachment]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-file-attachment': '', class: 'file-attachment' }),
      ['a', { href: node.attrs.href ?? '#', target: '_blank' }, `📎 ${node.attrs.name} (${formatSize(node.attrs.size)})`],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileView)
  },
})

/** Bloque de dibujo a mano alzada; los trazos se guardan como datos (vectorial). */
export const Drawing = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      strokes: {
        default: [],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-strokes') ?? '[]')
          } catch {
            return []
          }
        },
        renderHTML: (attrs) => ({ 'data-strokes': JSON.stringify(attrs.strokes) }),
      },
      height: {
        default: 360,
        parseHTML: (el) => Number(el.getAttribute('data-height') ?? 360),
        renderHTML: (attrs) => ({ 'data-height': attrs.height }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-drawing]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const svg = 'http://www.w3.org/2000/svg'
    const strokes = node.attrs.strokes as Stroke[]
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-drawing': '', class: 'drawing' }),
      [
        `${svg} svg`,
        { viewBox: `0 0 ${CANVAS_WIDTH} ${node.attrs.height}`, width: '100%', style: 'color:#111' },
        ...strokes.map((s) => [
          `${svg} path`,
          {
            d: strokePath(s.points),
            stroke: strokeColor(s.color),
            'stroke-width': String(s.width),
            'stroke-opacity': String(s.opacity ?? 1),
            fill: 'none',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
          },
        ]),
      ],
    ]
  },

  addKeyboardShortcuts() {
    // Con el dibujo seleccionado, Retroceso/Supr/Enter no lo borran (se borra con su botón)
    const selected = () => {
      const sel = this.editor.state.selection
      return sel instanceof NodeSelection && sel.node.type.name === this.name
    }
    return {
      Backspace: selected,
      Delete: selected,
      Enter: () => {
        if (!selected()) return false
        const { to } = this.editor.state.selection
        return this.editor.chain().insertContentAt(to, { type: 'paragraph' }).focus(to + 1).run()
      },
    }
  },

  addProseMirrorPlugins() {
    const name = this.name
    return [
      new Plugin({
        key: new PluginKey('drawingGuard'),
        props: {
          // Escribir con el dibujo seleccionado no lo sustituye
          handleTextInput: (view) => {
            const sel = view.state.selection
            return sel instanceof NodeSelection && sel.node.type.name === name
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      insertDrawing:
        () =>
        ({ commands }) =>
          commands.insertBlock({ type: 'drawing' }),
    }
  },

  addNodeView() {
    // Los eventos de ratón/lápiz los gestiona el propio dibujo, no el editor
    return ReactNodeViewRenderer(DrawingView, { stopEvent: () => true })
  },
})

type FilesHandler = (files: File[], pos: number | null) => void

/** Pegar o arrastrar archivos al editor los sube a Storage. */
const FileDrop = Extension.create<{ onFiles: FilesHandler }>({
  name: 'fileDrop',

  addOptions() {
    return { onFiles: () => {} }
  },

  addProseMirrorPlugins() {
    const onFiles = this.options.onFiles
    return [
      new Plugin({
        key: new PluginKey('fileDrop'),
        props: {
          handlePaste: (_view, event) => {
            const files = Array.from(event.clipboardData?.files ?? [])
            // Si también hay texto (p. ej. copiado de Word) se pega el texto normal
            if (!files.length || event.clipboardData?.getData('text/plain')) return false
            event.preventDefault()
            onFiles(files, null)
            return true
          },
          handleDrop: (view, event, _slice, moved) => {
            const files = Array.from(event.dataTransfer?.files ?? [])
            if (moved || !files.length) return false
            event.preventDefault()
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null
            onFiles(files, pos)
            return true
          },
        },
      }),
    ]
  },
})

/** Extensiones de contenido: sirven para el editor, exportar e imprimir. */
export const contentExtensions: AnyExtension[] = [
  StarterKit.configure({
    codeBlock: false,
    undoRedo: false, // el historial lo lleva Yjs (deshacer solo tus propios cambios)
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
  CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(CodeBlockView)
    },
  }).configure({ lowlight, defaultLanguage: 'plaintext' }),
  Highlight,
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: true } }),
  NoteImage,
  FileAttachment,
  Drawing,
]

interface CollabOptions {
  doc: Y.Doc
  provider: { awareness: unknown }
  user: { name: string; color: string }
  field: string
}

export function createEditorExtensions(onFiles: FilesHandler, collab: CollabOptions): AnyExtension[] {
  return [
    ...contentExtensions,
    Placeholder.configure({ placeholder: 'Empieza a escribir tus apuntes… (escribe ``` para un bloque de código)' }),
    FileDrop.configure({ onFiles }),
    BlockInsert,
    Collaboration.configure({ document: collab.doc, field: collab.field }),
    CollaborationCaret.configure({ provider: collab.provider, user: collab.user }),
  ]
}
