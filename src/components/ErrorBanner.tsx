import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import sql001 from '../../supabase/migrations/001_esquema_inicial.sql?raw'
import sql002 from '../../supabase/migrations/002_compartir_etiquetas_tarjetas_calendario.sql?raw'

const MIGRATION_002 = /notebook_shares|flashcards|events|user_tags|notebook_role|column notes\.(tags|ydoc)|tags does not exist|ydoc|Bucket not found/i
const SQL_EDITOR = 'https://supabase.com/dashboard/project/blddhijulwlzvvtwzzlo/sql/new'

// El editor de Supabase puede cortar textos largos al pegar: se copia por partes (marcadas con «@parte»)
function splitParts(sql: string): string[] {
  return sql
    .split('-- @parte ')
    .map((p, i) => (i ? `-- @parte ${p}` : p).trim())
    .filter(Boolean)
}

export default function ErrorBanner({ error }: { error: string | null }) {
  const [copied, setCopied] = useState<Set<number>>(new Set())
  const [last, setLast] = useState<number | null>(null)
  if (!error) return null
  const needs002 = MIGRATION_002.test(error)
  const missing = needs002 || /schema cache|does not exist|Could not find the function/i.test(error)
  const parts = splitParts(needs002 ? sql002 : sql001)

  async function copy(i: number) {
    await navigator.clipboard.writeText(parts[i] + '\n')
    setCopied((s) => new Set(s).add(i))
    setLast(i)
  }

  return (
    <div className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      {missing ? (
        <>
          <p className="font-semibold">Falta actualizar la base de datos en Supabase</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Pulsa <b>Abrir el SQL Editor</b> (se abre en otra pestaña).
            </li>
            <li>
              Pulsa <b>Parte 1</b>, ve al editor, borra lo que haya (Ctrl+A), pega (Ctrl+V) y pulsa <b>Run</b>.
            </li>
            <li>Cuando ponga «Success», repite con la siguiente parte, en orden, hasta la última.</li>
            <li>Vuelve aquí y recarga la página (F5).</li>
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={SQL_EDITOR}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-amber-400 px-3 py-1.5 font-medium hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              <ExternalLink size={15} /> Abrir el SQL Editor
            </a>
            {parts.map((_, i) => (
              <button
                key={i}
                onClick={() => copy(i)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-white ${
                  copied.has(i) ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {copied.has(i) ? <Check size={15} /> : <Copy size={15} />} Parte {i + 1}
              </button>
            ))}
          </div>
          {last !== null && (
            <p className="mt-2 text-xs">
              Parte {last + 1} de {parts.length} copiada. Pégala en el SQL Editor y pulsa Run.
              {last + 1 < parts.length ? ` Después copia la parte ${last + 2}.` : ' ¡Era la última! Luego recarga esta página.'}
            </p>
          )}
        </>
      ) : (
        <p>Error: {error}</p>
      )}
    </div>
  )
}
