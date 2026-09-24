import { Download, FileDown, LogOut, Moon, Sun, Upload, UserMinus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ErrorBanner from '../components/ErrorBanner'
import { btnPrimary, inputCls } from '../components/ui'
import { getNotebook, NOTEBOOKS, type NotebookSlug } from '../data/notebooks'
import { useAuth } from '../lib/auth'
import { exportBackup, importBackup, notebookMarkdown, type Backup } from '../lib/backup'
import { downloadFile, todayStamp } from '../lib/download'
import { removeShare, SHARES_CHANGED, sharedWithMe, type Share } from '../lib/shares'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'

export default function SettingsPage() {
  const { session } = useAuth()
  const myId = session!.user.id
  const myEmail = session!.user.email ?? ''
  const { dark, toggle } = useTheme()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mdNotebook, setMdNotebook] = useState<NotebookSlug>('pro')
  const [shared, setShared] = useState<Share[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    sharedWithMe(myEmail)
      .then(setShared)
      .catch(() => {})
  }, [myEmail])

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(label)
    setMessage(null)
    setError(null)
    try {
      const msg = await fn()
      if (msg) setMessage(msg)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const backup = () =>
    run('backup', async () => {
      const data = await exportBackup(myId)
      downloadFile(`cuadernos-daw-${todayStamp()}.json`, JSON.stringify(data, null, 1), 'application/json')
      return `Copia descargada: ${data.sections.length} temas, ${data.notes.length} apuntes, ${data.flashcards.length} tarjetas y ${data.events.length} eventos.`
    })

  const restore = (file: File) =>
    run('import', async () => {
      const data = JSON.parse(await file.text()) as Backup
      if (!window.confirm('Se AÑADIRÁN los temas, apuntes, tarjetas y eventos de la copia a los que ya tienes. ¿Continuar?')) return
      const r = await importBackup(data, myId)
      return `Importado: ${r.sections} temas, ${r.notes} apuntes, ${r.cards} tarjetas y ${r.events} eventos.`
    })

  const markdown = () =>
    run('md', async () => {
      const nb = getNotebook(mdNotebook)!
      const md = await notebookMarkdown(nb.slug, nb.name, myId)
      downloadFile(`${nb.slug}-${todayStamp()}.md`, md, 'text/markdown')
    })

  async function leave(s: Share) {
    if (!window.confirm(`¿Salir del cuaderno «${getNotebook(s.notebook)?.name}» de ${s.owner_email}?`)) return
    await removeShare(s.id).catch((e: Error) => setError(e.message))
    setShared((list) => list.filter((x) => x.id !== s.id))
    window.dispatchEvent(new Event(SHARES_CHANGED))
  }

  return (
    <div className="h-full overflow-y-auto">
      <ErrorBanner error={error} />
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        {message && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{message}</p>}

        <Section title="Cuenta">
          <p className="text-sm text-slate-600 dark:text-slate-400">Has iniciado sesión como <b>{myEmail}</b>.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={toggle} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              {dark ? <Sun size={15} /> : <Moon size={15} />} Modo {dark ? 'claro' : 'oscuro'}
            </button>
            <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              <LogOut size={15} /> Cerrar sesión
            </button>
          </div>
        </Section>

        <Section title="Copia de seguridad">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Descarga todos tus temas, apuntes, tarjetas y eventos en un archivo JSON. Puedes importarlo después (por ejemplo, en otra
            cuenta); se añade a lo que ya haya, no borra nada.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={backup} disabled={!!busy} className={`${btnPrimary} flex items-center gap-2`}>
              <Download size={15} /> {busy === 'backup' ? 'Preparando…' : 'Descargar copia'}
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={!!busy}
              className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <Upload size={15} /> {busy === 'import' ? 'Importando…' : 'Importar copia'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void restore(f)
              }}
            />
          </div>
        </Section>

        <Section title="Exportar un cuaderno a Markdown">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Todo el cuaderno en un solo archivo .md (se abre con VS Code, Obsidian, Typora…). Para PDF, abre un tema o apunte y usa
            «Imprimir / PDF».
          </p>
          <div className="mt-3 flex gap-2">
            <select value={mdNotebook} onChange={(e) => setMdNotebook(e.target.value as NotebookSlug)} className={`${inputCls} max-w-xs`}>
              {NOTEBOOKS.map((n) => (
                <option key={n.slug} value={n.slug}>{n.name}</option>
              ))}
            </select>
            <button onClick={markdown} disabled={!!busy} className={`${btnPrimary} flex shrink-0 items-center gap-2`}>
              <FileDown size={15} /> {busy === 'md' ? 'Preparando…' : 'Descargar'}
            </button>
          </div>
        </Section>

        <Section title="Cuadernos compartidos conmigo">
          {shared.length === 0 ? (
            <p className="text-sm text-slate-500">Nadie ha compartido cuadernos contigo todavía.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {shared.map((s) => {
                const nb = getNotebook(s.notebook)
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: nb?.color }} />
                    <span className="min-w-0 flex-1 truncate">
                      {nb?.name} <span className="text-slate-400">· {s.owner_email} · {s.role}</span>
                    </span>
                    <button onClick={() => leave(s)} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                      <UserMinus size={13} /> Salir
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  )
}
