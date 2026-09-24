import { generateHTML } from '@tiptap/core'
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

interface PrintSection {
  id: string
  title: string
  notes: { title: string; tags: string[]; html: string }[]
}

interface Page {
  heading: string
  subtitle: string
  color: string
  single: boolean // un solo apunte
  sections: PrintSection[]
}

/**
 * Vista limpia para imprimir o «Guardar como PDF»:
 *  /imprimir/apunte/:id      un apunte
 *  /imprimir/tema/:id        un tema (unidad) completo
 *  /imprimir/temas/:id1,id2  varios temas del mismo cuaderno, con portada e índice
 */
export default function PrintPage() {
  const { kind, id } = useParams()
  const [page, setPage] = useState<Page | null>(null)
  const [error, setError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const printed = useRef(false)

  useEffect(() => {
    async function load() {
      const render = async (notes: Note[]) => {
        const urls = await resolveUrls(notes.map((n) => n.content))
        return notes.map((n) => ({
          title: n.title || 'Sin título',
          tags: n.tags ?? [],
          html: generateHTML(withUrls(n.content, urls), contentExtensions),
        }))
      }
      if (kind === 'apunte') {
        const n = await getNote(id!)
        const section = await getSection(n.section_id)
        const nb = getNotebook(section.notebook)!
        setPage({
          heading: n.title || 'Sin título',
          subtitle: `${nb.name} · ${section.title}`,
          color: nb.color,
          single: true,
          sections: [{ id: section.id, title: section.title, notes: await render([n]) }],
        })
        document.title = `${n.title || 'Apunte'} · Cuadernos DAW`
        return
      }
      const ids = (id ?? '').split(',').filter(Boolean)
      const sections = await Promise.all(
        ids.map(async (sid) => {
          const [section, notes] = await Promise.all([getSection(sid), listNotesFull(sid)])
          return { section, notes }
        }),
      )
      if (!sections.length) throw new Error('No hay temas que exportar.')
      const nb = getNotebook(sections[0].section.notebook)!
      const many = sections.length > 1
      setPage({
        heading: many ? nb.name : sections[0].section.title,
        subtitle: many ? `${sections.length} temas` : nb.name,
        color: nb.color,
        single: false,
        sections: await Promise.all(
          sections.map(async ({ section, notes }) => ({ id: section.id, title: section.title, notes: await render(notes) })),
        ),
      })
      document.title = `${many ? nb.name : sections[0].section.title} · Cuadernos DAW`
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
          <p className="mt-1 text-xs text-slate-400">
            Exportado el {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · Cuadernos DAW
          </p>
        </header>

        {page.sections.length > 1 && (
          <nav className="mb-10">
            <h2 className="mb-2 text-lg font-bold">Índice</h2>
            <ol className="list-decimal space-y-1 pl-6 text-sm">
              {page.sections.map((s) => (
                <li key={s.id}>
                  <span className="font-medium">{s.title}</span>
                  {s.notes.length > 0 && <span className="text-slate-500"> — {s.notes.map((n) => n.title).join(' · ')}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {page.sections.map((s, si) => (
          <section key={s.id} className={page.sections.length > 1 ? `print-break pt-2 ${si > 0 ? 'mt-14' : ''}` : ''}>
            {page.sections.length > 1 && (
              <h2 className="mb-6 border-b-2 pb-2 text-2xl font-bold tracking-tight" style={{ borderColor: page.color }}>
                {si + 1}. {s.title}
              </h2>
            )}
            {s.notes.map((n, i) => (
              <article key={i} className={i > 0 ? 'mt-12' : ''}>
                {!page.single && <h3 className="mb-2 text-xl font-bold tracking-tight">{n.title}</h3>}
                {n.tags.length > 0 && <p className="mb-4 text-xs text-slate-500">{n.tags.map((t) => `#${t}`).join('  ')}</p>}
                <div className="tiptap prose prose-slate max-w-none prose-pre:bg-slate-900" dangerouslySetInnerHTML={{ __html: n.html }} />
              </article>
            ))}
            {s.notes.length === 0 && <p className="text-slate-500">Este tema no tiene apuntes.</p>}
          </section>
        ))}
      </div>
    </div>
  )
}
