import { useState, type FormEvent } from 'react'
import { NOTEBOOKS, type NotebookSlug } from '../data/notebooks'
import { createCard, updateCard, type Flashcard } from '../lib/cards'
import { btnGhost, btnPrimary, inputCls, Modal } from './ui'

interface Props {
  card?: Flashcard
  defaults?: { notebook: NotebookSlug; front?: string; back?: string; note_id?: string | null }
  onClose: () => void
  onSaved: (card: Flashcard) => void
}

export default function CardDialog({ card, defaults, onClose, onSaved }: Props) {
  const [notebook, setNotebook] = useState<NotebookSlug>(card?.notebook ?? defaults?.notebook ?? 'pro')
  const [front, setFront] = useState(card?.front ?? defaults?.front ?? '')
  const [back, setBack] = useState(card?.back ?? defaults?.back ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  async function submit(e: FormEvent, keepOpen = false) {
    e.preventDefault()
    if (!front.trim()) return
    setBusy(true)
    setError(null)
    try {
      const saved = card
        ? await updateCard(card.id, { notebook, front: front.trim(), back: back.trim() })
        : await createCard({ notebook, front: front.trim(), back: back.trim(), note_id: defaults?.note_id ?? null })
      onSaved(saved)
      if (keepOpen) {
        setFront('')
        setBack('')
        setSavedCount((n) => n + 1)
      } else onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={card ? 'Editar tarjeta' : 'Nueva tarjeta de repaso'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Cuaderno</span>
          <select value={notebook} onChange={(e) => setNotebook(e.target.value as NotebookSlug)} className={`${inputCls} mt-1`}>
            {NOTEBOOKS.map((n) => (
              <option key={n.slug} value={n.slug}>{n.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Pregunta (anverso)</span>
          <textarea autoFocus required rows={3} value={front} onChange={(e) => setFront(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-400">Respuesta (reverso)</span>
          <textarea rows={4} value={back} onChange={(e) => setBack(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedCount > 0 && <p className="text-sm text-green-600">{savedCount} tarjeta(s) guardada(s).</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          {!card && (
            <button type="button" disabled={busy} onClick={(e) => submit(e, true)} className={btnGhost}>
              Guardar y otra
            </button>
          )}
          <button disabled={busy} className={btnPrimary}>Guardar</button>
        </div>
      </form>
    </Modal>
  )
}
