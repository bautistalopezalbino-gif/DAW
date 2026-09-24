import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import sql001 from '../../supabase/migrations/001_esquema_inicial.sql?raw'
import sql002 from '../../supabase/migrations/002_compartir_etiquetas_tarjetas_calendario.sql?raw'

const MIGRATION_002 = /notebook_shares|flashcards|events|user_tags|notebook_role|column notes\.(tags|ydoc)|tags does not exist|ydoc|Bucket not found/i
const SQL_EDITOR = 'https://supabase.com/dashboard/project/blddhijulwlzvvtwzzlo/sql/new'

export default function ErrorBanner({ error }: { error: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!error) return null
  const needs002 = MIGRATION_002.test(error)
  const missing = needs002 || /schema cache|does not exist|Could not find the function/i.test(error)
  const sql = needs002 ? sql002 : sql001

  async function copy() {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      {missing ? (
        <>
          <p className="font-semibold">Falta actualizar la base de datos en Supabase</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Pulsa <b>Copiar SQL</b>.</li>
            <li>Pulsa <b>Abrir el SQL Editor</b>, pega (Ctrl+V) y pulsa <b>Run</b>.</li>
            <li>Cuando ponga «Success», vuelve aquí y recarga la página (F5).</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={copy} className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700">
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar SQL'}
            </button>
            <a
              href={SQL_EDITOR}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border border-amber-400 px-3 py-1.5 font-medium hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              <ExternalLink size={15} /> Abrir el SQL Editor
            </a>
          </div>
        </>
      ) : (
        <p>Error: {error}</p>
      )}
    </div>
  )
}
