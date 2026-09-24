export default function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null
  const missingTables = /schema cache|does not exist/i.test(error)
  return (
    <div className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      {missingTables ? (
        <>
          <p className="font-semibold">Falta crear las tablas en Supabase</p>
          <p className="mt-1">
            Abre tu proyecto en Supabase → <b>SQL Editor</b> → <b>New query</b>, pega el contenido de{' '}
            <code>supabase/migrations/001_esquema_inicial.sql</code> y pulsa <b>Run</b>. Luego recarga esta página.
          </p>
        </>
      ) : (
        <p>Error: {error}</p>
      )}
    </div>
  )
}
