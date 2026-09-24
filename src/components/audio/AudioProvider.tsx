import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { pickVoice, speechSupported, textSegments, type Lang, type Segment } from '../../lib/speech'

/** Lo que se está escuchando: un apunte, un tema, un resumen… */
export interface Track {
  title: string
  subtitle?: string
  segments: Segment[]
}

export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused'
export type LangMode = 'auto' | Lang

export interface AudioSettings {
  rate: number
  langMode: LangMode
  voices: Partial<Record<Lang, string>> // voiceURI elegida por idioma
}

interface AudioState {
  track: Track | null
  index: number
  status: AudioStatus
  error: string | null
  settings: AudioSettings
  voices: SpeechSynthesisVoice[]
  supported: boolean
}

interface AudioActions {
  /** Empieza a leer (sustituye lo que se estuviera escuchando). */
  play: (track: Track, start?: number) => void
  /** Muestra el reproductor mientras se prepara el audio (p. ej. un resumen de la IA). */
  playAsync: (title: string, subtitle: string, load: () => Promise<Segment[]>) => void
  /** Lee un texto suelto (una selección, una palabra, una tarjeta…). */
  speak: (text: string, fallback?: Lang, title?: string) => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (index: number) => void
  close: () => void
  setSettings: (patch: Partial<AudioSettings>) => void
}

const StateContext = createContext<AudioState | null>(null)
const ActionsContext = createContext<AudioActions | null>(null)

export function useAudio(): AudioState {
  const ctx = useContext(StateContext)
  if (!ctx) throw new Error('useAudio fuera de AudioProvider')
  return ctx
}

export function useAudioActions(): AudioActions {
  const ctx = useContext(ActionsContext)
  if (!ctx) throw new Error('useAudioActions fuera de AudioProvider')
  return ctx
}

const SETTINGS_KEY = 'audio-ajustes'
const DEFAULTS: AudioSettings = { rate: 1, langMode: 'auto', voices: {} }

function loadSettings(): AudioSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const supported = speechSupported()
  const [track, setTrack] = useState<Track | null>(null)
  const [index, setIndex] = useState(0)
  const [status, setStatusState] = useState<AudioStatus>('idle')
  const statusRef = useRef<AudioStatus>('idle')
  const setStatus = useCallback((s: AudioStatus) => {
    statusRef.current = s
    setStatusState(s)
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettingsState] = useState<AudioSettings>(loadSettings)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  // Refs para los callbacks de la voz (se ejecutan fuera del ciclo de React)
  const trackRef = useRef<Track | null>(null)
  const indexRef = useRef(0)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const voicesRef = useRef(voices)
  voicesRef.current = voices
  const token = useRef(0) // invalida los eventos de frases anteriores
  const timer = useRef<number | undefined>(undefined)
  const utterance = useRef<SpeechSynthesisUtterance | null>(null) // evita que Chrome la libere antes de terminar
  const failures = useRef(0)

  useEffect(() => {
    if (!supported) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      window.speechSynthesis.cancel()
    }
  }, [supported])

  const silence = useCallback(() => {
    token.current++
    window.clearTimeout(timer.current)
    if (supported) window.speechSynthesis.cancel()
  }, [supported])

  const speakAt = useCallback(
    (i: number) => {
      silence()
      const t = trackRef.current
      if (!t) return
      if (i >= t.segments.length) {
        indexRef.current = 0
        setIndex(0)
        setStatus('paused')
        return
      }
      indexRef.current = i
      setIndex(i)
      setStatus('playing')
      const seg = t.segments[i]
      const { rate, langMode, voices: chosen } = settingsRef.current
      const lang = langMode === 'auto' ? seg.lang : langMode
      const u = new SpeechSynthesisUtterance(seg.text)
      const voice = pickVoice(voicesRef.current, lang, chosen[lang])
      if (voice) u.voice = voice
      u.lang = voice?.lang ?? (lang === 'es' ? 'es-ES' : 'en-GB')
      u.rate = rate
      const mine = ++token.current
      u.onend = () => {
        if (mine !== token.current) return
        failures.current = 0
        timer.current = window.setTimeout(() => speakAt(i + 1), (seg.pause ?? 0) / rate)
      }
      u.onerror = (e) => {
        if (mine !== token.current || e.error === 'interrupted' || e.error === 'canceled') return
        if (e.error === 'not-allowed') {
          // El navegador exige una pulsación antes de hablar
          setStatus('paused')
          return
        }
        if (++failures.current > 3) {
          setStatus('paused')
          setError('El navegador no ha podido leer el texto. Prueba con otra voz en los ajustes del reproductor.')
          return
        }
        speakAt(i + 1)
      }
      utterance.current = u
      window.speechSynthesis.speak(u)
    },
    [silence, setStatus],
  )

  const play = useCallback(
    (t: Track, start = 0) => {
      setError(null)
      if (!supported) {
        setTrack(t)
        trackRef.current = t
        setStatus('paused')
        setError('Tu navegador no puede leer en voz alta. Prueba con Chrome, Edge o Safari.')
        return
      }
      if (!t.segments.length) {
        setError('No hay texto que leer.')
        return
      }
      failures.current = 0
      trackRef.current = t
      setTrack(t)
      speakAt(Math.min(Math.max(0, start), t.segments.length - 1))
    },
    [supported, speakAt, setStatus],
  )

  const loadId = useRef(0)
  const playAsync = useCallback(
    (title: string, subtitle: string, load: () => Promise<Segment[]>) => {
      silence()
      const id = ++loadId.current
      const placeholder = { title, subtitle, segments: [] }
      trackRef.current = placeholder
      setTrack(placeholder)
      setIndex(0)
      setError(null)
      setStatus('loading')
      load()
        .then((segments) => id === loadId.current && play({ title, subtitle, segments }))
        .catch((e: Error) => {
          if (id !== loadId.current) return
          setStatus('paused')
          setError(e.message)
        })
    },
    [silence, play, setStatus],
  )

  const speak = useCallback(
    (text: string, fallback: Lang = 'es', title = 'Selección') => play({ title, segments: textSegments(text, fallback) }),
    [play],
  )

  const groupStart = (segs: Segment[], i: number) => {
    let j = i
    while (j > 0 && segs[j - 1].group === segs[i].group) j--
    return j
  }

  const seek = useCallback(
    (i: number) => {
      const t = trackRef.current
      if (!t?.segments.length) return
      const target = Math.min(Math.max(0, i), t.segments.length - 1)
      if (statusRef.current === 'playing') speakAt(target)
      else {
        indexRef.current = target
        setIndex(target)
      }
    },
    [speakAt],
  )

  const next = useCallback(() => {
    const segs = trackRef.current?.segments
    if (!segs?.length) return
    let j = indexRef.current
    while (j < segs.length && segs[j].group === segs[indexRef.current].group) j++
    if (j < segs.length) seek(j)
  }, [seek])

  const prev = useCallback(() => {
    const segs = trackRef.current?.segments
    if (!segs?.length) return
    const i = indexRef.current
    const start = groupStart(segs, i)
    seek(start < i || start === 0 ? start : groupStart(segs, start - 1))
  }, [seek])

  const toggle = useCallback(() => {
    if (statusRef.current === 'playing') {
      silence()
      setStatus('paused')
    } else if (statusRef.current === 'paused' && trackRef.current?.segments.length) {
      setError(null)
      failures.current = 0
      speakAt(indexRef.current)
    }
  }, [silence, speakAt, setStatus])

  const close = useCallback(() => {
    silence()
    loadId.current++
    trackRef.current = null
    setTrack(null)
    setStatus('idle')
    setError(null)
  }, [silence, setStatus])

  const setSettings = useCallback(
    (patch: Partial<AudioSettings>) => {
      const next = { ...settingsRef.current, ...patch }
      settingsRef.current = next
      setSettingsState(next)
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        /* sin almacenamiento: los ajustes duran hasta cerrar la pestaña */
      }
      // Velocidad o voz nuevas: se repite la frase actual con ellas
      if (statusRef.current === 'playing') speakAt(indexRef.current)
    },
    [speakAt],
  )

  // La pantalla no se apaga mientras se escucha (móvil en el bus)
  useEffect(() => {
    if (status !== 'playing' || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let active = true
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (active) lock = l
          else void l.release()
        })
        .catch(() => {})
    const onVisible = () => document.visibilityState === 'visible' && void request()
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [status])

  const state = useMemo<AudioState>(
    () => ({ track, index, status, error, settings, voices, supported }),
    [track, index, status, error, settings, voices, supported],
  )
  const actions = useMemo<AudioActions>(
    () => ({ play, playAsync, speak, toggle, next, prev, seek, close, setSettings }),
    [play, playAsync, speak, toggle, next, prev, seek, close, setSettings],
  )

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  )
}
