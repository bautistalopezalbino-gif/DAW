import type { RealtimeChannel } from '@supabase/supabase-js'
import type { JSONContent } from '@tiptap/core'
import { getSchema } from '@tiptap/core'
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import * as Y from 'yjs'
import { contentExtensions } from './editorExtensions'
import { supabase } from './supabase'

export const FIELD = 'default'
/** Origen de los cambios que vienen de la base de datos (no se retransmiten). */
export const DB_ORIGIN = 'db'

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

let schema: ReturnType<typeof getSchema> | null = null

/**
 * Crea el documento Yjs de un apunte: desde el estado guardado (ydoc) o, si el apunte
 * es anterior a la colaboración, desde su JSON. La conversión usa siempre clientID 0,
 * así dos personas que abren a la vez un apunte antiguo generan exactamente el mismo
 * estado inicial y Yjs no lo duplica al fusionar.
 */
export function createNoteDoc(ydoc: string | null, content: JSONContent | null): Y.Doc {
  const doc = new Y.Doc()
  if (ydoc) {
    Y.applyUpdate(doc, fromBase64(ydoc), DB_ORIGIN)
  } else if (content?.content?.length) {
    schema ??= getSchema(contentExtensions)
    const seed = new Y.Doc()
    seed.clientID = 0
    prosemirrorJSONToYXmlFragment(schema, content, seed.getXmlFragment(FIELD))
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(seed), DB_ORIGIN)
    seed.destroy()
  }
  return doc
}

export interface CollabUser {
  name: string
  color: string
  email: string
}

const COLORS = ['#e8590c', '#3b5bdb', '#0ca678', '#f08c00', '#c2255c', '#7048e8', '#1098ad', '#2f9e44']

export function userFor(email: string): CollabUser {
  let h = 0
  for (const ch of email) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { name: email.split('@')[0], color: COLORS[h % COLORS.length], email }
}

type MetaListener = (meta: { title?: string }) => void

/**
 * Proveedor Yjs sobre un canal privado de Supabase Realtime ("note:<id>").
 * Las políticas RLS del canal solo dejan entrar a quien puede ver el apunte
 * y solo dejan enviar a los editores.
 */
export class SupabaseProvider {
  readonly awareness: Awareness
  private channel: RealtimeChannel
  private metaListeners = new Set<MetaListener>()
  private destroyed = false
  private resync: number | undefined

  constructor(
    noteId: string,
    readonly doc: Y.Doc,
    private readonly canWrite: boolean,
  ) {
    this.awareness = new Awareness(doc)
    this.channel = supabase.channel(`note:${noteId}`, {
      config: { private: true, broadcast: { self: false } },
    })

    this.channel
      .on('broadcast', { event: 'y' }, ({ payload }) => Y.applyUpdate(doc, fromBase64(payload.u), this))
      .on('broadcast', { event: 'sync-req' }, ({ payload }) => {
        // Alguien entra (o comprueba que no le falta nada): le mandamos lo que le falte y quiénes estamos
        const missing = Y.encodeStateAsUpdate(doc, fromBase64(payload.sv))
        if (missing.length > 2) this.send('sync-res', { u: toBase64(missing) })
        this.sendAwareness([doc.clientID])
      })
      .on('broadcast', { event: 'sync-res' }, ({ payload }) => Y.applyUpdate(doc, fromBase64(payload.u), this))
      .on('broadcast', { event: 'aw' }, ({ payload }) =>
        applyAwarenessUpdate(this.awareness, fromBase64(payload.u), this),
      )
      .on('broadcast', { event: 'meta' }, ({ payload }) => this.metaListeners.forEach((l) => l(payload)))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !this.destroyed) {
          this.send('sync-req', { sv: toBase64(Y.encodeStateVector(doc)) })
          this.sendAwareness([doc.clientID])
        }
      })

    doc.on('update', this.onDocUpdate)
    this.awareness.on('update', this.onAwarenessUpdate)

    // Broadcast no garantiza la entrega: cada 15 s pedimos lo que nos falte (respuesta vacía si no falta nada)
    this.resync = window.setInterval(() => {
      if (document.visibilityState === 'visible') this.send('sync-req', { sv: toBase64(Y.encodeStateVector(doc)) })
    }, 15_000)
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this && origin !== DB_ORIGIN) this.send('y', { u: toBase64(update) })
  }

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin !== this) this.sendAwareness([...added, ...updated, ...removed])
  }

  private sendAwareness(clients: number[]) {
    this.send('aw', { u: toBase64(encodeAwarenessUpdate(this.awareness, clients)) })
  }

  private send(event: string, payload: Record<string, unknown>) {
    if (!this.canWrite || this.destroyed) return
    void this.channel.send({ type: 'broadcast', event, payload })
  }

  sendMeta(meta: { title?: string }) {
    this.send('meta', meta)
  }

  onMeta(listener: MetaListener): () => void {
    this.metaListeners.add(listener)
    return () => this.metaListeners.delete(listener)
  }

  destroy() {
    window.clearInterval(this.resync)
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'destroy')
    this.destroyed = true
    this.doc.off('update', this.onDocUpdate)
    this.awareness.off('update', this.onAwarenessUpdate)
    this.awareness.destroy()
    void supabase.removeChannel(this.channel)
  }
}
