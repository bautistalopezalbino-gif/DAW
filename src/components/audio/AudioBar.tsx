import { Headphones, Loader2, Pause, Play, Settings2, SkipBack, SkipForward, X } from 'lucide-react'
import { voicesFor, type Lang } from '../../lib/speech'
import { Menu } from '../ui'
import { useAudio, useAudioActions, type LangMode } from './AudioProvider'

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2]
const CHARS_PER_SECOND = 14

/** Reproductor fijo en la parte de abajo: sigue sonando aunque cambies de página. */
export default function AudioBar() {
  const { track, index, status, error, settings, voices } = useAudio()
  const a = useAudioActions()
  if (!track) return null

  const segs = track.segments
  const seg = segs[index]
  const total = segs.length
  const progress = total ? (index / total) * 100 : 0
  const left = segs.slice(index).reduce((s, x) => s + x.text.length, 0) / CHARS_PER_SECOND / settings.rate
  const minutes = Math.max(1, Math.round(left / 60))
  const nextRate = RATES[(RATES.indexOf(settings.rate) + 1) % RATES.length] ?? 1
  const lang: Lang | undefined = seg && (settings.langMode === 'auto' ? seg.lang : settings.langMode)

  return (
    <div className="relative shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" role="region" aria-label="Reproductor de audio">
      <div
        className="absolute inset-x-0 top-0 h-1 cursor-pointer bg-slate-100 dark:bg-slate-800"
        title="Ir a otra parte"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          a.seek(Math.floor(((e.clientX - r.left) / r.width) * total))
        }}
      >
        <div className="h-full bg-violet-500 transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700 sm:grid dark:bg-violet-950 dark:text-violet-300">
          <Headphones size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-slate-500">
            <span className="font-medium text-slate-700 dark:text-slate-200">{track.title}</span>
            {track.subtitle && <> · {track.subtitle}</>}
            {total > 0 && status !== 'loading' && (
              <span className="hidden sm:inline"> · {index + 1}/{total} · quedan ~{minutes} min</span>
            )}
          </p>
          {error ? (
            <p className="truncate text-sm text-red-600" title={error}>{error}</p>
          ) : status === 'loading' ? (
            <p className="flex items-center gap-1.5 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Preparando el audio…</p>
          ) : (
            <p className="truncate text-sm" title={seg?.text}>
              {lang && (
                <span className="mr-1.5 rounded bg-slate-100 px-1 py-px text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                  {lang.toUpperCase()}
                </span>
              )}
              {seg?.text}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn title="Anterior" onClick={a.prev} disabled={!total}><SkipBack size={16} /></IconBtn>
          <button
            onClick={a.toggle}
            disabled={status === 'loading' || !total}
            title={status === 'playing' ? 'Pausa' : 'Escuchar'}
            aria-label={status === 'playing' ? 'Pausa' : 'Escuchar'}
            className="grid h-9 w-9 place-items-center rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {status === 'playing' ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="translate-x-px" />}
          </button>
          <IconBtn title="Siguiente" onClick={a.next} disabled={!total}><SkipForward size={16} /></IconBtn>
          <button
            onClick={() => a.setSettings({ rate: nextRate })}
            title="Velocidad"
            className="w-11 rounded-md py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {settings.rate}×
          </button>
          <Menu
            title="Voces e idioma"
            align="right"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            label={<Settings2 size={16} />}
          >
            {() => <SettingsPanel />}
          </Menu>
          <IconBtn title="Cerrar" onClick={a.close}><X size={16} /></IconBtn>
        </div>
      </div>
      {voices.length === 0 && status !== 'loading' && !error && (
        <p className="px-3 pb-2 text-xs text-amber-700 dark:text-amber-400">
          Cargando voces… Si no suena nada, tu navegador no tiene voces instaladas (prueba con Chrome o Edge).
        </p>
      )}
    </div>
  )
}

function SettingsPanel() {
  const { settings, voices } = useAudio()
  const a = useAudioActions()
  const select = 'w-full rounded-md border border-slate-300 bg-transparent px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900'

  const voiceSelect = (lang: Lang, label: string) => {
    const list = voicesFor(voices, lang)
    return (
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
        <select
          className={select}
          value={settings.voices[lang] ?? ''}
          onChange={(e) => a.setSettings({ voices: { ...settings.voices, [lang]: e.target.value || undefined } })}
        >
          <option value="">Automática (la mejor disponible)</option>
          {list.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
          ))}
        </select>
        {list.length === 0 && <span className="mt-1 block text-xs text-amber-600">No hay voces de este idioma en tu navegador.</span>}
      </label>
    )
  }

  return (
    <div className="space-y-3 p-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Idioma de lectura</span>
        <select className={select} value={settings.langMode} onChange={(e) => a.setSettings({ langMode: e.target.value as LangMode })}>
          <option value="auto">Automático (detecta español e inglés)</option>
          <option value="es">Todo en español</option>
          <option value="en">Todo en inglés</option>
        </select>
      </label>
      {voiceSelect('es', 'Voz en español')}
      {voiceSelect('en', 'Voz en inglés')}
      <label className="block">
        <span className="mb-1 flex justify-between text-xs font-medium text-slate-500">
          Velocidad <span>{settings.rate}×</span>
        </span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.25}
          value={settings.rate}
          onChange={(e) => a.setSettings({ rate: Number(e.target.value) })}
          className="w-full accent-violet-600"
        />
      </label>
      <p className="text-xs text-slate-400">
        Las voces son las de tu navegador y sistema. En Edge hay voces «Natural» muy realistas.
      </p>
    </div>
  )
}

function IconBtn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  )
}
