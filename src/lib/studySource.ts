import type { NotebookSlug } from '../data/notebooks'
import { getSection, listNotesFull } from './api'

/** Texto de todos los apuntes de un tema, para generar tarjetas, tests o resúmenes. */
export async function sectionSource(sectionId: string): Promise<{ title: string; notebook: NotebookSlug; text: string }> {
  const [section, notes] = await Promise.all([getSection(sectionId), listNotesFull(sectionId)])
  const text = notes
    .map((n) => `## ${n.title || 'Sin título'}\n${n.content_text}`)
    .join('\n\n')
    .trim()
  return { title: section.title, notebook: section.notebook, text }
}
