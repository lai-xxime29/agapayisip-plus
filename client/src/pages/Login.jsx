import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase, usernameToEmail } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Logo from '../components/Logo'

export default function Login() {
  const { session, notice } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    // Accept "admin" or a pasted "admin@agapayisip.local"
    const clean = username.trim().replace(/@agapayisip\.local$/i, '')
    const { data: locked } = await supabase.rpc('login_lock_seconds', { p_username: clean })
    if (locked > 0) {
      setBusy(false)
      setError(`This account is locked. Try again in ${Math.ceil(locked / 60)} minute${locked > 60 ? 's' : ''}.`)
      return
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(clean),
      password,
    })
    if (error) {
      const { data: nowLocked } = await supabase.rpc('record_login_failure', { p_username: clean })
      setBusy(false)
      setError(nowLocked > 0
        ? 'Too many wrong attempts. This account is locked for 15 minutes.'
        : 'Wrong username or password.')
      return
    }
    supabase.rpc('clear_login_failures', { p_username: clean })
    setBusy(false)
  }

  // Already signed in: go to the page they were trying to open, or the dashboard
  if (session) return <Navigate to={location.state?.from?.pathname ?? '/dashboard'} replace />

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left brand panel (hidden on small screens) */}
      <section className="hidden lg:flex flex-col justify-between bg-brand-deep text-white p-12">
        <Logo />
        <div className="max-w-md">
          <h1 className="text-4xl leading-tight">No patient is lost between visits.</h1>
          <p className="mt-4 text-sb-text">
            Records, referrals, and follow-up reminders for the barangay health centers and the
            Rural Health Unit of Dalaguete.
          </p>
        </div>
      </section>

      {/* Sign-in form */}
      <section className="flex flex-col bg-white">
        <div className="p-4 flex justify-end">
          <div className="inline-flex rounded-md border border-line overflow-hidden text-xs font-medium">
            <span className="bg-brand-teal text-white px-3 py-1.5">English</span>
            <span className="px-3 py-1.5 text-muted">Bisaya</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-16">
          <form onSubmit={handleSubmit} className="w-full max-w-sm">
            <div className="lg:hidden mb-6"><Logo light={false} /></div>
            <h2 className="text-3xl">Sign in</h2>
            <p className="text-sm text-muted mt-2">
              Use the username and password given to you by the LGU IT office.
            </p>

            {notice && <p role="alert" className="mt-4 text-sm text-st-red">{notice}</p>}

            <label className="block mt-6">
              <span className="text-xs font-semibold">Username</span>
              <input
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="block mt-4">
              <span className="text-xs font-semibold">Password</span>
              <div className="mt-1 flex items-center rounded-lg border border-line bg-white focus-within:ring-2 focus-within:ring-brand-teal">
                <input
                  type={show ? 'text' : 'password'}
                  className="w-full rounded-lg bg-transparent px-3 py-3 text-sm focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="px-3 text-xs font-semibold text-brand-teal"
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {error && <p role="alert" className="mt-3 text-sm text-st-red">{error}</p>}

            <button
              disabled={busy}
              className="mt-5 w-full rounded-lg bg-brand-teal text-white py-3 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="mt-5 rounded-lg border border-line bg-field p-4 text-sm text-muted">
              After 5 wrong attempts, the account is locked for 15 minutes. Sessions end after 30
              minutes without activity.
            </div>

            <p className="mt-4 text-xs text-muted">
              First time here? You will read the privacy notice and give consent before you
              continue. Forgot your password? Ask the LGU IT office to reset it.
            </p>
          </form>
        </div>
      </section>
    </main>
  )
}
