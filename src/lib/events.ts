import type { NotebookSlug } from '../data/notebooks'
import { check } from './api'
import { supabase } from './supabase'

export type EventKind = 'examen' | 'entrega' | 'otro'

export interface CalendarEvent {
  id: string
  notebook: NotebookSlug | null
  title: string
  kind: EventKind
  date: string // YYYY-MM-DD
  details: string
  done: boolean
}

export const KIND_LABEL: Record<EventKind, string> = { examen: 'Examen', entrega: 'Entrega', otro: 'Otro' }

const FIELDS = 'id, notebook, title, kind, date, details, done'

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysUntil(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000)
}

export function relativeDay(date: string): string {
  const n = daysUntil(date)
  if (n === 0) return 'hoy'
  if (n === 1) return 'mañana'
  if (n === -1) return 'ayer'
  return n > 0 ? `en ${n} días` : `hace ${-n} días`
}

export async function listEvents(from: string, to: string): Promise<CalendarEvent[]> {
  return check(
    await supabase.from('events').select(FIELDS).gte('date', from).lte('date', to).order('date'),
  ) as CalendarEvent[]
}

export async function upcomingEvents(limit = 5): Promise<CalendarEvent[]> {
  return check(
    await supabase
      .from('events')
      .select(FIELDS)
      .gte('date', isoDate(new Date()))
      .eq('done', false)
      .order('date')
      .limit(limit),
  ) as CalendarEvent[]
}

export async function saveEvent(ev: Omit<CalendarEvent, 'id'> & { id?: string }): Promise<CalendarEvent> {
  const { id, ...data } = ev
  const q = id ? supabase.from('events').update(data).eq('id', id) : supabase.from('events').insert(data)
  return check(await q.select(FIELDS).single()) as CalendarEvent
}

export async function deleteEvent(id: string) {
  check(await supabase.from('events').delete().eq('id', id))
}
