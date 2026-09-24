import { CheckCircle2, Layers, RefreshCw, Sparkles, XCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getNotebook } from '../../data/notebooks'
import { AIError, askJson, clip, QUIZ_SCHEMA, type QuizQuestion } from '../../lib/ai'
import { createCards } from '../../lib/cards'
import { btnGhost, btnPrimary, Modal } from '../ui'
import type { StudySource } from './AssistantProvider'
import { Thinking } from './CardsGenerator'

type Level = 'fácil' | 'media' | 'difícil'

export default function QuizModal({ source, onClose }: { source: StudySource; onClose: () => void }) {
  const [count, setCount] = useState(8)
  const [level, setLevel] = useState<Level>('media')
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedCards, setSavedCards] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)
  const nb = getNotebook(source.notebook)

  useEffect(() => () => abort.current?.abort(), [])

  async function generate() {
    if (!source.text.trim()) return setError('Este contenido está vacío: escribe algo en los apuntes primero.')
    setLoading(true)
    setError(null)
    setChecked(false)
    setSavedCards(null)
    abort.current = new AbortController()
    try {
      const { questions: qs } = await askJson<{ questions: QuizQuestion[] }>(
        `Crea un test tipo examen de ${count} preguntas de opción múltiple, dificultad ${level}, sobre estos apuntes de ${nb?.name}.\n` +
          `- Cada pregunta tiene exactamente 4 opciones y solo una correcta; las incorrectas deben ser creíbles.\n` +
          `- "correct" es el índice (0, 1, 2 o 3) de la opción correcta. Varía la posición de la correcta.\n` +
          `- "explanation" explica en 1-2 frases por qué es la correcta.\n\n` +
          `Apuntes «${source.title}»:\n"""\n${clip(source.text)}\n"""`,
        QUIZ_SCHEMA,
        { signal: abort.current.signal },
      )
      const valid = qs.filter((q) => q.question && q.options?.length >= 2 && q.correct >= 0 && q.correct < q.options.length)
      if (!valid.length) throw new AIError('La IA no ha generado preguntas válidas. Vuelve a intentarlo.')
      setQuestions(valid)
      setAnswers(valid.map(() => null))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(e instanceof AIError ? e.message : 'No se pudo generar el test.')
    } finally {
      setLoading(false)
    }
  }

  const score = questions ? questions.filter((q, i) => answers[i] === q.correct).length : 0
  const wrong = questions?.filter((q, i) => answers[i] !== q.correct) ?? []

  async function saveMistakes() {
    try {
      await createCards(
        wrong.map((q) => ({
          notebook: source.notebook,
          front: q.question,
          back: `${q.options[q.correct]}\n\n${q.explanation}`,
          note_id: source.noteId ?? null,
        })),
      )
      setSavedCards(wrong.length)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Modal title={`Test: ${source.title || 'Sin título'}`} onClose={onClose} wide>
      {!questions && !loading && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">La IA creará un test de opción múltiple a partir de tus apuntes de {nb?.name}.</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-400">Preguntas:</span>
            {[5, 8, 12].map((n) => (
              <Chip key={n} on={count === n} onClick={() => setCount(n)}>{n}</Chip>
            ))}
            <span className="ml-3 text-slate-600 dark:text-slate-400">Dificultad:</span>
            {(['fácil', 'media', 'difícil'] as Level[]).map((l) => (
              <Chip key={l} on={level === l} onClick={() => setLevel(l)}>{l}</Chip>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={generate} className={`${btnPrimary} flex items-center gap-2`}>
              <Sparkles size={15} /> Crear test
            </button>
          </div>
        </div>
      )}
      {loading && <Thinking text="Preparando las preguntas…" />}
      {questions && !loading && (
        <div className="space-y-4">
          {checked && (
            <div className={`rounded-lg p-4 text-center ${score / questions.length >= 0.5 ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
              <p className="text-2xl font-bold">
                {score} / {questions.length}
              </p>
              <p className="text-sm">Nota: {((score / questions.length) * 10).toFixed(1).replace('.', ',')}</p>
            </div>
          )}
          <ol className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {questions.map((q, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <p className="font-medium">
                  {i + 1}. {q.question}
                </p>
                <div className="mt-2 space-y-1.5">
                  {q.options.map((opt, j) => {
                    const chosen = answers[i] === j
                    const state = checked ? (j === q.correct ? 'right' : chosen ? 'wrong' : 'idle') : chosen ? 'chosen' : 'idle'
                    return (
                      <button
                        key={j}
                        disabled={checked}
                        onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))}
                        className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                          state === 'right'
                            ? 'border-green-500 bg-green-50 dark:bg-green-950'
                            : state === 'wrong'
                              ? 'border-red-500 bg-red-50 dark:bg-red-950'
                              : state === 'chosen'
                                ? 'border-violet-500 bg-violet-50 dark:bg-violet-950'
                                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="font-semibold text-slate-400">{'ABCD'[j] ?? j + 1}</span>
                        <span className="flex-1">{opt}</span>
                        {state === 'right' && <CheckCircle2 size={16} className="shrink-0 text-green-600" />}
                        {state === 'wrong' && <XCircle size={16} className="shrink-0 text-red-600" />}
                      </button>
                    )
                  })}
                </div>
                {checked && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">💡 {q.explanation}</p>}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={generate} className={`${btnGhost} flex items-center gap-1.5`}>
              <RefreshCw size={14} /> Otro test
            </button>
            {checked && wrong.length > 0 && savedCards === null && (
              <button onClick={saveMistakes} className={`${btnGhost} flex items-center gap-1.5`}>
                <Layers size={14} /> Guardar los {wrong.length} fallos como tarjetas
              </button>
            )}
            {savedCards !== null && <span className="text-sm text-green-600">✓ {savedCards} tarjetas creadas</span>}
            <span className="flex-1" />
            {!checked && (
              <button onClick={() => setChecked(true)} disabled={answers.some((a) => a === null)} className={btnPrimary}>
                {answers.some((a) => a === null) ? `Responde todas (${answers.filter((a) => a !== null).length}/${questions.length})` : 'Corregir'}
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
    </Modal>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 capitalize ${on ? 'bg-violet-600 text-white' : 'border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}
    >
      {children}
    </button>
  )
}
