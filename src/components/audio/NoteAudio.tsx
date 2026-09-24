import { NodeSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Headphones, ListTree, TextCursor, TextSelect, Volume2 } from 'lucide-react'
import { useEffect } from 'react'
import type { Notebook } from '../../data/notebooks'
import { summarySegments } from '../../lib/audioSources'
import { speechKey } from '../../lib/editorExtensions'
import { defaultLang, noteSegments } from '../../lib/speech'
import { Menu, MenuItem } from '../ui'
import { useAudio, useAudioActions } from './AudioProvider'

interface Props {
  editor: Editor
  noteId: string
  title: string
  notebook: Notebook
}

/** Botón «Escuchar» de la cabecera del apunte. */
export function ListenMenu({ editor, noteId, title, notebook }: Props) {
  const a = useAudioActions()
  const name = title || 'Sin título'

  function playNote(fromCursor: boolean) {
    const segments = noteSegments(title, editor.getJSON(), { noteId, notebook: notebook.slug })
    let start = 0
    if (fromCursor) {
      const at = editor.state.selection.from
      start = Math.max(0, segments.findIndex((s) => s.block && s.block.to > at))
    }
    a.play({ title: name, subtitle: notebook.name, segments }, start)
  }

  function selectionText() {
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, '\n').trim()
  }

  return (
    <Menu
      title="Escuchar en voz alta"
      align="right"
      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
      label={<Headphones size={16} />}
    >
      {(close) => (
        <>
          <MenuItem icon={<Headphones size={15} />} hint="Lo lee entero, resaltando cada parte" onClick={() => (close(), playNote(false))}>
            Escuchar el apunte
          </MenuItem>
          <MenuItem icon={<TextCursor size={15} />} hint="Empieza donde tienes el cursor" onClick={() => (close(), playNote(true))}>
            Escuchar desde aquí
          </MenuItem>
          <MenuItem
            icon={<TextSelect size={15} />}
            hint="Para oír cómo se pronuncia una palabra o frase"
            onClick={() => {
              close()
              const text = selectionText()
              if (!text) return window.alert('Selecciona primero el texto que quieres escuchar.')
              a.speak(text, defaultLang(notebook.slug))
            }}
          >
            Escuchar la selección
          </MenuItem>
          <MenuItem
            icon={<ListTree size={15} />}
            hint="La IA prepara un resumen hablado"
            onClick={() => {
              close()
              const text = `${name}\n\n${editor.getText({ blockSeparator: '\n' })}`
              a.playAsync(`Resumen: ${name}`, notebook.name, () => summarySegments(text, notebook.slug))
            }}
          >
            Resumen en audio (IA)
          </MenuItem>
        </>
      )}
    </Menu>
  )
}

/** Botón flotante 🔊 al seleccionar texto: oír la pronunciación al momento. */
export function SpeakBubble({ editor, notebook }: { editor: Editor; notebook: Notebook }) {
  const a = useAudioActions()
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="speakBubble"
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ state, from, to }) => {
        if (from === to || state.selection instanceof NodeSelection) return false
        const text = state.doc.textBetween(from, to, ' ').trim()
        return text.length > 0 && text.length <= 300
      }}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const { from, to } = editor.state.selection
          a.speak(editor.state.doc.textBetween(from, to, '\n'), defaultLang(notebook.slug))
        }}
        title="Escuchar la selección"
        className="flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-lg hover:bg-violet-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-violet-300"
      >
        <Volume2 size={13} /> Escuchar
      </button>
    </BubbleMenu>
  )
}

/** Resalta en el editor lo que se está leyendo y lo mantiene a la vista. */
export function SpeechFollower({ editor, noteId }: { editor: Editor; noteId: string }) {
  const { track, index } = useAudio()
  const seg = track?.segments[index]
  const range = seg?.noteId === noteId ? seg.block : undefined
  const from = range?.from ?? -1
  const to = range?.to ?? -1

  useEffect(() => {
    if (editor.isDestroyed) return
    const node = from >= 0 ? editor.state.doc.nodeAt(from) : null
    const valid = node && from + node.nodeSize === to
    editor.view.dispatch(editor.state.tr.setMeta(speechKey, valid ? { from, to } : null))
    if (!valid || editor.view.hasFocus()) return
    const dom = editor.view.nodeDOM(from)
    if (dom instanceof HTMLElement) {
      const r = dom.getBoundingClientRect()
      if (r.top < 90 || r.bottom > window.innerHeight - 120) dom.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [editor, from, to])

  return null
}
