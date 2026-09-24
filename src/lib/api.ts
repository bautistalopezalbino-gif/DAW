import type { JSONContent } from '@tiptap/react'
import type { NotebookSlug } from '../data/notebooks'
import { supabase } from './supabase'

export interface Section {
  id: string
  notebook: NotebookSlug
  title: string
  position: number
}

export interface NoteSummary {
  id: string
  section_id: string
  title: string
  pinned: boolean
  updated_at: string
}

export interface Note extends NoteSummary {
  content: JSONContent | null
  content_text: string
}

export interface NoteWithPlace extends NoteSummary {
  content_text: string
  sections: { notebook: NotebookSlug; title: string } | null
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

// ---------- Temas ----------

export async function listSections(notebook: NotebookSlug): Promise<Section[]> {
  return check(
    await supabase
      .from('sections')
      .select('id, notebook, title, position')
      .eq('notebook', notebook)
      .order('position')
      .order('created_at'),
  ) as Section[]
}

export async function createSection(notebook: NotebookSlug, title: string, position: number) {
  return check(
    await supabase
      .from('sections')
      .insert({ notebook, title, position })
      .select('id, notebook, title, position')
      .single(),
  ) as Section
}

export async function renameSection(id: string, title: string) {
  check(await supabase.from('sections').update({ title }).eq('id', id))
}

export async function moveSection(a: Section, b: Section) {
  // Intercambia posiciones de dos temas vecinos
  check(await supabase.from('sections').update({ position: b.position }).eq('id', a.id))
  check(await supabase.from('sections').update({ position: a.position }).eq('id', b.id))
}

export async function deleteSection(id: string) {
  check(await supabase.from('sections').delete().eq('id', id))
}

// ---------- Apuntes ----------

const SUMMARY = 'id, section_id, title, pinned, updated_at'

export async function listNotes(sectionId: string): Promise<NoteSummary[]> {
  return check(
    await supabase
      .from('notes')
      .select(SUMMARY)
      .eq('section_id', sectionId)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false }),
  ) as NoteSummary[]
}

export async function getNote(id: string): Promise<Note> {
  return check(
    await supabase.from('notes').select(`${SUMMARY}, content, content_text`).eq('id', id).single(),
  ) as Note
}

export async function createNote(sectionId: string): Promise<NoteSummary> {
  return check(
    await supabase.from('notes').insert({ section_id: sectionId }).select(SUMMARY).single(),
  ) as NoteSummary
}

export async function updateNote(
  id: string,
  patch: Partial<Pick<Note, 'title' | 'content' | 'content_text' | 'pinned'>>,
): Promise<NoteSummary> {
  return check(
    await supabase.from('notes').update(patch).eq('id', id).select(SUMMARY).single(),
  ) as NoteSummary
}

export async function deleteNote(id: string) {
  check(await supabase.from('notes').delete().eq('id', id))
}

const WITH_PLACE = `${SUMMARY}, content_text, sections(notebook, title)`

export async function recentNotes(limit = 8): Promise<NoteWithPlace[]> {
  return check(
    await supabase
      .from('notes')
      .select(WITH_PLACE)
      .order('updated_at', { ascending: false })
      .limit(limit),
  ) as unknown as NoteWithPlace[]
}

export async function pinnedNotes(): Promise<NoteWithPlace[]> {
  return check(
    await supabase
      .from('notes')
      .select(WITH_PLACE)
      .eq('pinned', true)
      .order('updated_at', { ascending: false }),
  ) as unknown as NoteWithPlace[]
}

export async function searchNotes(query: string): Promise<NoteWithPlace[]> {
  return check(
    await supabase
      .from('notes')
      .select(WITH_PLACE)
      .textSearch('fts', query, { type: 'websearch', config: 'spanish' })
      .order('updated_at', { ascending: false })
      .limit(30),
  ) as unknown as NoteWithPlace[]
}

export function noteUrl(n: { id: string; section_id: string; sections: { notebook: string } | null }) {
  return `/c/${n.sections?.notebook ?? 'pro'}/${n.section_id}/${n.id}`
}
