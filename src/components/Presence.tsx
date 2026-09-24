import { useEffect, useState } from 'react'
import type { Awareness } from 'y-protocols/awareness'
import type { CollabUser } from '../lib/collab'

/** Avatares de las personas que tienen el apunte abierto ahora mismo. */
export default function Presence({ awareness }: { awareness: Awareness }) {
  const [users, setUsers] = useState<(CollabUser & { id: number })[]>([])

  useEffect(() => {
    const update = () => {
      const seen = new Set<string>()
      const list: (CollabUser & { id: number })[] = []
      awareness.getStates().forEach((state, id) => {
        const u = state.user as CollabUser | undefined
        if (id === awareness.clientID || !u || seen.has(u.email)) return
        seen.add(u.email)
        list.push({ id, ...u })
      })
      setUsers(list)
    }
    update()
    awareness.on('change', update)
    return () => awareness.off('change', update)
  }, [awareness])

  if (!users.length) return null
  return (
    <div className="flex -space-x-1.5" title={`También aquí: ${users.map((u) => u.email).join(', ')}`}>
      {users.slice(0, 4).map((u) => (
        <span
          key={u.id}
          className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold uppercase text-white ring-2 ring-white dark:ring-slate-950"
          style={{ background: u.color }}
        >
          {u.name.slice(0, 1)}
        </span>
      ))}
      {users.length > 4 && (
        <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-400 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950">
          +{users.length - 4}
        </span>
      )}
    </div>
  )
}
