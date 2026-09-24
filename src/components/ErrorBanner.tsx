const MIGRATION_002 = /notebook_shares|flashcards|events|user_tags|notebook_role|column notes\.(tags|ydoc)|tags does not exist|ydoc|Bucket not found/i

export default function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null
  const needs002 = MIGRATION_002.test(error)
  const missing = needs002 || /schema cache|does not exist|Could not find the function/i.test(error)
  const file = needs002 ? '002_compartir_etiquetas_tarjetas_calendario.sql' : '001_esquema_inicial.sql'
  return (
    <div className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      {missing ? (
        <>
          <p className="font-semibold">Falta actualizar la base de datos en Supabase</p>
          <p className="mt-1">
            Abre tu proyecto en Supabase → <b>SQL Editor</b> → <b>New query</b>, pega el contenido de{' '}
            <code>supabase/migrations/{file}</code> y pulsa <b>Run</b>. Luego recarga esta página.
          </p>
        </>
      ) : (
        <p>Error: {error}</p>
      )}
    </div>
  )
}
