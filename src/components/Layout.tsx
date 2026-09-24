import { LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { NOTEBOOKS } from '../data/notebooks'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'
import SearchDialog from './SearchDialog'

export default function Layout() {
  const { session } = useAuth()
  const { dark, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMenuOpen(false), [location.pathname])

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
        className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Buscar</span>
        <kbd className="rounded border border-slate-200 px-1 text-[10px] dark:border-slate-700">Ctrl K</kbd>
      </button>

      <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cuadernos</p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {NOTEBOOKS.map((n) => (
          <NavLink
            key={n.slug}
            to={`/c/${n.slug}`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${
                isActive
                  ? 'bg-white font-medium shadow-sm dark:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: n.color }} />
            <span className="truncate">{n.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <p className="truncate px-1 pb-2 text-xs text-slate-500" title={session?.user.email}>
          {session?.user.email}
        </p>
        <div className="flex gap-1">
          <button onClick={toggle} className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
            {dark ? <Sun size={14} /> : <Moon size={14} />} {dark ? 'Claro' : 'Oscuro'}
          </button>
          <button onClick={() => supabase.auth.signOut()} className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">
            <LogOut size={14} /> Salir
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-full">
      <div className="hidden md:block">{sidebar}</div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="relative h-full">{sidebar}</div>
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
      </div>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
