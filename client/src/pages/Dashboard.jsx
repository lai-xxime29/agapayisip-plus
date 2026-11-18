import { useAuth } from '../lib/AuthContext'
import { ROLE_LABELS } from '../lib/nav'
import BhwDashboard from './BhwDashboard'

// Each role's dashboard from the Figma file replaces its placeholder, one by one.
export default function Dashboard() {
  const { profile } = useAuth()
  if (profile.role === 'bhw') return <BhwDashboard />
  const first = profile.full_name.split(' ')[0]
  return (
    <div>
      <h1 className="text-3xl">Welcome, {first}</h1>
      <p className="text-sm text-muted mt-1">
        Signed in as <strong>{profile.username}</strong> ({ROLE_LABELS[profile.role]}).
      </p>
      <div className="mt-6 rounded-xl border border-line bg-white p-6">
        <p className="text-sm text-muted">The {ROLE_LABELS[profile.role]} dashboard will appear here.</p>
      </div>
    </div>
  )
}
