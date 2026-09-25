import { CalendarDays, Home, Layers, LogOut, Menu, Moon, PanelLeftOpen, Search, Settings, Sparkles, Sun, Trash2, Users, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { getNotebook, NOTEBOOKS } from '../data/notebooks'
import { userTags } from '../lib/api'
import { useAuth } from '../lib/auth'
import { countDue } from '../lib/cards'
import { usePanelsHidden } from '../lib/focusMode'
import { SHARES_CHANGED, sharedWithMe, type Share } from '../lib/shares'
import { supabase } from '../lib/supabase'
import { tagColor, TAGS_CHANGED } from '../lib/tags'
import { useTheme } from '../lib/theme'
import { AssistantProvider, useAssistant } from './assistant/AssistantProvider'
import AudioBar from './audio/AudioBar'
import { AudioProvider, useAudio } from './audio/AudioProvider'
import { CollapsibleHeading, useCollapsed } from './Collapsible'
import SearchDialog from './SearchDialog'

export default function Layout() {
  return (
    <AudioProvider>
      <AssistantProvider>
        <Shell />
      </AssistantProvider>
    </AudioProvider>
  )
}

function AssistantButton() {
  const { isOpen, setOpen } = useAssistant()
  const { track } = useAudio()
  if (isOpen) return null
  return (
    <button
      onClick={() => setOpen(true)}
      title="Asistente IA (Ctrl+J)"
      className={`fixed ${track ? 'bottom-24' : 'bottom-5'} right-5 z-30 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-violet-600/30 transition hover:scale-105`}
    >
      <Sparkles size={18} /> <span className="hidden sm:inline">Asistente</span>
    </button>
  )
}

function Shell() {
  const { session } = useAuth()
  const email = session?.user.email ?? ''
  const { dark, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shared, setShared] = useState<Share[]>([])
  const [tags, setTags] = useState<{ tag: string; uses: number }[]>([])
  const [due, setDue] = useState(0)
  const location = useLocation()
  const assistant = useAssistant()
  const [mineCollapsed, toggleMine] = useCollapsed('lateral-mis-cuadernos')
  const [sharedCollapsed, toggleShared] = useCollapsed('lateral-compartidos')
  const [panelsHidden, setPanelsHidden] = usePanelsHidden()

  useEffect(() => setMenuOpen(false), [location.pathname])

  // Contador de tarjetas pendientes (se refresca al navegar)
  useEffect(() => {
    countDue()
      .then(setDue)
      .catch(() => {})
  }, [location.pathname])

  useEffect(() => {
    const loadShared = () => sharedWithMe(email).then(setShared).catch(() => {})
    const loadTags = () => userTags().then(setTags).catch(() => {})
    loadShared()
    loadTags()
    window.addEventListener(SHARES_CHANGED, loadShared)
    window.addEventListener(TAGS_CHANGED, loadTags)
    return () => {
      window.removeEventListener(SHARES_CHANGED, loadShared)
      window.removeEventListener(TAGS_CHANGED, loadTags)
    }
  }, [email])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          Cuadernos DAW
        </Link>
        <button className="rounded p-1 hover:bg-slate-200 md:hidden dark:hover:bg-slate-800" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
          <X size={18} />
        </button>
      </div>

      <button
        onClick={() => setSearchOpen(true)}
        className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Buscar</span>
        <kbd className="rounded border border-slate-200 px-1 text-[10px] dark:border-slate-700">Ctrl K</kbd>
      </button>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        <Item to="/" end icon={<Home size={15} />}>Inicio</Item>
        <Item to="/repaso" icon={<Layers size={15} />} badge={due}>Repaso</Item>
        <Item to="/calendario" icon={<CalendarDays size={15} />}>Calendario</Item>
        <Item to="/papelera" icon={<Trash2 size={15} />}>Papelera</Item>

        <CollapsibleHeading collapsed={mineCollapsed} onToggle={toggleMine} count={NOTEBOOKS.length}>
          Mis cuadernos
        </CollapsibleHeading>
        {!mineCollapsed &&
          NOTEBOOKS.map((n) => (
            <Item key={n.slug} to={`/c/${n.slug}`} icon={<span className="block h-3 w-3 rounded-sm" style={{ background: n.color }} />}>
              {n.name}
            </Item>
          ))}

        <CollapsibleHeading collapsed={sharedCollapsed} onToggle={toggleShared} count={shared.length}>
          Compartidos conmigo
        </CollapsibleHeading>
        {!sharedCollapsed && shared.length === 0 && (
          <p className="px-3 py-1 text-xs text-slate-400">Nadie ha compartido cuadernos contigo todavía.</p>
        )}
        {!sharedCollapsed &&
          shared.map((s) => {
            const nb = getNotebook(s.notebook)
            return (
              <Item
                key={s.id}
                to={`/s/${s.owner_id}/${s.notebook}`}
                icon={<Users size={14} style={{ color: nb?.color }} />}
                title={`${nb?.name} de ${s.owner_email}`}
              >
                {nb?.code} · <span className="text-slate-400">{s.owner_email.split('@')[0]}</span>
              </Item>
            )
          })}

        {tags.length > 0 && (
          <>
            <Heading>
              <Link to="/etiqueta" className="hover:underline">Etiquetas</Link>
            </Heading>
            <div className="flex flex-wrap gap-1 px-2">
              {tags.slice(0, 14).map((t) => (
                <NavLink
                  key={t.tag}
                  to={`/etiqueta/${encodeURIComponent(t.tag)}`}
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ color: tagColor(t.tag), background: `color-mix(in srgb, ${tagColor(t.tag)} 14%, transparent)` }}
                >
                  #{t.tag}
                </NavLink>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <p className="truncate px-1 pb-2 text-xs text-slate-500" title={email}>{email}</p>
        <div className="flex gap-1">
          <NavLink to="/ajustes" title="Ajustes" className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
            <Settings size={14} /> Ajustes
          </NavLink>
          <button onClick={toggle} title={dark ? 'Modo claro' : 'Modo oscuro'} className="rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={() => supabase.auth.signOut()} title="Cerrar sesión" className="rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    // En pantallas grandes el asistente no tapa el contenido: la página se estrecha a su lado
    <div className={`flex h-full transition-[padding] ${assistant.isOpen ? 'lg:pr-[440px]' : ''}`}>
      {panelsHidden ? (
        // Paneles ocultos: queda una tira estrecha para volver a mostrarlos
        <div className="hidden w-11 shrink-0 flex-col items-center gap-1 border-r border-slate-200 bg-slate-50 py-3 md:flex dark:border-slate-800 dark:bg-slate-900">
          <button onClick={() => setPanelsHidden(false)} title="Mostrar los paneles laterales" aria-label="Mostrar los paneles laterales" className="rounded-md p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
            <PanelLeftOpen size={18} />
          </button>
          <Link to="/" title="Inicio" aria-label="Inicio" className="rounded-md p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
            <Home size={18} />
          </Link>
          <button onClick={() => setSearchOpen(true)} title="Buscar (Ctrl+K)" aria-label="Buscar" className="rounded-md p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
            <Search size={18} />
          </button>
        </div>
      ) : (
        <div className="hidden md:block">{sidebar}</div>
      )}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="relative h-full w-64">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 md:hidden dark:border-slate-800">
          <button onClick={() => setMenuOpen(true)} className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <Link to="/" className="flex-1 font-semibold">Cuadernos DAW</Link>
          <button onClick={() => setSearchOpen(true)} className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Buscar">
            <Search size={18} />
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
        <AudioBar />
      </div>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
      <AssistantButton />
    </div>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <p className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</p>
}

function Item({ to, icon, children, badge, end, title }: { to: string; icon: ReactNode; children: ReactNode; badge?: number; end?: boolean; title?: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={title}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${
          isActive
            ? 'bg-white font-medium shadow-sm dark:bg-slate-800'
            : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/60'
        }`
      }
    >
      <span className="grid w-4 shrink-0 place-items-center text-slate-400">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {!!badge && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{badge}</span>}
    </NavLink>
  )
}
