import type { JSONContent } from '@tiptap/core'
import type { NotebookSlug } from '../data/notebooks'

/**
 * Lectura en voz alta: convierte apuntes (o texto) en frases cortas con su idioma, listas para
 * leerlas con las voces del navegador (Web Speech API).
 */

export type Lang = 'es' | 'en'

export interface Segment {
  text: string
  lang: Lang
  /** Párrafo, título o fila al que pertenece (para saltar de uno en uno). */
  group: number
  noteId?: string
  /** Posición del bloque en el apunte, para resaltarlo mientras se lee. */
  block?: { from: number; to: number }
  /** Silencio después de la frase, en milisegundos. */
  pause?: number
}

export const defaultLang = (notebook?: NotebookSlug | string | null): Lang => (notebook === 'ing' ? 'en' : 'es')

// ---------- Idioma ----------

const EN_WORDS = new Set(
  'the and is are was were be been of to in on at by for from with you your it its this that these those i my we our they their she his her what which who whom how why when where can could will would should shall must do does did not have has had an or if there here than then so but about into over just only also very some any each every get got make take go going like want know think'.split(' '),
)
const ES_WORDS = new Set(
  'el la los las lo un una unos unas de del al que y o e u en es son era ser estar está están hay por para con sin se su sus como más pero muy también cuando donde qué cómo cuál quién yo tú él ella nosotros ellos este esta esto estos estas ese esa eso tiene tienen puede pueden hacer entre sobre cada todo todos otra otro ya sí le les nos mi mis tu tus usted'.split(' '),
)

/** Puntuación: > 0 parece inglés, < 0 parece español, 0 no se sabe. */
export function langScore(text: string): number {
  let score = 0
  if (/[ñáéíóú¿¡]/i.test(text)) score -= 3
  const words = text.toLowerCase().match(/[a-zñáéíóúü']+/g) ?? []
  for (const w of words) {
    if (EN_WORDS.has(w)) score += 2
    else if (ES_WORDS.has(w)) score -= 2
    else if (w.length > 2) {
      if (/(th|sh|ck|wh|ph|ght|ee|oo|ea|ou|w|k|y$|ing$|ed$|ly$|ss$|bb|dd|ff|gg|mm|pp|tt)/.test(w)) score += 1
      if (/(ción$|sión$|dad$|mente$|rr|^ll|[aeo]s$|[^aeiou][ao]$|ar$|ir$|qu[ei])/.test(w)) score -= 1
    }
  }
  return score
}

export function detectLang(text: string, fallback: Lang): Lang {
  const s = langScore(text)
  return s > 0 ? 'en' : s < 0 ? 'es' : fallback
}

// ---------- Frases ----------

const MAX = 220

/** Parte un texto en frases cortas (algunas voces se cortan con textos muy largos). */
export function sentences(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/(?<=[.!?…;])\s+(?=\S)|\n+/)) {
    let s = raw.replace(/\s+/g, ' ').trim()
    while (s.length > MAX) {
      const cut = Math.max(s.lastIndexOf(', ', MAX), s.lastIndexOf(' ', MAX))
      const at = cut > 40 ? cut + 1 : MAX
      out.push(s.slice(0, at).trim())
      s = s.slice(at).trim()
    }
    if (/[\p{L}\p{N}]/u.test(s)) out.push(s)
  }
  return out
}

/**
 * Líneas de vocabulario como «to look forward to: tener ganas de» se leen en dos partes, cada una
 * con su idioma.
 */
function splitPair(text: string): { text: string; lang: Lang | null }[] {
  const guess = (t: string): Lang | null => {
    const sc = langScore(t)
    return sc > 0 ? 'en' : sc < 0 ? 'es' : null
  }
  if (text.length < 90) {
    const m = text.match(/^(.+?)\s*(?:[:=→–—]|\s-\s)\s*(.+)$/)
    if (m) {
      const [la, lb] = [guess(m[1]), guess(m[2])]
      // Solo se parte si los dos lados parecen de idiomas distintos (o uno se sabe y el otro no)
      if ((la || lb) && la !== lb) {
        const other = (l: Lang): Lang => (l === 'en' ? 'es' : 'en')
        return [
          { text: m[1], lang: la ?? other(lb!) },
          { text: m[2], lang: lb ?? other(la!) },
        ]
      }
    }
  }
  return [{ text, lang: guess(text) }]
}

// ---------- Apuntes (documento del editor) ----------

const LEAVES = new Set(['image', 'fileAttachment', 'drawing', 'hardBreak', 'horizontalRule'])
const CODE_NAMES: Record<string, string> = {
  js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript', java: 'Java', sql: 'SQL',
  html: 'HTML', xml: 'XML', css: 'CSS', bash: 'Bash', shell: 'Bash', powershell: 'PowerShell', python: 'Python', json: 'JSON',
  php: 'PHP', dos: 'MS-DOS',
}

/** Tamaño del nodo en posiciones de ProseMirror (igual que en el editor). */
function nodeSize(n: JSONContent): number {
  if (n.type === 'text') return n.text?.length ?? 0
  if (LEAVES.has(n.type ?? '')) return 1
  return 2 + (n.content ?? []).reduce((s, c) => s + nodeSize(c), 0)
}

function inlineText(n: JSONContent): string {
  if (n.type === 'text') return n.text ?? ''
  if (n.type === 'hardBreak') return '\n'
  const parts = (n.content ?? []).map(inlineText)
  const blocky = (n.content ?? []).some((c) => c.type !== 'text' && c.type !== 'hardBreak')
  return parts.join(blocky ? '. ' : '')
}

export class SegmentBuilder {
  readonly segments: Segment[] = []
  private group = 0
  private fallback: Lang
  constructor(fallback: Lang) {
    this.fallback = fallback
  }

  /** Añade texto suelto (títulos, resúmenes…) sin posición en el apunte. */
  text(text: string, opts: { noteId?: string; pause?: number; block?: Segment['block'] } = {}) {
    const pieces = sentences(text).flatMap((s, i, all) =>
      splitPair(s).map((p, j, pair) => ({ ...p, pause: j < pair.length - 1 ? 350 : i === all.length - 1 ? (opts.pause ?? 250) : 0 })),
    )
    if (!pieces.length) return
    this.group++
    pieces.forEach((p, i) => {
      // Las frases sin idioma claro toman el de sus vecinas del mismo bloque
      let lang = p.lang
      for (let d = 1; !lang && d < pieces.length; d++) lang = pieces[i - d]?.lang ?? pieces[i + d]?.lang ?? null
      this.segments.push({ text: p.text, lang: lang ?? this.fallback, group: this.group, noteId: opts.noteId, block: opts.block, pause: p.pause })
    })
  }

  /** Título y contenido de un apunte (si empieza con un título igual, no se lee dos veces). */
  note(title: string, doc: JSONContent | null | undefined, noteId?: string) {
    const first = doc?.content?.find((n) => inlineText(n).trim())
    const repeated = first && inlineText(first).trim().toLowerCase() === title.trim().toLowerCase()
    if (title.trim() && !repeated) this.text(title, { noteId, pause: 600 })
    this.doc(doc, noteId)
  }

  /** Añade un documento del editor; las posiciones permiten resaltar lo que se lee. */
  doc(doc: JSONContent | null | undefined, noteId?: string) {
    let pos = 0
    for (const child of doc?.content ?? []) {
      this.block(child, pos, noteId)
      pos += nodeSize(child)
    }
  }

  private block(n: JSONContent, pos: number, noteId?: string) {
    const block = { from: pos, to: pos + nodeSize(n) }
    switch (n.type) {
      case 'heading':
        return this.text(inlineText(n), { noteId, block, pause: 500 })
      case 'paragraph':
        return this.text(inlineText(n), { noteId, block })
      case 'codeBlock': {
        const lang = CODE_NAMES[String(n.attrs?.language ?? '').toLowerCase()]
        this.group++
        this.segments.push({ text: `Bloque de código${lang ? ` en ${lang}` : ''}.`, lang: 'es', group: this.group, noteId, block, pause: 400 })
        return
      }
      case 'table':
        return this.table(n, pos, noteId)
      default:
        if (LEAVES.has(n.type ?? '') || !n.content) return
        // Listas, citas, elementos de lista…: se entra en su contenido
        let inner = pos + 1
        for (const c of n.content) {
          this.block(c, inner, noteId)
          inner += nodeSize(c)
        }
    }
  }

  /** Las tablas se leen fila a fila; el idioma se decide por columnas (tablas de vocabulario). */
  private table(table: JSONContent, pos: number, noteId?: string) {
    const rows = table.content ?? []
    const cells = rows.map((r) => (r.content ?? []).map((c) => inlineText(c).trim()))
    const cols = Math.max(0, ...cells.map((r) => r.length))
    const colLang: Lang[] = []
    for (let j = 0; j < cols; j++) {
      const score = cells.reduce((s, r) => s + (r[j] ? Math.sign(langScore(r[j])) : 0), 0)
      colLang.push(score > 0 ? 'en' : score < 0 ? 'es' : this.fallback)
    }
    let rowPos = pos + 1
    rows.forEach((row, i) => {
      const block = { from: rowPos, to: rowPos + nodeSize(row) }
      rowPos = block.to
      const texts = cells[i].map((t, j) => ({ t, j })).filter((c) => c.t)
      if (!texts.length) return
      this.group++
      texts.forEach(({ t, j }, k) => {
        const s = langScore(t)
        const lang: Lang = Math.abs(s) >= 3 ? (s > 0 ? 'en' : 'es') : colLang[j]
        for (const part of sentences(t)) {
          this.segments.push({ text: part, lang, group: this.group, noteId, block, pause: k === texts.length - 1 ? 600 : 300 })
        }
      })
    })
  }
}

export function noteSegments(title: string, doc: JSONContent | null | undefined, opts: { noteId?: string; notebook?: string }): Segment[] {
  const b = new SegmentBuilder(defaultLang(opts.notebook))
  b.note(title, doc, opts.noteId)
  return b.segments
}

/** Texto plano o Markdown sencillo (respuestas de la IA, tarjetas…). */
export function textSegments(text: string, fallback: Lang = 'es'): Segment[] {
  const b = new SegmentBuilder(fallback)
  let inCode = false
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('```')) {
      if (!inCode) b.text('Bloque de código.', { pause: 400 })
      inCode = !inCode
      continue
    }
    if (inCode || !line || (/^\|?[\s:|-]+\|?$/.test(line) && line.includes('-'))) continue
    const clean = line
      .replace(/^#{1,6}\s+/, '')
      .replace(/^([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, '')
      .replace(/^>\s?/, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__|\*|_|`|~~)/g, '')
    if (clean.includes('|')) {
      clean.split('|').map((c) => c.trim()).filter(Boolean).forEach((c) => b.text(c, { pause: 300 }))
    } else b.text(clean, { pause: /^#/.test(line) ? 500 : 250 })
  }
  return b.segments
}

// ---------- Voces ----------

export function voicesFor(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang))
}

/** Elige la mejor voz disponible: la preferida, o una natural/neuronal de España o Reino Unido. */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang, preferred?: string): SpeechSynthesisVoice | undefined {
  const list = voicesFor(voices, lang)
  const chosen = preferred && list.find((v) => v.voiceURI === preferred)
  if (chosen) return chosen
  const score = (v: SpeechSynthesisVoice) => {
    const region = v.lang.toLowerCase().replace('_', '-')
    let s = 0
    if (lang === 'es' && region === 'es-es') s += 3
    if (lang === 'en' && region === 'en-gb') s += 2
    if (lang === 'en' && region === 'en-us') s += 1
    if (/natural|neural|online|premium|enhanced/i.test(v.name)) s += 4
    if (/google/i.test(v.name)) s += 2
    if (v.default) s += 1
    return s
  }
  return [...list].sort((a, b) => score(b) - score(a))[0]
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
