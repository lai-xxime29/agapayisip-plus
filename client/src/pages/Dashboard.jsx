import { useAuth } from '../lib/AuthContext'
import { ROLE_LABELS } from '../lib/nav'
import BhwDashboard from './BhwDashboard'
import PsychDashboard from './PsychDashboard'
import PatientHome from './PatientHome'
import OverviewDashboard from './OverviewDashboard'

// Each role's dashboard from the Figma file replaces its placeholder, one by one.
export default function Dashboard() {
  const { profile } = useAuth()
  if (profile.role === 'bhw') return <BhwDashboard />
  if (profile.role === 'psychiatrist') return <PsychDashboard />
  if (profile.role === 'patient') return <PatientHome />
  if (profile.role === 'coordinator' || profile.role === 'administrator') return <OverviewDashboard />
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
