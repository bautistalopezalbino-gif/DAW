import { Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { Notebook } from '../data/notebooks'
import { addShare, listShares, removeShare, SHARES_CHANGED, updateShareRole, type Share, type ShareRole } from '../lib/shares'
import { btnPrimary, inputCls, Modal } from './ui'

export default function ShareDialog({ notebook, myId, myEmail, onClose }: { notebook: Notebook; myId: string; myEmail: string; onClose: () => void }) {
  const [shares, setShares] = useState<Share[] | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ShareRole>('editor')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listShares(notebook.slug, myId)
      .then(setShares)
      .catch((e: Error) => setError(e.message))
  }, [notebook.slug, myId])

  const changed = () => window.dispatchEvent(new Event(SHARES_CHANGED))

  async function invite(e: FormEvent) {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    if (clean === myEmail.toLowerCase()) return setError('Ese es tu propio email.')
    setBusy(true)
    setError(null)
    try {
      const s = await addShare(notebook.slug, clean, role)
      setShares((list) => [...(list ?? []), s])
      setEmail('')
      changed()
    } catch (err) {
      const msg = (err as Error).message
      setError(/duplicate|unique/i.test(msg) ? 'Esa persona ya tiene acceso.' : msg)
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(s: Share, r: ShareRole) {
    setShares((list) => list!.map((x) => (x.id === s.id ? { ...x, role: r } : x)))
    await updateShareRole(s.id, r).catch((e: Error) => setError(e.message))
  }

  async function remove(s: Share) {
    if (!window.confirm(`¿Quitar el acceso de ${s.email}?`)) return
    await removeShare(s.id).catch((e: Error) => setError(e.message))
    setShares((list) => list!.filter((x) => x.id !== s.id))
    changed()
  }

  return (
    <Modal title={`Compartir «${notebook.name}»`} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500">
        Invita por email. Esa persona tiene que crear una cuenta en{' '}
        <b className="text-slate-700 dark:text-slate-300">{window.location.host}</b> con ese mismo email; verá el cuaderno en
        «Compartidos conmigo» y podréis escribir a la vez en los mismos apuntes.
      </p>
      <form onSubmit={invite} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="compañero@email.com"
          className={inputCls}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as ShareRole)} className={`${inputCls} w-28`}>
          <option value="editor">Editor</option>
          <option value="lector">Lector</option>
        </select>
        <button disabled={busy} className={`${btnPrimary} flex shrink-0 items-center gap-1.5`}>
          <UserPlus size={15} /> Invitar
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Personas con acceso</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          <li className="flex items-center gap-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{myEmail} <span className="text-slate-400">(tú)</span></span>
            <span className="text-xs text-slate-500">Propietario</span>
          </li>
          {shares === null && !error && <li className="py-2 text-sm text-slate-500">Cargando…</li>}
          {shares?.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{s.email}</span>
              <select
                value={s.role}
                onChange={(e) => changeRole(s, e.target.value as ShareRole)}
                className="rounded border border-slate-200 bg-transparent px-1.5 py-1 text-xs dark:border-slate-700"
              >
                <option value="editor">Editor</option>
                <option value="lector">Lector</option>
              </select>
              <button onClick={() => remove(s)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" title="Quitar acceso">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          <b>Editor</b>: puede crear y editar temas y apuntes. <b>Lector</b>: solo puede leer. Las tarjetas de repaso y el
          calendario siguen siendo personales.
        </p>
      </div>
    </Modal>
  )
}
