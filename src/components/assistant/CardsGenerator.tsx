import { Check, Layers, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNotebook, NOTEBOOKS, type NotebookSlug } from '../../data/notebooks'
import { AIError, askJson, CARDS_SCHEMA, clip, type GeneratedCard } from '../../lib/ai'
import { listSections, type Section } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { createCards } from '../../lib/cards'
import { sectionSource } from '../../lib/studySource'
import { btnGhost, btnPrimary, inputCls, Modal } from '../ui'
import type { StudySource } from './AssistantProvider'

type Draft = GeneratedCard & { keep: boolean }

export default function CardsGenerator({ source: initial, onClose }: { source?: StudySource; onClose: () => void }) {
  const { session } = useAuth()
  const [source, setSource] = useState<StudySource | undefined>(initial)
  const [count, setCount] = useState(10)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  // Selector de tema cuando se abre sin apunte (desde Repaso)
  const [pickNotebook, setPickNotebook] = useState<NotebookSlug>('pro')
  const [sections, setSections] = useState<Section[]>([])
  const [pickSection, setPickSection] = useState('')

  useEffect(() => {
    if (source) return
    listSections(pickNotebook, session!.user.id)
      .then((s) => {
        setSections(s)
        setPickSection(s[0]?.id ?? '')
      })
      .catch((e: Error) => setError(e.message))
  }, [pickNotebook, source, session])

  useEffect(() => () => abort.current?.abort(), [])

  async function generate(src = source) {
    if (!src) return
    if (!src.text.trim()) return setError('Este contenido está vacío: escribe algo en los apuntes primero.')
    const nb = getNotebook(src.notebook)
    setLoading(true)
    setError(null)
    setSaved(null)
    abort.current = new AbortController()
    try {
      const { cards } = await askJson<{ cards: GeneratedCard[] }>(
        `Crea ${count} tarjetas de repaso (pregunta en el anverso, respuesta en el reverso) para estudiar para un examen de ${nb?.name}.\n` +
          `- Preguntas concretas que se puedan responder de memoria; respuestas cortas (1-3 frases), sin repetir ideas.\n` +
          `- Cubre lo más importante y lo que suele caer en examen.\n` +
          `- Si aparece código, puedes preguntar qué hace o cómo se escribe algo.\n\n` +
          `Apuntes «${src.title}»:\n"""\n${clip(src.text)}\n"""`,
        CARDS_SCHEMA,
        { signal: abort.current.signal },
      )
      setDrafts(cards.filter((c) => c.front?.trim()).map((c) => ({ ...c, keep: true })))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof AIError ? e.message : 'No se pudieron generar las tarjetas.')
    } finally {
      setLoading(false)
    }
  }

  async function chooseSection() {
    if (!pickSection) return
    setLoading(true)
    try {
      const src = { ...(await sectionSource(pickSection)), noteId: null }
      setSource(src)
      await generate(src)
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  async function save() {
    if (!drafts || !source) return
    const chosen = drafts.filter((d) => d.keep && d.front.trim())
    if (!chosen.length) return
    setLoading(true)
    try {
      await createCards(chosen.map((d) => ({ notebook: source.notebook, front: d.front.trim(), back: d.back.trim(), note_id: source.noteId ?? null })))
      setSaved(chosen.length)
      setDrafts(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const edit = (i: number, patch: Partial<Draft>) => setDrafts((list) => list!.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const kept = drafts?.filter((d) => d.keep).length ?? 0

  return (
    <Modal title="Generar tarjetas con IA" onClose={onClose} wide>
      {!source ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Elige un tema: la IA leerá todos sus apuntes y creará las tarjetas.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={pickNotebook} onChange={(e) => setPickNotebook(e.target.value as NotebookSlug)} className={inputCls}>
              {NOTEBOOKS.map((n) => (
                <option key={n.slug} value={n.slug}>{n.name}</option>
              ))}
            </select>
            <select value={pickSection} onChange={(e) => setPickSection(e.target.value)} className={inputCls} disabled={!sections.length}>
              {sections.length === 0 && <option>Este cuaderno no tiene temas</option>}
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          <CountPicker count={count} setCount={setCount} />
          <div className="flex justify-end">
            <button onClick={chooseSection} disabled={!pickSection || loading} className={`${btnPrimary} flex items-center gap-2`}>
              <Sparkles size={15} /> {loading ? 'Generando…' : 'Generar tarjetas'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            De: <b className="text-slate-700 dark:text-slate-300">{source.title || 'Sin título'}</b> · {getNotebook(source.notebook)?.name}
          </p>
          {!drafts && !loading && saved === null && (
            <>
              <CountPicker count={count} setCount={setCount} />
              <div className="flex justify-end">
                <button onClick={() => generate()} className={`${btnPrimary} flex items-center gap-2`}>
                  <Sparkles size={15} /> Generar tarjetas
                </button>
              </div>
            </>
          )}
          {loading && <Thinking text="La IA está leyendo los apuntes y creando las tarjetas…" />}
          {drafts && !loading && (
            <>
              <p className="text-xs text-slate-500">Revisa y edita las tarjetas. Desmarca las que no quieras guardar.</p>
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {drafts.map((d, i) => (
                  <li key={i} className={`rounded-lg border p-2.5 ${d.keep ? 'border-slate-200 dark:border-slate-700' : 'border-dashed border-slate-200 opacity-50 dark:border-slate-800'}`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={d.keep} onChange={(e) => edit(i, { keep: e.target.checked })} className="mt-2" aria-label="Guardar esta tarjeta" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <textarea rows={2} value={d.front} onChange={(e) => edit(i, { front: e.target.value })} className={`${inputCls} font-medium`} />
                        <textarea rows={2} value={d.back} onChange={(e) => edit(i, { back: e.target.value })} className={`${inputCls} text-slate-600 dark:text-slate-400`} />
                      </div>
                      <button onClick={() => setDrafts((l) => l!.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:text-red-600" title="Quitar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button onClick={() => generate()} className={`${btnGhost} flex items-center gap-1.5`}>
                  <RefreshCw size={14} /> Generar otras
                </button>
                <span className="flex-1" />
                <button onClick={save} disabled={!kept} className={`${btnPrimary} flex items-center gap-2`}>
                  <Check size={15} /> Guardar {kept} tarjeta{kept === 1 ? '' : 's'}
                </button>
              </div>
            </>
          )}
          {saved !== null && (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
              <p className="font-medium">¡{saved} tarjetas guardadas!</p>
              <div className="mt-3 flex gap-2">
                <Link to="/repaso" onClick={onClose} className={`${btnPrimary} flex items-center gap-1.5`}>
                  <Layers size={15} /> Ir a repasar
                </Link>
                <button onClick={() => setSaved(null)} className={btnGhost}>Generar más</button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
    </Modal>
  )
}

function CountPicker({ count, setCount }: { count: number; setCount: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-600 dark:text-slate-400">Número de tarjetas:</span>
      {[5, 10, 15, 20].map((n) => (
        <button
          key={n}
          onClick={() => setCount(n)}
          className={`rounded-md px-2.5 py-1 ${count === n ? 'bg-violet-600 text-white' : 'border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export function Thinking({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-violet-50 px-4 py-6 text-sm text-violet-800 dark:bg-violet-950 dark:text-violet-200">
      <Sparkles size={18} className="animate-pulse" /> {text}
    </div>
  )
}
