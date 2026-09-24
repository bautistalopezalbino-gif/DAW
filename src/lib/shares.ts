import type { NotebookSlug } from '../data/notebooks'
import { check, type Role } from './api'
import { supabase } from './supabase'

export type ShareRole = 'editor' | 'lector'

export interface Share {
  id: string
  owner_id: string
  owner_email: string
  notebook: NotebookSlug
  email: string
  role: ShareRole
  created_at: string
}

const FIELDS = 'id, owner_id, owner_email, notebook, email, role, created_at'

/** Personas con acceso a uno de mis cuadernos. */
export async function listShares(notebook: NotebookSlug, myId: string): Promise<Share[]> {
  return check(
    await supabase.from('notebook_shares').select(FIELDS).eq('owner_id', myId).eq('notebook', notebook).order('created_at'),
  ) as Share[]
}

/** Cuadernos que otras personas han compartido conmigo. */
export async function sharedWithMe(myEmail: string): Promise<Share[]> {
  return check(
    await supabase.from('notebook_shares').select(FIELDS).eq('email', myEmail.toLowerCase()).order('owner_email'),
  ) as Share[]
}

export async function addShare(notebook: NotebookSlug, email: string, role: ShareRole): Promise<Share> {
  return check(
    await supabase
      .from('notebook_shares')
      .insert({ notebook, email: email.trim().toLowerCase(), role })
      .select(FIELDS)
      .single(),
  ) as Share
}

export async function updateShareRole(id: string, role: ShareRole) {
  check(await supabase.from('notebook_shares').update({ role }).eq('id', id))
}

export async function removeShare(id: string) {
  check(await supabase.from('notebook_shares').delete().eq('id', id))
}

export async function notebookRole(ownerId: string, notebook: NotebookSlug): Promise<Role | null> {
  return check(await supabase.rpc('notebook_role', { p_owner: ownerId, p_notebook: notebook })) as Role | null
}

export const SHARES_CHANGED = 'cuadernos:shares-changed'
