import { generateHTML } from '@tiptap/core'
import type { JSONContent } from '@tiptap/react'
import hljs from 'highlight.js/lib/common'
import dos from 'highlight.js/lib/languages/dos'
import powershell from 'highlight.js/lib/languages/powershell'
import { Printer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getNotebook } from '../data/notebooks'
import { getNote, getSection, listNotesFull, type Note } from '../lib/api'
import { resolveUrls, withUrls } from '../lib/docExport'
import { contentExtensions } from '../lib/editorExtensions'

hljs.registerLanguage('powershell', powershell)
hljs.registerLanguage('dos', dos)

interface Page {
  heading: string
  subtitle: string
  color: string
  notes: { title: string; tags: string[]; html: string }[]
}

/** Vista limpia para imprimir o «Guardar como PDF» un apunte o un tema completo. */
export default function PrintPage() {
  const { kind, id } = useParams()
  const [page, setPage] = useState<Page | null>(null)
  const [error, setError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const printed = useRef(false)

  useEffect(() => {
    async function load() {
      let notes: Note[]
      let sectionId: string
      if (kind === 'apunte') {
        const n = await getNote(id!)
        notes = [n]
        sectionId = n.section_id
      } else {
        notes = await listNotesFull(id!)
        sectionId = id!
      }
      const section = await getSection(sectionId)
      const nb = getNotebook(section.notebook)!
      const urls = await resolveUrls(notes.map((n) => n.content))
      const html = (doc: JSONContent | null) => generateHTML(withUrls(doc, urls), contentExtensions)
      setPage({
        heading: kind === 'apunte' ? notes[0].title || 'Sin título' : section.title,
        subtitle: kind === 'apunte' ? `${nb.name} · ${section.title}` : nb.name,
        color: nb.color,
        notes: notes.map((n) => ({ title: n.title || 'Sin título', tags: n.tags ?? [], html: html(n.content) })),
      })
      document.title = `${kind === 'apunte' ? notes[0].title : section.title} · Cuadernos DAW`
    }
    load().catch((e: Error) => setError(e.message))
  }, [kind, id])

  // Resalta el código, espera a las imágenes y abre el diálogo de impresión
  useEffect(() => {
    if (!page || !root.current || printed.current) return
    printed.current = true
    root.current.querySelectorAll('pre code').forEach((el) => {
      const lang = [...el.classList].find((c) => c.startsWith('language-'))?.slice(9)
      if (lang && lang !== 'plaintext' && hljs.getLanguage(lang)) hljs.highlightElement(el as HTMLElement)
    })
    const images = [...root.current.querySelectorAll('img')]
    Promise.all(images.map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r))))).then(() =>
      setTimeout(() => window.print(), 300),
    )
  }, [page])

  if (error) return <p className="p-8 text-sm text-red-600">No se pudo preparar la impresión: {error}</p>
  if (!page) return <p className="p-8 text-sm text-slate-500">Preparando documento…</p>

  return (
    <div className="print-page min-h-full bg-white text-slate-900">
      <div className="no-print sticky top-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-3 text-sm backdrop-blur">
        <span className="text-slate-500">Para PDF, elige «Guardar como PDF» como impresora.</span>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white">
          <Printer size={15} /> Imprimir / PDF
        </button>
      </div>
      <div ref={root} className="mx-auto max-w-3xl px-8 py-10">
        <header className="mb-8 border-b-4 pb-4" style={{ borderColor: page.color }}>
          <p className="text-sm font-semibold" style={{ color: page.color }}>{page.subtitle}</p>
          <h1 className="text-3xl font-bold tracking-tight">{page.heading}</h1>
        </header>
        {page.notes.map((n, i) => (
          <article key={i} className={i > 0 ? 'print-break mt-12' : ''}>
            {kind !== 'apunte' && <h2 className="mb-2 text-2xl font-bold tracking-tight">{n.title}</h2>}
            {n.tags.length > 0 && <p className="mb-4 text-xs text-slate-500">{n.tags.map((t) => `#${t}`).join('  ')}</p>}
            <div className="tiptap prose prose-slate max-w-none prose-pre:bg-slate-900" dangerouslySetInnerHTML={{ __html: n.html }} />
          </article>
        ))}
        {page.notes.length === 0 && <p className="text-slate-500">Este tema no tiene apuntes.</p>}
      </div>
    </div>
  )
}
