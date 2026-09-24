import { generateHTML } from '@tiptap/core'
import { getNotebook, type Notebook } from '../data/notebooks'
import { getNote, getSection, listNotesFull, type Note } from './api'
import { docToMarkdown, resolveUrls, withUrls } from './docExport'
import { contentExtensions } from './editorExtensions'

export type ExportKind = 'apunte' | 'tema' | 'temas'

export interface ExportNote {
  title: string
  tags: string[]
  html: string
  markdown: string
  text: string
}

export interface ExportData {
  heading: string
  subtitle: string
  notebook: Notebook
  single: boolean // un solo apunte
  sections: { id: string; title: string; notes: ExportNote[] }[]
}

/** Imagen → data URL, para que los archivos descargados no dependan de enlaces que caducan. */
async function toDataUrl(url: string): Promise<string> {
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => resolve(url)
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

/**
 * Carga lo que se va a exportar: un apunte, un tema o varios temas (ids separados por comas).
 * Con `embedImages` las imágenes van dentro del archivo (para descargas).
 */
export async function loadExport(kind: ExportKind, id: string, embedImages = false): Promise<ExportData> {
  const render = async (notes: Note[]): Promise<ExportNote[]> => {
    const urls = await resolveUrls(notes.map((n) => n.content), 7 * 24 * 3600)
    if (embedImages) {
      await Promise.all([...urls].map(async ([path, url]) => url && urls.set(path, await toDataUrl(url))))
    }
    return notes.map((n) => ({
      title: n.title || 'Sin título',
      tags: n.tags ?? [],
      html: generateHTML(withUrls(n.content, urls), contentExtensions),
      markdown: docToMarkdown(n.content, urls),
      text: n.content_text ?? '',
    }))
  }

  if (kind === 'apunte') {
    const n = await getNote(id)
    const section = await getSection(n.section_id)
    const notebook = getNotebook(section.notebook)!
    return {
      heading: n.title || 'Sin título',
      subtitle: `${notebook.name} · ${section.title}`,
      notebook,
      single: true,
      sections: [{ id: section.id, title: section.title, notes: await render([n]) }],
    }
  }

  const ids = id.split(',').filter(Boolean)
  const loaded = await Promise.all(ids.map(async (sid) => ({ section: await getSection(sid), notes: await listNotesFull(sid) })))
  if (!loaded.length) throw new Error('No hay temas que exportar.')
  const notebook = getNotebook(loaded[0].section.notebook)!
  const many = loaded.length > 1
  return {
    heading: many ? notebook.name : loaded[0].section.title,
    subtitle: many ? `${loaded.length} temas` : notebook.name,
    notebook,
    single: false,
    sections: await Promise.all(loaded.map(async ({ section, notes }) => ({ id: section.id, title: section.title, notes: await render(notes) }))),
  }
}
