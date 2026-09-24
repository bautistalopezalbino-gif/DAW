import type { NotebookSlug } from '../data/notebooks'
import { check } from './api'
import { supabase } from './supabase'

export interface Flashcard {
  id: string
  notebook: NotebookSlug
  note_id: string | null
  front: string
  back: string
  box: number
  due_at: string
  created_at: string
}

export type Grade = 'again' | 'good' | 'easy'

const FIELDS = 'id, notebook, note_id, front, back, box, due_at, created_at'
// Días hasta el siguiente repaso según la caja de Leitner
const INTERVALS = [0, 1, 3, 7, 14, 30, 60]

export async function listCards(notebook?: NotebookSlug): Promise<Flashcard[]> {
  let q = supabase.from('flashcards').select(FIELDS).order('created_at', { ascending: false })
  if (notebook) q = q.eq('notebook', notebook)
  return check(await q) as Flashcard[]
}

export async function dueCards(notebook?: NotebookSlug): Promise<Flashcard[]> {
  let q = supabase.from('flashcards').select(FIELDS).lte('due_at', new Date().toISOString()).order('due_at')
  if (notebook) q = q.eq('notebook', notebook)
  return check(await q) as Flashcard[]
}

export async function countDue(): Promise<number> {
  const res = await supabase
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .lte('due_at', new Date().toISOString())
  if (res.error) throw new Error(res.error.message)
  return res.count ?? 0
}

export async function createCard(card: Pick<Flashcard, 'notebook' | 'front' | 'back'> & { note_id?: string | null }) {
  return check(await supabase.from('flashcards').insert(card).select(FIELDS).single()) as Flashcard
}

export async function updateCard(id: string, patch: Partial<Pick<Flashcard, 'notebook' | 'front' | 'back'>>) {
  return check(await supabase.from('flashcards').update(patch).eq('id', id).select(FIELDS).single()) as Flashcard
}

export async function deleteCard(id: string) {
  check(await supabase.from('flashcards').delete().eq('id', id))
}

export function nextSchedule(card: Flashcard, grade: Grade): { box: number; due_at: string } {
  const box = grade === 'again' ? 0 : Math.min(card.box + (grade === 'easy' ? 2 : 1), INTERVALS.length - 1)
  const due = new Date()
  due.setDate(due.getDate() + INTERVALS[box])
  if (box > 0) due.setHours(4, 0, 0, 0) // disponible desde primera hora del día que toque
  return { box, due_at: due.toISOString() }
}

export async function reviewCard(card: Flashcard, grade: Grade): Promise<Flashcard> {
  return check(
    await supabase.from('flashcards').update(nextSchedule(card, grade)).eq('id', card.id).select(FIELDS).single(),
  ) as Flashcard
}
