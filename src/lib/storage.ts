import { supabase } from './supabase'

const BUCKET = 'attachments'
export const MAX_FILE_SIZE = 25 * 1024 * 1024

export interface UploadedFile {
  path: string
  name: string
  size: number
  mime: string
}

/** Dónde vive un apunte: los archivos se guardan en la carpeta del dueño del cuaderno. */
export interface NoteLocation {
  ownerId: string
  notebook: string
  noteId: string
}

const folderOf = (loc: NoteLocation) => `${loc.ownerId}/${loc.notebook}/${loc.noteId}`

function safeName(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '_')
  return clean.slice(-80) || 'archivo'
}

// Ruta: <owner_id>/<cuaderno>/<note_id>/<uuid>-<nombre>; las políticas RLS miran el rol en el cuaderno
export async function uploadFile(file: File, loc: NoteLocation): Promise<UploadedFile> {
  if (file.size > MAX_FILE_SIZE) throw new Error('El archivo supera el máximo de 25 MB.')
  const path = `${folderOf(loc)}/${crypto.randomUUID()}-${safeName(file.name)}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })
  if (error) throw new Error(error.message)
  return { path, name: file.name, size: file.size, mime: file.type }
}

const cache = new Map<string, { url: string; expires: number }>()

export async function signedUrl(path: string, seconds = 3600): Promise<string> {
  const hit = cache.get(path)
  if (seconds === 3600 && hit && hit.expires > Date.now() + 60_000) return hit.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds)
  if (error) throw new Error(error.message)
  if (seconds === 3600) cache.set(path, { url: data.signedUrl, expires: Date.now() + seconds * 1000 })
  return data.signedUrl
}

export async function downloadBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw new Error(error.message)
  return data
}

// Borra los archivos de un apunte (se llama al borrar el apunte)
export async function removeNoteFiles(loc: NoteLocation) {
  const folder = folderOf(loc)
  const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 })
  if (data?.length) await supabase.storage.from(BUCKET).remove(data.map((f) => `${folder}/${f.name}`))
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
