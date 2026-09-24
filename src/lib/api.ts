import type { JSONContent } from '@tiptap/react'
import type { NotebookSlug } from '../data/notebooks'
import { supabase } from './supabase'

export type Role = 'owner' | 'editor' | 'lector'

export interface Section {
  id: string
  user_id: string
  notebook: NotebookSlug
  title: string
  position: number
}

export interface NoteSummary {
  id: string
  user_id: string
  section_id: string
  title: string
  pinned: boolean
  tags: string[]
  updated_at: string
}

export interface Note extends NoteSummary {
  content: JSONContent | null
  content_text: string
  ydoc: string | null
}

export interface NoteWithPlace extends NoteSummary {
  content_text: string
  sections: { notebook: NotebookSlug; title: string } | null
}

export interface NoteInit {
  title?: string
  content?: JSONContent
  content_text?: string
}

export function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/** Ruta base de un cuaderno: propio (/c/…) o compartido por otra persona (/s/<dueño>/…). */
export function notebookBase(slug: string, ownerId: string, myId: string): string {
  return ownerId === myId ? `/c/${slug}` : `/s/${ownerId}/${slug}`
}

export function noteUrl(n: NoteWithPlace, myId: string): string {
  return `${notebookBase(n.sections?.notebook ?? 'pro', n.user_id, myId)}/${n.section_id}/${n.id}`
}

// ---------- Temas ----------

const SECTION = 'id, user_id, notebook, title, position'

export async function listSections(notebook: NotebookSlug, ownerId: string): Promise<Section[]> {
  return check(
    await supabase
      .from('sections')
      .select(SECTION)
      .eq('notebook', notebook)
      .eq('user_id', ownerId)
      .order('position')
      .order('created_at'),
  ) as Section[]
}

export async function createSection(notebook: NotebookSlug, ownerId: string, title: string, position: number) {
  return check(
    await supabase.from('sections').insert({ notebook, user_id: ownerId, title, position }).select(SECTION).single(),
  ) as Section
}

export async function getSection(id: string): Promise<Section> {
  return check(await supabase.from('sections').select(SECTION).eq('id', id).single()) as Section
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

const SUMMARY = 'id, user_id, section_id, title, pinned, tags, updated_at'
const WITH_PLACE = `${SUMMARY}, content_text, sections(notebook, title)`

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

export async function listNotesFull(sectionId: string): Promise<Note[]> {
  return check(
    await supabase
      .from('notes')
      .select(`${SUMMARY}, content, content_text, ydoc`)
      .eq('section_id', sectionId)
      .order('created_at'),
  ) as Note[]
}

export async function getNote(id: string): Promise<Note> {
  return check(
    await supabase.from('notes').select(`${SUMMARY}, content, content_text, ydoc`).eq('id', id).single(),
  ) as Note
}

export async function getNoteYdoc(id: string): Promise<string | null> {
  const row = check(await supabase.from('notes').select('ydoc').eq('id', id).single()) as { ydoc: string | null }
  return row.ydoc
}

export async function createNote(sectionId: string, init: NoteInit = {}): Promise<NoteSummary> {
  return check(
    await supabase.from('notes').insert({ section_id: sectionId, ...init }).select(SUMMARY).single(),
  ) as NoteSummary
}

export type NotePatch = Partial<Pick<Note, 'title' | 'content' | 'content_text' | 'pinned' | 'tags' | 'ydoc'>>

export async function updateNote(id: string, patch: NotePatch): Promise<NoteSummary> {
  return check(await supabase.from('notes').update(patch).eq('id', id).select(SUMMARY).single()) as NoteSummary
}

export async function deleteNote(id: string) {
  check(await supabase.from('notes').delete().eq('id', id))
}

export async function recentNotes(limit = 8): Promise<NoteWithPlace[]> {
  return check(
    await supabase.from('notes').select(WITH_PLACE).order('updated_at', { ascending: false }).limit(limit),
  ) as unknown as NoteWithPlace[]
}

export async function pinnedNotes(): Promise<NoteWithPlace[]> {
  return check(
    await supabase.from('notes').select(WITH_PLACE).eq('pinned', true).order('updated_at', { ascending: false }),
  ) as unknown as NoteWithPlace[]
}

export async function notesByTag(tag: string): Promise<NoteWithPlace[]> {
  return check(
    await supabase.from('notes').select(WITH_PLACE).contains('tags', [tag]).order('updated_at', { ascending: false }),
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

// ---------- Etiquetas ----------

export async function userTags(): Promise<{ tag: string; uses: number }[]> {
  return check(await supabase.rpc('user_tags')) as { tag: string; uses: number }[]
}
