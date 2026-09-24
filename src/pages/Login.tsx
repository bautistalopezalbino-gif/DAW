import { useState, type FormEvent } from 'react'
import { NOTEBOOKS } from '../data/notebooks'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup' | 'reset'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) setInfo('Cuenta creada. Revisa tu email y pulsa el enlace de confirmación.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setInfo('Te hemos enviado un email para restablecer la contraseña.')
      }
    } catch (err) {
      setError(translate((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<Mode, string> = {
    login: 'Iniciar sesión',
    signup: 'Crear cuenta',
    reset: 'Recuperar contraseña',
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-end justify-center gap-1.5">
          {NOTEBOOKS.map((n, i) => (
            <div
              key={n.slug}
              className="w-6 rounded-sm"
              style={{ background: n.color, height: 36 + (i % 3) * 8 }}
              title={n.name}
            />
          ))}
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight">Cuadernos DAW</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Tus apuntes del ciclo, en cualquier ordenador</p>

        <form
          onSubmit={submit}
          className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="font-semibold">{titles[mode]}</h2>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700"
            />
          </label>
          {mode !== 'reset' && (
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-400">Contraseña</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700"
              />
            </label>
          )}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
          {info && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{info}</p>}
          <button
            disabled={busy}
            className="w-full rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {busy ? 'Un momento…' : titles[mode]}
          </button>
          <div className="flex justify-between text-sm">
            {mode === 'login' ? (
              <>
                <button type="button" onClick={() => setMode('signup')} className="text-blue-700 hover:underline dark:text-blue-400">
                  Crear cuenta
                </button>
                <button type="button" onClick={() => setMode('reset')} className="text-slate-500 hover:underline">
                  ¿Olvidaste la contraseña?
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setMode('login')} className="text-blue-700 hover:underline dark:text-blue-400">
                Ya tengo cuenta
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function translate(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.'
  if (/email not confirmed/i.test(msg)) return 'Tienes que confirmar tu email antes de entrar (revisa tu correo).'
  if (/already registered/i.test(msg)) return 'Ya existe una cuenta con ese email.'
  if (/password should be at least/i.test(msg)) return 'La contraseña debe tener al menos 6 caracteres.'
  if (/email rate limit/i.test(msg))
    return 'Supabase ha llegado a su límite de emails de confirmación por hora (es un límite de todo el proyecto, no tuyo). Pide al administrador que desactive «Confirm email» en Supabase o espera una hora.'
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos seguidos desde esta conexión. Espera un par de minutos y vuelve a probar.'
  return msg
}
