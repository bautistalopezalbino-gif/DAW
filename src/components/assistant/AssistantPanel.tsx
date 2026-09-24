import hljs from 'highlight.js/lib/common'
import {
  ArrowUp, Check, Copy, FileText, ListPlus, Replace, RotateCcw, Search, Sparkles, Square, TextCursorInput, X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { markdownToHtml } from '../../lib/markdown'
import { useAssistant, type Turn } from './AssistantProvider'

const GENERAL_SUGGESTIONS = [
  'Explícame la diferencia entre INNER JOIN y LEFT JOIN con un ejemplo',
  '¿Qué es la herencia en Java? Con un ejemplo de código',
  'Propón un ejercicio de HTML y CSS para practicar Flexbox',
  'Hazme un plan de estudio de una semana para un examen de Bases de Datos',
]

const NOTE_SUGGESTIONS = [
  'Resúmeme este apunte en un esquema',
  'Explícame lo más difícil de este apunte',
  'Hazme 5 preguntas de examen sobre este apunte, con las respuestas al final',
  '¿Qué me falta en este apunte para dominar el tema?',
]

export default function AssistantPanel() {
  const a = useAssistant()
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stick = useRef(true)

  useEffect(() => inputRef.current?.focus(), [])

  // Baja solo si el usuario no ha subido para leer
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [a.turns])

  // Ajusta la altura del cuadro de texto
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  function send(text = input) {
    if (!text.trim() || a.busy) return
    stick.current = true
    a.ask(text)
    setInput('')
  }

  const noteTitle = a.note?.title || 'Sin título'
  const suggestions = a.note && a.useNote ? NOTE_SUGGESTIONS : GENERAL_SUGGESTIONS

  return (
    <div className="fixed inset-0 z-40 flex justify-end sm:inset-auto sm:bottom-0 sm:right-0 sm:top-0">
      <aside className="flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[440px] dark:border-slate-800 dark:bg-slate-950">
        <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white">
            <Sparkles size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold leading-tight">Asistente IA</h2>
            <p className="text-[11px] text-slate-500">Gemini · Ctrl+J para abrir y cerrar</p>
          </div>
          <button onClick={a.reset} title="Nueva conversación" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <RotateCcw size={16} />
          </button>
          <button onClick={() => a.setOpen(false)} title="Cerrar" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2 dark:border-slate-900">
          {a.note && (
            <Toggle on={a.useNote} onClick={() => a.setUseNote(!a.useNote)} title="La IA lee el apunte abierto">
              <FileText size={12} /> <span className="max-w-40 truncate">{noteTitle}</span>
            </Toggle>
          )}
          <Toggle on={a.useSearch} onClick={() => a.setUseSearch(!a.useSearch)} title="Busca en todos tus apuntes antes de responder">
            <Search size={12} /> Buscar en mis apuntes
          </Toggle>
        </div>

        <div
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
          }}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
        >
          {a.turns.length === 0 && (
            <div className="pt-6 text-center">
              <Sparkles size={28} className="mx-auto text-violet-500" />
              <p className="mt-2 font-medium">¿En qué te ayudo?</p>
              <p className="mt-1 text-sm text-slate-500">
                {a.note && a.useNote ? `Puedo usar tu apunte «${noteTitle}».` : 'Pregúntame dudas del ciclo, pídeme ejemplos o ejercicios.'}
              </p>
              <div className="mt-5 space-y-2 text-left">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-violet-800 dark:hover:bg-violet-950"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {a.turns.map((t) => (t.role === 'user' ? <UserBubble key={t.id} turn={t} /> : <Answer key={t.id} turn={t} />))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          className="border-t border-slate-200 p-3 dark:border-slate-800"
        >
          <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-900">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Escribe tu pregunta… (Mayús+Enter: nueva línea)"
              className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-sm outline-none"
            />
            {a.busy ? (
              <button type="button" onClick={a.stop} title="Parar" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900">
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} title="Enviar" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-600 text-white disabled:opacity-40">
                <ArrowUp size={16} />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">La IA puede equivocarse. Contrasta lo importante con tus apuntes.</p>
        </form>
      </aside>
    </div>
  )
}

function Toggle({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
        on
          ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300'
          : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

function UserBubble({ turn }: { turn: Turn }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-violet-600 px-3.5 py-2 text-sm text-white">
        {turn.label ?? turn.text}
      </div>
    </div>
  )
}

function Answer({ turn }: { turn: Turn }) {
  const a = useAssistant()
  const ref = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  // Resalta el código cuando termina la respuesta
  useEffect(() => {
    if (turn.pending || !ref.current) return
    ref.current.querySelectorAll('pre code').forEach((el) => {
      const lang = [...el.classList].find((c) => c.startsWith('language-'))?.slice(9)
      if (lang && hljs.getLanguage(lang)) hljs.highlightElement(el as HTMLElement)
    })
  }, [turn.pending, turn.text])

  const canInsert = !!a.note?.canWrite && !!a.note.editor && !turn.pending && !!turn.text

  async function copy() {
    await navigator.clipboard.writeText(turn.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex gap-2">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-blue-500 to-violet-600 text-white">
        <Sparkles size={12} />
      </span>
      <div className="min-w-0 flex-1">
        {turn.sources && turn.sources.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {turn.sources.map((s) => (
              <Link key={s.url} to={s.url} className="max-w-full truncate rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:underline dark:bg-slate-800 dark:text-slate-300">
                📄 {s.title}
              </Link>
            ))}
          </div>
        )}
        {turn.text ? (
          <div
            ref={ref}
            className="ai-answer prose prose-sm prose-slate max-w-none dark:prose-invert prose-pre:my-2 prose-pre:bg-slate-900 prose-pre:p-3 prose-headings:mb-2 prose-headings:mt-3 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(turn.text) }}
          />
        ) : (
          turn.pending && (
            <div className="flex gap-1 py-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )
        )}
        {turn.error && <p className="mt-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{turn.error}</p>}
        {!turn.pending && turn.text && (
          <div className="mt-2 flex flex-wrap gap-1">
            <Action onClick={copy} icon={copied ? <Check size={13} /> : <Copy size={13} />}>{copied ? 'Copiado' : 'Copiar'}</Action>
            {canInsert && turn.range && (
              <>
                <Action onClick={() => a.insertAnswer(turn.text, 'replace', turn.range)} icon={<Replace size={13} />}>Reemplazar selección</Action>
                <Action onClick={() => a.insertAnswer(turn.text, 'below', turn.range)} icon={<TextCursorInput size={13} />}>Insertar debajo</Action>
              </>
            )}
            {canInsert && !turn.range && (
              <Action onClick={() => a.insertAnswer(turn.text, 'end')} icon={<ListPlus size={13} />}>Añadir al apunte</Action>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Action({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
      {icon} {children}
    </button>
  )
}
