const PRESET: Record<string, string> = {
  examen: '#e03131',
  importante: '#f08c00',
  duda: '#9c36b5',
  repasar: '#1971c2',
  hecho: '#2f9e44',
}
const PALETTE = ['#0ca678', '#1098ad', '#4263eb', '#ae3ec9', '#d6336c', '#e8590c', '#74b816', '#5c7cfa']

export const SUGGESTED_TAGS = Object.keys(PRESET)

/** Evento global para refrescar la lista de etiquetas de la barra lateral. */
export const TAGS_CHANGED = 'cuadernos:tags-changed'

export function tagColor(tag: string): string {
  if (PRESET[tag]) return PRESET[tag]
  let h = 0
  for (const ch of tag) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-').slice(0, 30)
}
