import type { Editor } from '@tiptap/react'
import {
  BookOpenCheck, Dumbbell, FileQuestion, Languages, Layers, ListTree, MessageCircleQuestion, PenLine, Sparkles, SpellCheck, Wand2,
} from 'lucide-react'
import type { Notebook } from '../../data/notebooks'
import { Menu, MenuItem, MenuLabel } from '../ui'
import { useAssistant } from './AssistantProvider'

/** Menú ✨ del editor: acciones de IA sobre el apunte o el texto seleccionado. */
export default function AiMenu({ editor, noteId, title, notebook, canWrite }: {
  editor: Editor
  noteId: string
  title: string
  notebook: Notebook
  canWrite: boolean
}) {
  const a = useAssistant()

  function selection() {
    const sel = editor.state.selection
    if (sel.empty) return null
    return { text: editor.state.doc.textBetween(sel.from, sel.to, '\n'), range: { from: sel.from, to: sel.to } }
  }

  const source = () => ({ title, notebook: notebook.slug, text: `${title}\n\n${editor.getText({ blockSeparator: '\n' })}`, noteId })

  function onSelection(label: string, instruction: string) {
    const sel = selection()
    if (!sel) return window.alert('Selecciona primero el texto en el apunte.')
    a.ask(`${instruction}\n"""\n${sel.text}\n"""`, { label, useNote: false, range: sel.range })
  }

  return (
    <Menu
      title="Asistente IA"
      align="right"
      className="flex items-center gap-1 rounded-md bg-gradient-to-r from-blue-600 to-violet-600 px-2 py-1 text-xs font-medium text-white hover:opacity-90"
      label={
        <>
          <Sparkles size={13} /> IA
        </>
      }
    >
      {(close) => {
        const run = (fn: () => void) => () => {
          close()
          fn()
        }
        return (
          <>
            <MenuLabel>Estudiar</MenuLabel>
            <MenuItem icon={<ListTree size={15} />} onClick={run(() => a.ask('Resume este apunte en un esquema con los puntos clave.', { label: `Resumir «${title || 'este apunte'}»`, useNote: true }))}>
              Resumir
            </MenuItem>
            <MenuItem
              icon={<BookOpenCheck size={15} />}
              hint="La selección o el apunte entero"
              onClick={run(() => {
                const sel = selection()
                if (sel) a.ask(`Explícame esto de forma sencilla, con un ejemplo:\n"""\n${sel.text}\n"""`, { label: 'Explicar la selección', useNote: true, range: sel.range })
                else a.ask('Explícame este apunte de forma sencilla, como a alguien que lo ve por primera vez, con ejemplos.', { label: 'Explicar el apunte', useNote: true })
              })}
            >
              Explicar
            </MenuItem>
            <MenuItem icon={<Layers size={15} />} onClick={run(() => a.openCards(source()))}>
              Crear tarjetas de repaso
            </MenuItem>
            <MenuItem icon={<FileQuestion size={15} />} onClick={run(() => a.openQuiz(source()))}>
              Hacerme un test
            </MenuItem>
            <MenuItem
              icon={<Dumbbell size={15} />}
              onClick={run(() =>
                a.ask('Propón 3 ejercicios prácticos sobre este apunte, de menos a más difícil. Pon las soluciones al final, en un apartado «Soluciones».', {
                  label: 'Ejercicios de práctica',
                  useNote: true,
                }),
              )}
            >
              Ejercicios de práctica
            </MenuItem>
            <MenuItem icon={<MessageCircleQuestion size={15} />} onClick={run(() => {
              a.setUseNote(true)
              a.setOpen(true)
            })}>
              Preguntar sobre este apunte…
            </MenuItem>
            {canWrite && (
              <>
                <MenuLabel>Escribir (sobre el texto seleccionado)</MenuLabel>
                <MenuItem icon={<Wand2 size={15} />} onClick={run(() => onSelection('Mejorar la redacción', 'Mejora la redacción de este texto de apuntes manteniendo el significado y el formato. Devuelve solo el texto mejorado, sin comentarios:'))}>
                  Mejorar redacción
                </MenuItem>
                <MenuItem icon={<SpellCheck size={15} />} onClick={run(() => onSelection('Corregir ortografía', 'Corrige la ortografía y la gramática de este texto sin cambiar el estilo ni el formato. Devuelve solo el texto corregido:'))}>
                  Corregir ortografía
                </MenuItem>
                <MenuItem icon={<Languages size={15} />} onClick={run(() => onSelection('Traducir al inglés', 'Traduce este texto al inglés, manteniendo el formato. Devuelve solo la traducción:'))}>
                  Traducir al inglés
                </MenuItem>
                <MenuItem icon={<Languages size={15} />} onClick={run(() => onSelection('Traducir al español', 'Traduce este texto al español de España, manteniendo el formato. Devuelve solo la traducción:'))}>
                  Traducir al español
                </MenuItem>
                <MenuItem
                  icon={<PenLine size={15} />}
                  hint="Sigue el apunte donde lo dejaste"
                  onClick={run(() =>
                    a.ask('Continúa este apunte a partir de donde termina, con el mismo estilo y formato (2-4 párrafos o apartados). Devuelve solo el texto nuevo, sin repetir lo anterior.', {
                      label: 'Continuar escribiendo',
                      useNote: true,
                    }),
                  )}
                >
                  Continuar escribiendo
                </MenuItem>
              </>
            )}
          </>
        )
      }}
    </Menu>
  )
}
