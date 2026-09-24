import { useState, type FormEvent } from 'react'
import { NOTEBOOKS, type NotebookSlug } from '../data/notebooks'
import { deleteEvent, KIND_LABEL, saveEvent, type CalendarEvent, type EventKind } from '../lib/events'
import { btnGhost, btnPrimary, inputCls, Modal } from './ui'

interface Props {
  event?: CalendarEvent
  date?: string
  onClose: () => void
  onChanged: () => void
}

export default function EventDialog({ event, date, onClose, onChanged }: Props) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'examen')
  const [notebook, setNotebook] = useState<NotebookSlug | ''>(event?.notebook ?? '')
  const [day, setDay] = useState(event?.date ?? date ?? '')
  const [details, setDetails] = useState(event?.details ?? '')
  const [done, setDone] = useState(event?.done ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveEvent({ id: event?.id, title: title.trim(), kind, notebook: notebook || null, date: day, details, done })
      onChanged()
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function remove() {
    if (!event || !window.confirm(`¿Borrar «${event.title}»?`)) return
    await deleteEvent(event.id)
    onChanged()
    onClose()
  }

  return (
    <Modal title={event ? 'Editar evento' : 'Nuevo examen o entrega'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Título</span>
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Examen UD3 · Bucles" className={`${inputCls} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Tipo</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className={`${inputCls} mt-1`}>
              {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-400">Fecha</span>
            <input type="date" required value={day} onChange={(e) => setDay(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Módulo</span>
          <select value={notebook} onChange={(e) => setNotebook(e.target.value as NotebookSlug | '')} className={`${inputCls} mt-1`}>
            <option value="">General</option>
            {NOTEBOOKS.map((n) => (
              <option key={n.slug} value={n.slug}>{n.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Notas (temas que entran, material…)</span>
          <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        {event && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /> Hecho
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          {event && (
            <button type="button" onClick={remove} className="rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
              Borrar
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button disabled={busy} className={btnPrimary}>Guardar</button>
        </div>
      </form>
    </Modal>
  )
}
