import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { PHASE_LABEL, RISK_LABEL, RISK_TONE } from '../lib/labels'
import { time12, longDate, greeting } from '../lib/format'
import { Badge, Card, PatientCell, Table } from '../components/ui'
import ReferralQueue from '../components/ReferralQueue'
import RescheduleRequests from '../components/RescheduleRequests'

const APPT_TONE = { upcoming: 'blue', missed: 'red', completed: 'green', reschedule_requested: 'amber', rescheduled: 'gray' }
const APPT_LABEL = { upcoming: 'Upcoming', missed: 'Missed', completed: 'Completed', reschedule_requested: 'Reschedule requested', rescheduled: 'Rescheduled' }

export default function PsychDashboard() {
  const { profile } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + 86400000)
    const week = new Date(Date.now() - 7 * 86400000).toISOString()
    const [today, refs, resched, highCount, notes, highList] = await Promise.all([
      supabase.from('appointments')
        .select('appointment_id, patient_id, scheduled_at, status, patients(purok, initials, risk_level, case_phase)')
        .gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString()).order('scheduled_at'),
      supabase.from('referrals').select('urgency').eq('status', 'referred'),
      supabase.from('appointments').select('appointment_id', { count: 'exact', head: true }).eq('status', 'reschedule_requested'),
      supabase.from('patients').select('patient_id', { count: 'exact', head: true }).eq('risk_level', 'high').eq('is_archived', false),
      supabase.from('patient_notes').select('note_id', { count: 'exact', head: true }).neq('author_id', profile.user_id).gte('created_at', week),
      supabase.from('patients').select('patient_id, initials, purok, case_phase').eq('risk_level', 'high').eq('is_archived', false).order('patient_id').limit(5),
    ])
    const bad = [today, refs, resched, highCount, notes, highList].find((r) => r.error)?.error
    if (bad) { setError(bad.message); return }

    const ids = [...new Set([...today.data.map((a) => a.patient_id), ...highList.data.map((p) => p.patient_id)])]
    const names = {}
    if (ids.length) {
      const { data: idRows } = await supabase.from('patient_identities').select('patient_id, full_name').in('patient_id', ids)
      ;(idRows ?? []).forEach((r) => { names[r.patient_id] = r.full_name })
    }
    setError('')
    setData({ today: today.data, refs: refs.data, resched: resched.count ?? 0, high: highCount.count ?? 0, notes: notes.count ?? 0, highList: highList.data, names })
  }, [profile])

  useEffect(() => { load() }, [load])

  if (error) return <p role="alert" className="text-st-red text-sm">Could not load the dashboard: {error}</p>
  if (!data) return <p className="text-sm text-muted">Loading…</p>

  const { today, refs, resched, high, notes, highList, names } = data
  const done = today.filter((a) => a.status === 'completed').length
  const firstUpcoming = today.find((a) => a.status === 'upcoming')?.appointment_id
  const tiles = [
    { n: today.length, label: 'Appointments today', sub: `${done} completed, ${today.length - done} to go`, tone: 'text-ink' },
    { n: refs.length, label: 'Referrals waiting', sub: `${refs.filter((r) => r.urgency === 'urgent').length} urgent`, tone: 'text-st-red' },
    { n: resched, label: 'Reschedule requests', sub: 'Need a new date', tone: 'text-st-amber' },
    { n: high, label: 'High-risk patients', sub: 'Immediate-risk answer is Yes', tone: 'text-st-red' },
    { n: notes, label: 'Recent notes', sub: 'From BHWs, last 7 days', tone: 'text-brand-teal' },
  ]

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-3xl">{greeting()}, {profile.full_name}</h1>
        <p className="text-sm text-muted mt-1">{longDate()}. You have {today.length} appointment{today.length === 1 ? '' : 's'} today.</p>
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

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5 min-w-0">
          <Card title="Today's schedule">
            <Table heads={['Time', 'Patient', 'Risk', 'Care phase', 'Status', '']}>
              {today.length === 0 && <tr><td colSpan={6} className="px-5 py-4 text-muted">No appointments today.</td></tr>}
              {today.map((a) => (
                <tr key={a.appointment_id}>
                  <td className="px-5 py-2.5 whitespace-nowrap">{time12(new Date(a.scheduled_at))}</td>
                  <td className="px-5 py-2.5"><PatientCell id={a.patient_id} patient={a.patients} fullName={names[a.patient_id]} /></td>
                  <td className="px-5 py-2.5"><Badge tone={RISK_TONE[a.patients?.risk_level]}>{RISK_LABEL[a.patients?.risk_level]}</Badge></td>
                  <td className="px-5 py-2.5 text-muted">{PHASE_LABEL[a.patients?.case_phase]}</td>
                  <td className="px-5 py-2.5"><Badge tone={APPT_TONE[a.status]}>{APPT_LABEL[a.status]}</Badge></td>
                  <td className="px-5 py-2.5 text-right">
                    <Link to={`/consultations/${a.patient_id}?appointment=${a.appointment_id}`}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${a.appointment_id === firstUpcoming ? 'bg-brand-teal text-white' : 'border border-line bg-white'}`}>
                      {a.status === 'completed' ? 'View' : a.appointment_id === firstUpcoming ? 'Start' : 'Open'}
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
          <ReferralQueue limit={5} onChange={load} showLink />
        </div>

        <div className="space-y-5">
          <RescheduleRequests limit={3} onChange={load} showLink />
          <Card title="High-risk watchlist" action={<Link to="/patients" className="text-sm font-semibold text-brand-teal">View patients ›</Link>}>
            <ul>
              {highList.length === 0 && <li className="px-5 pb-4 text-sm text-muted">No high-risk patients.</li>}
              {highList.map((p) => (
                <li key={p.patient_id} className="border-t border-line first:border-t-0">
                  <Link to={`/consultations/${p.patient_id}`} className="flex items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-field">
                    <span className="min-w-0">
                      <span className="font-semibold">{names[p.patient_id] ?? p.initials}</span>
                      <span className="text-muted"> {p.patient_id}</span>
                      <span className="block text-xs text-muted">{p.purok}. {PHASE_LABEL[p.case_phase]}.</span>
                    </span>
                    <Badge tone="red">High</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
