import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { longDate, greeting } from '../lib/format'
import { Card, Table } from '../components/ui'

// Coordinator and Administrator overview: counts only, never a name (BR-05).
export default function OverviewDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState(null)
  const [puroks, setPuroks] = useState(null)
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const isAdmin = profile.role === 'administrator'

  useEffect(() => {
    ;(async () => {
      const [o, p, u] = await Promise.all([
        supabase.from('stats_overview').select('*').single(),
        supabase.from('stats_cases_by_purok').select('*').order('purok'),
        isAdmin ? supabase.from('profiles').select('role, status') : Promise.resolve({ data: null }),
      ])
      const err = [o, p, u].find((r) => r.error)?.error
      if (err) { setError(err.message); return }
      setStats(o.data); setPuroks(p.data); setUsers(u.data)
    })()
  }, [isAdmin])

  if (error) return <p role="alert" className="text-st-red text-sm">Could not load the overview: {error}</p>
  if (!stats) return <p className="text-sm text-muted">Loading…</p>

  const pct = (a, b) => (b ? `${Math.round((Number(a) / Number(b)) * 100)}%` : '—')
  const apptDone = Number(stats.appts_completed), apptMissed = Number(stats.appts_missed)
  const tiles = [
    { n: stats.active_patients, label: 'Active patients', sub: 'All puroks', tone: 'text-brand-teal' },
    { n: stats.high_risk_patients, label: 'High risk', sub: 'Flagged by screening', tone: 'text-st-red' },
    { n: pct(apptDone, apptDone + apptMissed), label: 'Attendance', sub: `${apptDone} attended, ${apptMissed} missed`, tone: 'text-st-green' },
    { n: pct(stats.referrals_arrived, stats.referrals_total), label: 'Referrals arrived', sub: `${stats.referrals_arrived} of ${stats.referrals_total} reached the RHU`, tone: 'text-st-blue' },
    { n: stats.visits_open, label: 'Home visits open', sub: `${stats.visits_completed} completed`, tone: 'text-st-amber' },
  ]

  const roleCount = (r) => users?.filter((x) => x.role === r && x.status === 'active').length ?? 0

  return (
    <div className="max-w-[1100px] space-y-5">
      <div>
        <h1 className="text-3xl">{greeting()}, {profile.full_name.split(' ')[0]}</h1>
        <p className="text-sm text-muted mt-1">{longDate()}. Program overview. Counts only, no patient names.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 rounded-xl border border-line bg-white divide-x divide-line">
        {tiles.map((t) => (
          <div key={t.label} className="p-4">
            <p className={`font-serif text-3xl font-semibold ${t.tone}`}>{t.n}</p>
            <p className="text-sm font-semibold mt-1">{t.label}</p>
            <p className="text-xs text-muted">{t.sub}</p>
          </div>
        ))}
      </div>

      <Card title="Cases by purok">
        <Table heads={['Purok', 'Active cases', 'High risk', 'Discharged']}>
          {puroks.length === 0 && <tr><td className="px-5 py-4 text-muted" colSpan={4}>No data yet.</td></tr>}
          {puroks.map((r) => (
            <tr key={r.purok}>
              <td className="px-5 py-2.5 font-semibold">{r.purok}</td>
              <td className="px-5 py-2.5">{r.active_cases}</td>
              <td className="px-5 py-2.5">{r.high_risk_cases}</td>
              <td className="px-5 py-2.5">{r.discharged_cases}</td>
            </tr>
          ))}
        </Table>
      </Card>

      {isAdmin && (
        <Card title="Active accounts">
          <div className="grid grid-cols-2 sm:grid-cols-4 px-5 pb-5 gap-4">
            {[['bhw', 'BHWs'], ['psychiatrist', 'Psychiatrists'], ['coordinator', 'Coordinators'], ['patient', 'Patient logins']].map(([r, l]) => (
              <div key={r}><p className="font-serif text-2xl font-semibold">{roleCount(r)}</p><p className="text-sm text-muted">{l}</p></div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
