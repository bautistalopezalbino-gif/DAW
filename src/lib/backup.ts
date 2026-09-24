import type { JSONContent } from '@tiptap/react'
import type { NotebookSlug } from '../data/notebooks'
import { check } from './api'
import { docToMarkdown, resolveUrls } from './docExport'
import { supabase } from './supabase'

interface BackupSection { id: string; notebook: NotebookSlug; title: string; position: number }
interface BackupNote {
  id: string
  section_id: string
  title: string
  content: JSONContent | null
  content_text: string
  pinned: boolean
  tags: string[]
  created_at: string
  updated_at: string
}
interface BackupCard { note_id: string | null; notebook: NotebookSlug; front: string; back: string; box: number; due_at: string }
interface BackupEvent { notebook: NotebookSlug | null; title: string; kind: string; date: string; details: string; done: boolean }

export interface Backup {
  app: 'cuadernos-daw'
  version: 1
  exported_at: string
  sections: BackupSection[]
  notes: BackupNote[]
  flashcards: BackupCard[]
  events: BackupEvent[]
}

/** Copia de seguridad de todo lo que es mío (no incluye cuadernos que me han compartido). */
export async function exportBackup(myId: string): Promise<Backup> {
  const [sections, notes, flashcards, events] = await Promise.all([
    supabase.from('sections').select('id, notebook, title, position').eq('user_id', myId).order('position'),
    supabase
      .from('notes')
      .select('id, section_id, title, content, content_text, pinned, tags, created_at, updated_at')
      .eq('user_id', myId)
      .order('created_at'),
    supabase.from('flashcards').select('note_id, notebook, front, back, box, due_at').order('created_at'),
    supabase.from('events').select('notebook, title, kind, date, details, done').order('date'),
  ])
  return {
    app: 'cuadernos-daw',
    version: 1,
    exported_at: new Date().toISOString(),
    sections: check(sections) as BackupSection[],
    notes: check(notes) as BackupNote[],
    flashcards: check(flashcards) as BackupCard[],
    events: check(events) as BackupEvent[],
  }
}

/** Importa una copia: se AÑADE a lo que ya hay (no borra nada). */
export async function importBackup(data: Backup, myId: string) {
  if (data?.app !== 'cuadernos-daw' || !Array.isArray(data.sections)) {
    throw new Error('El archivo no es una copia de seguridad de Cuadernos DAW.')
  }
  const sectionIds = new Map<string, string>()
  for (const s of data.sections) {
    const row = check(
      await supabase
        .from('sections')
        .insert({ notebook: s.notebook, title: s.title, position: s.position, user_id: myId })
        .select('id')
        .single(),
    ) as { id: string }
    sectionIds.set(s.id, row.id)
  }
  const noteIds = new Map<string, string>()
  for (const n of data.notes ?? []) {
    const section_id = sectionIds.get(n.section_id)
    if (!section_id) continue
    const row = check(
      await supabase
        .from('notes')
        .insert({ section_id, title: n.title, content: n.content, content_text: n.content_text, pinned: n.pinned, tags: n.tags ?? [] })
        .select('id')
        .single(),
    ) as { id: string }
    noteIds.set(n.id, row.id)
  }
  const cards = (data.flashcards ?? []).map((c) => ({ ...c, note_id: c.note_id ? (noteIds.get(c.note_id) ?? null) : null }))
  if (cards.length) check(await supabase.from('flashcards').insert(cards))
  if (data.events?.length) check(await supabase.from('events').insert(data.events))
  return { sections: sectionIds.size, notes: noteIds.size, cards: cards.length, events: data.events?.length ?? 0 }
}

/** Un cuaderno entero en un único archivo Markdown (temas como ## y apuntes como ###). */
export async function notebookMarkdown(notebook: NotebookSlug, name: string, ownerId: string): Promise<string> {
  const sections = check(
    await supabase.from('sections').select('id, title').eq('notebook', notebook).eq('user_id', ownerId).order('position'),
  ) as { id: string; title: string }[]
  const ids = sections.map((s) => s.id)
  const notes = ids.length
    ? (check(
        await supabase.from('notes').select('section_id, title, content, tags').in('section_id', ids).order('created_at'),
      ) as { section_id: string; title: string; content: JSONContent | null; tags: string[] }[])
    : []
  const urls = await resolveUrls(notes.map((n) => n.content), 7 * 24 * 3600)
  const shift = (md: string) => md.replace(/^(#{1,4}) /gm, '###$1 ')
  let out = `# ${name}\n`
  for (const s of sections) {
    out += `\n## ${s.title}\n`
    for (const n of notes.filter((x) => x.section_id === s.id)) {
      out += `\n### ${n.title || 'Sin título'}\n\n`
      if (n.tags?.length) out += n.tags.map((t) => `#${t}`).join(' ') + '\n\n'
      out += shift(docToMarkdown(n.content, urls)) + '\n'
    }
  }
  return out
}
