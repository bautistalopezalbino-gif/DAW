import { clip, streamChat } from './ai'
import { listNotesFull } from './api'
import { defaultLang, SegmentBuilder, textSegments, type Segment } from './speech'

const SUMMARY_PROMPT = `Haz un resumen de repaso para ESCUCHARLO en voz alta (como un pódcast corto) de los apuntes que te paso.
Reglas:
- Texto hablado y natural, en frases cortas. Nada de Markdown, tablas, viñetas, emojis ni símbolos.
- No leas código: explica con palabras qué hace y para qué sirve.
- Si hay palabras, ejemplos o frases en inglés, ponlas en su propia línea, solas, sin mezclarlas con español en la misma frase.
- Empieza directamente con el contenido (sin saludos) y termina con una frase que recuerde lo más importante.
- Máximo unas 350 palabras.`

/** Resumen de la IA pensado para oírlo. */
export async function summarySegments(text: string, notebook: string): Promise<Segment[]> {
  const out = await streamChat([{ role: 'user', text: `${SUMMARY_PROMPT}\n\n"""\n${clip(text, 40_000)}\n"""` }], () => {})
  const segments = textSegments(out, defaultLang(notebook))
  if (!segments.length) throw new Error('La IA no ha devuelto ningún resumen. Vuelve a intentarlo.')
  return segments
}

/** Todos los apuntes de un tema, uno detrás de otro. */
export async function sectionSegments(sectionId: string, title: string, notebook: string): Promise<Segment[]> {
  const notes = await listNotesFull(sectionId)
  if (!notes.length) throw new Error('Este tema todavía no tiene apuntes.')
  const b = new SegmentBuilder(defaultLang(notebook))
  b.text(title, { pause: 800 })
  for (const n of notes) {
    b.note(n.title || 'Sin título', n.content, n.id)
  }
  return b.segments
}
