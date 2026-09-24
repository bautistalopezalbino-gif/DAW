import hljs from 'highlight.js/lib/common'
import type { ExportData } from './exportData'

export type Format = 'pdf' | 'doc' | 'md' | 'html' | 'txt'

export const FORMATS: { id: Format; label: string; ext: string; mime: string; description: string }[] = [
  { id: 'pdf', label: 'PDF', ext: 'pdf', mime: 'application/pdf', description: 'Para leer, enviar o subir al aula virtual. Se ve igual en todas partes.' },
  { id: 'doc', label: 'Word', ext: 'doc', mime: 'application/msword', description: 'Para seguir editando en Word, LibreOffice o Google Docs.' },
  { id: 'md', label: 'Markdown', ext: 'md', mime: 'text/markdown', description: 'Texto con formato para VS Code, Obsidian o GitHub.' },
  { id: 'html', label: 'Página web', ext: 'html', mime: 'text/html', description: 'Se abre en cualquier navegador, con las imágenes incluidas.' },
  { id: 'txt', label: 'Texto', ext: 'txt', mime: 'text/plain', description: 'Solo el texto, sin formato ni imágenes.' },
]

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Estilos del documento exportado (colores fijos, sin depender de la web). */
function css(scope = ''): string {
  const s = (sel: string) => sel.split(',').map((x) => `${scope} ${x.trim()}`.trim()).join(', ')
  return `
${s('')} { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; font-size: 14px; }
${s('.doc-header')} { border-bottom: 4px solid var(--c); padding-bottom: 10px; margin-bottom: 24px; }
${s('.doc-sub')} { color: var(--c); font-weight: 600; font-size: 13px; margin: 0; }
${s('.doc-title')} { font-size: 28px; margin: 2px 0; line-height: 1.2; }
${s('.doc-date')} { color: #94a3b8; font-size: 11px; margin: 0; }
${s('h1, h2, h3')} { line-height: 1.25; margin: 1.2em 0 0.5em; color: #0f172a; }
${s('.unit')} { font-size: 22px; border-bottom: 2px solid var(--c); padding-bottom: 4px; margin-top: 36px; }
${s('.note-title')} { font-size: 19px; margin-top: 28px; }
${s('.tags')} { color: #64748b; font-size: 11px; margin: 0 0 8px; }
${s('p')} { margin: 0.5em 0; }
${s('ul, ol')} { padding-left: 1.5em; margin: 0.5em 0; }
${s('li > p')} { margin: 0.15em 0; }
${s('ul[data-type="taskList"]')} { list-style: none; padding-left: 0.2em; }
${s('ul[data-type="taskList"] li')} { display: flex; gap: 6px; align-items: flex-start; }
${s('ul[data-type="taskList"] li > label')} { margin-top: 0.25em; }
${s('blockquote')} { border-left: 4px solid #cbd5e1; margin: 0.8em 0; padding: 2px 12px; color: #475569; }
${s('code')} { font-family: Consolas, 'Courier New', monospace; font-size: 12.5px; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
${s('pre')} { background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 6px; white-space: pre-wrap; word-break: break-word; margin: 0.8em 0; }
${s('pre code')} { background: transparent; padding: 0; color: inherit; font-size: 12.5px; }
${s('table')} { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
${s('th, td')} { border: 1px solid #cbd5e1; padding: 5px 8px; vertical-align: top; text-align: left; }
${s('th')} { background: #f1f5f9; }
${s('td > p, th > p')} { margin: 0; }
${s('img')} { max-width: 100%; height: auto; border-radius: 4px; }
${s('mark')} { background: #fef08a; }
${s('a')} { color: var(--c); }
${s('hr')} { border: 0; border-top: 1px solid #e2e8f0; margin: 1.5em 0; }
${s('.drawing svg')} { width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 6px; }
${s('.file-attachment')} { margin: 0.5em 0; }
${s('.hljs-comment, .hljs-quote')} { color: #7d8799; font-style: italic; }
${s('.hljs-keyword, .hljs-selector-tag, .hljs-literal')} { color: #c792ea; }
${s('.hljs-string, .hljs-attribute, .hljs-addition')} { color: #a5d6a7; }
${s('.hljs-number, .hljs-symbol')} { color: #f78c6c; }
${s('.hljs-title, .hljs-section')} { color: #82aaff; }
${s('.hljs-type, .hljs-built_in')} { color: #ffcb6b; }
${s('.hljs-attr, .hljs-variable, .hljs-property')} { color: #f07178; }
${s('.hljs-name, .hljs-tag')} { color: #89ddff; }`
}

/** Colorea los bloques de código del HTML. */
function highlight(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  doc.querySelectorAll('pre code').forEach((el) => {
    const lang = [...el.classList].find((c) => c.startsWith('language-'))?.slice(9)
    if (lang && lang !== 'plaintext' && hljs.getLanguage(lang)) hljs.highlightElement(el as HTMLElement)
  })
  return doc.body.firstElementChild!.innerHTML
}

function bodyHtml(d: ExportData): string {
  const many = d.sections.length > 1
  const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  let out = `<div class="doc-header"><p class="doc-sub">${esc(d.subtitle)}</p><h1 class="doc-title">${esc(d.heading)}</h1><p class="doc-date">Exportado el ${date} · Cuadernos DAW</p></div>`
  if (many) {
    out += `<h2>Índice</h2><ol>${d.sections.map((s) => `<li><b>${esc(s.title)}</b>${s.notes.length ? ` — ${s.notes.map((n) => esc(n.title)).join(' · ')}` : ''}</li>`).join('')}</ol>`
  }
  d.sections.forEach((s, i) => {
    if (many) out += `<h2 class="unit">${i + 1}. ${esc(s.title)}</h2>`
    if (!s.notes.length) out += '<p><i>Este tema no tiene apuntes.</i></p>'
    for (const n of s.notes) {
      if (!d.single) out += `<h3 class="note-title">${esc(n.title)}</h3>`
      if (n.tags.length) out += `<p class="tags">${n.tags.map((t) => `#${esc(t)}`).join(' ')}</p>`
      out += highlight(n.html)
    }
  })
  return out
}

function htmlDocument(d: ExportData, word = false): string {
  const ns = word ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"' : ''
  return `<!doctype html><html lang="es"${ns}><head><meta charset="utf-8"><title>${esc(d.heading)}</title><style>:root{--c:${d.notebook.color}} body{max-width:780px;margin:32px auto;padding:0 20px}${css()}</style></head><body>${bodyHtml(d)}</body></html>`
}

function markdown(d: ExportData): string {
  const many = d.sections.length > 1
  let out = `# ${d.heading}\n\n_${d.subtitle}_\n`
  d.sections.forEach((s, i) => {
    if (many) out += `\n## ${i + 1}. ${s.title}\n`
    for (const n of s.notes) {
      if (!d.single) out += `\n${many ? '###' : '##'} ${n.title}\n`
      if (n.tags.length) out += `\n${n.tags.map((t) => `#${t}`).join(' ')}\n`
      out += `\n${many ? n.markdown.replace(/^(#{1,3}) /gm, '###$1 ') : n.markdown}\n`
    }
  })
  return out
}

function plainText(d: ExportData): string {
  let out = `${d.heading}\n${d.subtitle}\n${'='.repeat(40)}\n`
  d.sections.forEach((s, i) => {
    if (d.sections.length > 1) out += `\n\n${i + 1}. ${s.title.toUpperCase()}\n${'-'.repeat(40)}\n`
    for (const n of s.notes) {
      if (!d.single) out += `\n${n.title}\n`
      out += `\n${n.text}\n`
    }
  })
  return out
}

/** PDF generado en el navegador (A4, se descarga directamente). */
async function pdf(d: ExportData): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;left:-20000px;top:0;width:760px;background:#fff'
  holder.innerHTML = `<style>.export-root{--c:${d.notebook.color};width:760px;padding:0;background:#fff}${css('.export-root')}
    .export-root, .export-root * { font-family: helvetica, Arial, sans-serif; }
    .export-root code, .export-root pre, .export-root pre * { font-family: courier, 'Courier New', monospace; }
    .export-root h1, .export-root h2, .export-root h3, .export-root th, .export-root b, .export-root strong { font-weight: bold; }
    .export-root ul, .export-root ol { list-style: none; padding-left: 1.2em; }
    .export-root .marker { display: inline-block; min-width: 1.3em; color: #475569; }
  </style><div class="export-root">${bodyHtml(d)}</div>`
  // El generador de PDF no dibuja viñetas ni números de lista: se escriben como texto
  holder.querySelectorAll('li').forEach((li) => {
    const list = li.parentElement
    if (!list || list.getAttribute('data-type') === 'taskList') return
    const marker = document.createElement('span')
    marker.className = 'marker'
    const index = [...list.children].indexOf(li) + Number(list.getAttribute('start') ?? 1)
    marker.textContent = list.tagName === 'OL' ? `${index}.` : '•'
    const first = li.firstElementChild
    if (first && first.tagName === 'P') first.prepend(marker)
    else li.prepend(marker)
  })
  holder.querySelectorAll('ul[data-type="taskList"] > li').forEach((li) => {
    const box = li.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    const label = li.querySelector('label')
    if (label) label.textContent = box?.checked || li.getAttribute('data-checked') === 'true' ? '[x]' : '[ ]'
  })
  document.body.appendChild(holder)
  try {
    const images = [...holder.querySelectorAll('img')]
    await Promise.all(images.map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)))))
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    await new Promise<void>((resolve, reject) => {
      doc
        .html(holder.querySelector('.export-root') as HTMLElement, {
          callback: () => resolve(),
          margin: [40, 36, 40, 36],
          autoPaging: 'text',
          width: 523,
          windowWidth: 760,
          html2canvas: { useCORS: true, backgroundColor: '#ffffff' },
        })
        .catch(reject)
    })
    return doc.output('blob')
  } finally {
    holder.remove()
  }
}

export async function buildFile(d: ExportData, format: Format): Promise<Blob> {
  const type = FORMATS.find((f) => f.id === format)!.mime
  switch (format) {
    case 'pdf':
      return pdf(d)
    case 'doc':
      return new Blob(['﻿', htmlDocument(d, true)], { type })
    case 'html':
      return new Blob([htmlDocument(d)], { type: `${type};charset=utf-8` })
    case 'md':
      return new Blob([markdown(d)], { type: `${type};charset=utf-8` })
    case 'txt':
      return new Blob([plainText(d)], { type: `${type};charset=utf-8` })
  }
}

interface WritableHandle {
  createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>
}

/**
 * «Guardar como»: en Chrome/Edge abre la ventana del sistema para elegir carpeta y nombre
 * (hay que pedirla al pulsar, antes de preparar el archivo). En otros navegadores devuelve null
 * y el archivo se descarga con `download`.
 */
export async function pickSaveLocation(filename: string, format: Format): Promise<WritableHandle | null | 'cancelled'> {
  const picker = (window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<WritableHandle> }).showSaveFilePicker
  if (!picker) return null
  const f = FORMATS.find((x) => x.id === format)!
  try {
    return await picker({ suggestedName: filename, types: [{ description: f.label, accept: { [f.mime]: [`.${f.ext}`] } }] })
  } catch (e) {
    return (e as Error).name === 'AbortError' ? 'cancelled' : null
  }
}

export async function writeFile(blob: Blob, filename: string, handle: WritableHandle | null) {
  if (handle) {
    const w = await handle.createWritable()
    await w.write(blob)
    await w.close()
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
