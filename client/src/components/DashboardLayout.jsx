import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { NAV, ROLE_LABELS } from '../lib/nav'
import Logo from './Logo'

function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function DashboardLayout() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const canSearch = profile.role === 'bhw' || profile.role === 'psychiatrist'
  const items = NAV[profile.role] ?? NAV.patient

  function search(e) {
    e.preventDefault()
    navigate(q.trim() ? `/patients?q=${encodeURIComponent(q.trim())}` : '/patients')
  }

  const sidebar = (
    <aside className="w-56 shrink-0 bg-brand-deep text-sb-text flex flex-col h-full">
      <div className="px-4 pt-5 pb-4"><Logo /></div>
      <nav className="px-3 space-y-1 flex-1" aria-label="Main">
        {items.map(({ label, to }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive ? 'bg-sb-active text-white' : 'hover:bg-sb-active/50'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sb-line p-3 flex items-center gap-3">
        <div className="size-9 rounded-full bg-brand-mint text-brand-deep text-xs font-semibold grid place-items-center">
          {initials(profile.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{profile.full_name}</p>
          <p className="text-xs text-sb-muted truncate">
            {ROLE_LABELS[profile.role]}{profile.purok_assigned ? `, ${profile.purok_assigned}` : ''}
          </p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-sb-muted hover:text-white"
        >
          Log out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="h-screen flex">
      <div className="hidden md:block">{sidebar}</div>

      {open && (
        <div className="md:hidden fixed inset-0 z-20 flex">
          {sidebar}
          <button className="flex-1 bg-black/40" onClick={() => setOpen(false)} aria-label="Close menu" />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-line px-4 py-3 flex items-center gap-3">
          <button
            className="md:hidden rounded-md border border-line px-3 py-2 text-sm"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
          {profile.role === 'patient' && <span className="text-sm text-muted">Patient portal</span>}
          {canSearch && (
            <form onSubmit={search} className="flex-1 max-w-md">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-lg border border-line bg-field px-3 py-2 text-sm"
                placeholder="Search by patient ID, name or purok"
                aria-label="Search patients"
              />
            </form>
          )}
          <div className="ml-auto inline-flex rounded-md border border-line overflow-hidden text-xs font-medium">
            <span className="bg-brand-teal text-white px-3 py-1.5">English</span>
            <span className="px-3 py-1.5 text-muted">Bisaya</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
