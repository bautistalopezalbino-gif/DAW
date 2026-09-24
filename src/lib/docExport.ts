import type { JSONContent } from '@tiptap/react'
import { drawingSvg, type Stroke } from './drawing'
import { signedUrl } from './storage'

/** Texto plano de un documento (para la búsqueda). */
export function docToText(doc: JSONContent | null | undefined): string {
  if (!doc) return ''
  if (doc.type === 'text') return doc.text ?? ''
  if (doc.type === 'hardBreak') return '\n'
  const inner = (doc.content ?? []).map(docToText)
  const isBlockContainer = (doc.content ?? []).some((c) => c.type !== 'text' && c.type !== 'hardBreak')
  return inner.join(isBlockContainer ? '\n' : '')
}

/** Rutas de Storage usadas por imágenes y adjuntos. */
export function collectPaths(doc: JSONContent | null | undefined, out = new Set<string>()): Set<string> {
  if (!doc) return out
  if ((doc.type === 'image' || doc.type === 'fileAttachment') && doc.attrs?.path) out.add(doc.attrs.path)
  doc.content?.forEach((c) => collectPaths(c, out))
  return out
}

export async function resolveUrls(docs: (JSONContent | null)[], seconds = 3600): Promise<Map<string, string>> {
  const paths = new Set<string>()
  docs.forEach((d) => collectPaths(d, paths))
  const entries = await Promise.all(
    [...paths].map(async (p) => [p, await signedUrl(p, seconds).catch(() => '')] as const),
  )
  return new Map(entries)
}

/** Copia el documento poniendo URLs temporales en imágenes y adjuntos. */
export function withUrls(doc: JSONContent | null, urls: Map<string, string>): JSONContent {
  const walk = (n: JSONContent): JSONContent => {
    const copy: JSONContent = { ...n, attrs: n.attrs ? { ...n.attrs } : undefined }
    if (n.type === 'image' && n.attrs?.path) copy.attrs!.src = urls.get(n.attrs.path) ?? ''
    if (n.type === 'fileAttachment' && n.attrs?.path) copy.attrs!.href = urls.get(n.attrs.path) ?? null
    if (n.content) copy.content = n.content.map(walk)
    return copy
  }
  return walk(doc ?? { type: 'doc', content: [] })
}

// ---------- Markdown ----------

function plain(n: JSONContent): string {
  if (n.type === 'text') return n.text ?? ''
  return (n.content ?? []).map(plain).join('')
}

function inline(nodes: JSONContent[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '  \n'
      if (n.type !== 'text') return ''
      const marks = n.marks ?? []
      const has = (type: string) => marks.some((m) => m.type === type)
      let t = n.text ?? ''
      if (has('code')) return '`' + t + '`'
      t = t.replace(/([\\*_`[\]<>])/g, '\\$1')
      if (has('bold')) t = `**${t}**`
      if (has('italic')) t = `*${t}*`
      if (has('strike')) t = `~~${t}~~`
      if (has('underline')) t = `<u>${t}</u>`
      if (has('highlight')) t = `<mark>${t}</mark>`
      const link = marks.find((m) => m.type === 'link')
      if (link) t = `[${t}](${link.attrs?.href ?? ''})`
      return t
    })
    .join('')
}

function indent(text: string, first: string): string {
  const pad = ' '.repeat(first.length)
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? first : line ? pad : '') + line)
    .join('\n')
}

function blocks(nodes: JSONContent[] = [], urls: Map<string, string>): string {
  return nodes.map((n) => block(n, urls)).join('\n\n')
}

function block(n: JSONContent, urls: Map<string, string>): string {
  const items = n.content ?? []
  switch (n.type) {
    case 'paragraph':
      return inline(n.content)
    case 'heading':
      return `${'#'.repeat(n.attrs?.level ?? 1)} ${inline(n.content)}`
    case 'blockquote':
      return blocks(items, urls)
        .split('\n')
        .map((l) => (l ? `> ${l}` : '>'))
        .join('\n')
    case 'codeBlock': {
      const lang = n.attrs?.language && n.attrs.language !== 'plaintext' ? n.attrs.language : ''
      return '```' + lang + '\n' + plain(n) + '\n```'
    }
    case 'horizontalRule':
      return '---'
    case 'bulletList':
      return items.map((li) => indent(blocks(li.content, urls), '- ')).join('\n')
    case 'orderedList': {
      const start = n.attrs?.start ?? 1
      return items.map((li, i) => indent(blocks(li.content, urls), `${start + i}. `)).join('\n')
    }
    case 'taskList':
      return items.map((li) => indent(blocks(li.content, urls), li.attrs?.checked ? '- [x] ' : '- [ ] ')).join('\n')
    case 'table': {
      const rows = items.map((row) =>
        (row.content ?? []).map((cell) => blocks(cell.content, urls).replace(/\n+/g, ' ').replace(/\|/g, '\\|')),
      )
      if (!rows.length) return ''
      const line = (cells: string[]) => `| ${cells.join(' | ')} |`
      return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n')
    }
    case 'image': {
      const url = (n.attrs?.path ? urls.get(n.attrs.path) : n.attrs?.src) ?? ''
      return `![${n.attrs?.alt ?? ''}](${url})`
    }
    case 'fileAttachment':
      return `[📎 ${n.attrs?.name ?? 'archivo'}](${urls.get(n.attrs?.path) ?? ''})`
    case 'drawing':
      return drawingSvg((n.attrs?.strokes ?? []) as Stroke[], n.attrs?.height ?? 360)
    default:
      return blocks(items, urls)
  }
}

export function docToMarkdown(doc: JSONContent | null, urls: Map<string, string> = new Map()): string {
  return blocks(doc?.content ?? [], urls).replace(/\n{3,}/g, '\n\n').trim()
}
