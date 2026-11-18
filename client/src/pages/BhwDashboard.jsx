import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { whenLabel, referredLabel, dayLabel, longDate, greeting, daysSince, time12 } from '../lib/format'
import { Badge, Card, PatientCell, Table, GhostButton } from '../components/ui'

const APPT_TONE = { upcoming: 'blue', missed: 'red', reschedule_requested: 'amber', completed: 'green', rescheduled: 'gray' }
const APPT_LABEL = { upcoming: 'Upcoming', missed: 'Missed', reschedule_requested: 'Reschedule requested', completed: 'Completed', rescheduled: 'Rescheduled' }
const REF_TONE = { referred: 'blue', not_arrived: 'amber', arrived: 'green', closed: 'gray' }

export default function BhwDashboard() {
  const { profile } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 14 * 86400000).toISOString()
    const [appts, refs, tasks, notes, mine, failed] = await Promise.all([
      supabase.from('appointments')
        .select('appointment_id, patient_id, scheduled_at, status, reminder_sent_at, patients(purok, initials)')
        .gte('scheduled_at', since).order('scheduled_at', { ascending: true }).limit(60),
      supabase.from('referrals')
        .select('referral_id, patient_id, urgency, status, referred_at, arrived_at, patients(purok, initials)')
        .order('referred_at', { ascending: false }).limit(20),
      supabase.from('home_visit_tasks')
        .select('task_id, appointment_id, patient_id, status, created_at, patients(purok, initials)')
        .in('status', ['open', 'overdue']).order('created_at', { ascending: true }),
      supabase.from('patient_notes')
        .select('note_id, patient_id, body, created_at, author_id, author:profiles(full_name)')
        .order('created_at', { ascending: false }).limit(4),
      supabase.from('patients').select('patient_id', { count: 'exact', head: true }).eq('is_archived', false)
        .or(`purok.eq.${profile.purok_assigned},assigned_bhw.eq.${profile.user_id}`),
      supabase.from('notifications').select('notification_id', { count: 'exact', head: true })
        .in('delivery_status', ['failed', 'no_subscription']),
    ])

    const firstError = [appts, refs, tasks, notes, mine, failed].find((r) => r.error)?.error
    if (firstError) { setError(firstError.message); return }

    // Full names: the database only returns the ones this BHW is allowed to see (identity masking).
    const ids = [...new Set([...appts.data, ...refs.data, ...tasks.data].map((r) => r.patient_id))]
    const names = {}
    if (ids.length) {
      const { data: idRows } = await supabase.from('patient_identities').select('patient_id, full_name').in('patient_id', ids)
      ;(idRows ?? []).forEach((r) => { names[r.patient_id] = r.full_name })
    }

    setError('')
    setData({
      appts: appts.data, refs: refs.data, tasks: tasks.data, notes: notes.data,
      myPatients: mine.count ?? 0, failedReminders: failed.count ?? 0, names,
    })
  }, [profile])

  useEffect(() => { load() }, [load])

  if (error) return <p role="alert" className="text-st-red text-sm">Could not load the dashboard: {error}</p>
  if (!data) return <p className="text-sm text-muted">Loading…</p>

  const { appts, refs, tasks, notes, myPatients, failedReminders, names } = data
  const now = Date.now()
  const hasTask = new Set(tasks.map((t) => t.appointment_id))
  const tiles = [
    { n: appts.filter((a) => a.status === 'missed').length, label: 'Overdue check-ins', sub: 'Missed or late appointments', tone: 'text-st-amber' },
    { n: tasks.length, label: 'Home visits due', sub: 'Solo patients to visit', tone: 'text-st-red' },
    { n: appts.filter((a) => a.status === 'upcoming' && !a.reminder_sent_at && new Date(a.scheduled_at) - now < 86400000).length,
      label: 'Reminders to send', sub: 'Due within 24 hours', tone: 'text-brand-teal' },
    { n: refs.filter((r) => r.status === 'referred').length, label: 'Awaiting RHU arrival', sub: 'Referrals not yet confirmed', tone: 'text-st-blue' },
    { n: failedReminders, label: 'Contact manually', sub: 'Reminder could not be delivered', tone: 'text-ink' },
  ]

  // Appointments needing attention first, then the next ones coming up
  const apptRows = [...appts].filter((a) => a.status !== 'completed' && a.status !== 'rescheduled').slice(0, 8)
  const reminderText = (a) => {
    if (a.status === 'missed') return hasTask.has(a.appointment_id) ? 'Task created' : '—'
    if (a.status === 'reschedule_requested') return 'Awaiting reply'
    if (a.reminder_sent_at) return 'Sent'
    const auto = new Date(new Date(a.scheduled_at).getTime() - 86400000)
    return `Auto ${dayLabel(auto).split(' ')[0]} ${time12(auto)}`
  }

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">{greeting()}, {profile.full_name.split(' ')[0]}</h1>
          <p className="text-sm text-muted mt-1">
            {longDate()}. {profile.purok_assigned}. You follow {myPatients} active patients.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/new-observation" className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold">+ New observation</Link>
          <Link to="/new-referral" className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold">New referral</Link>
          <Link to="/register-patient" className="rounded-lg bg-brand-teal text-white px-3 py-2 text-sm font-semibold">Register patient</Link>
        </div>
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
          <Card title="Appointments" action={<Link to="/appointments" className="text-sm font-semibold text-brand-teal">View all ›</Link>}>
            <Table heads={['Patient', 'When', 'Status', 'Reminder', '']}>
              {apptRows.length === 0 && <tr><td className="px-5 py-4 text-muted" colSpan={5}>No appointments to show.</td></tr>}
              {apptRows.map((a) => (
                <tr key={a.appointment_id}>
                  <td className="px-5 py-2.5"><PatientCell id={a.patient_id} patient={a.patients} fullName={names[a.patient_id]} /></td>
                  <td className="px-5 py-2.5 whitespace-nowrap">{whenLabel(a.scheduled_at)}</td>
                  <td className="px-5 py-2.5"><Badge tone={APPT_TONE[a.status]}>{APPT_LABEL[a.status]}</Badge></td>
                  <td className="px-5 py-2.5 text-muted">{reminderText(a)}</td>
                  <td className="px-5 py-2.5 text-right"><GhostButton disabled title="Coming soon">Open</GhostButton></td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title="Referrals to the RHU" action={<Link to="/referrals" className="text-sm font-semibold text-brand-teal">View all ›</Link>}>
            <Table heads={['Patient', 'Referred', 'Urgency', 'Status']}>
              {refs.length === 0 && <tr><td className="px-5 py-4 text-muted" colSpan={4}>No referrals yet.</td></tr>}
              {refs.slice(0, 5).map((r) => (
                <tr key={r.referral_id}>
                  <td className="px-5 py-2.5"><PatientCell id={r.patient_id} patient={r.patients} fullName={names[r.patient_id]} /></td>
                  <td className="px-5 py-2.5 whitespace-nowrap">{referredLabel(r.referred_at)}</td>
                  <td className="px-5 py-2.5"><Badge tone={r.urgency === 'urgent' ? 'solidRed' : 'gray'}>{r.urgency === 'urgent' ? 'Urgent' : 'Routine'}</Badge></td>
                  <td className="px-5 py-2.5">
                    <Badge tone={REF_TONE[r.status]}>
                      {r.status === 'referred' && 'Awaiting arrival'}
                      {r.status === 'not_arrived' && `Not arrived, ${daysSince(r.referred_at)} days`}
                      {r.status === 'arrived' && `Arrived ${dayLabel(r.arrived_at).slice(4)}`}
                      {r.status === 'closed' && 'Closed'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Your tasks" action={<Link to="/home-visits" className="text-sm font-semibold text-brand-teal">View all ›</Link>}>
            {tasks.length === 0 && <p className="px-5 pb-4 text-sm text-muted">No home visits waiting.</p>}
            <ul>
              {tasks.map((t) => <TaskRow key={t.task_id} task={t} name={names[t.patient_id]} onDone={load} />)}
            </ul>
          </Card>

          <Card title="Care-team notes" action={<Link to="/team-notes" className="text-sm font-semibold text-brand-teal">Open notes ›</Link>}>
            <ul className="divide-y divide-line">
              {notes.length === 0 && <li className="px-5 pb-4 text-sm text-muted">No notes yet.</li>}
              {notes.map((n) => (
                <li key={n.note_id} className="px-5 py-3 text-sm">
                  <p className="text-xs text-muted">
                    {n.author_id === profile.user_id ? 'You' : n.author?.full_name} on {n.patient_id}, {whenLabel(n.created_at)}
                  </p>
                  <p className="mt-1">{n.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function TaskRow({ task, name, onDone }) {
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const overdue = task.status === 'overdue'
  const late = Math.max(1, daysSince(task.created_at) - 3)

  async function save(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.from('home_visit_tasks')
      .update({ status: 'completed', outcome: outcome.trim(), completed_at: new Date().toISOString() })
      .eq('task_id', task.task_id)
    setBusy(false)
    if (error) setErr(error.message); else onDone()
  }

  return (
    <li className={`px-5 py-3 border-l-4 ${overdue ? 'bg-row-amber border-st-amber' : 'bg-row-red border-st-red'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{overdue ? `Home visit overdue by ${late} day${late > 1 ? 's' : ''}` : 'Home visit required, due today'}</p>
          <p className="text-xs text-muted break-words">
            {task.patient_id} {name ?? task.patients?.initials}, {task.patients?.purok}. No family caretaker.
          </p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${overdue ? 'border border-line bg-white' : 'bg-brand-teal text-white'}`}>
            Record visit
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="mt-3 space-y-2">
          <label className="block text-xs font-semibold" htmlFor={`o-${task.task_id}`}>Visit outcome (required)</label>
          <textarea id={`o-${task.task_id}`} required maxLength={500} value={outcome} onChange={(e) => setOutcome(e.target.value)}
            className="w-full rounded-lg border border-line bg-white p-2 text-sm" rows={3} />
          {err && <p role="alert" className="text-xs text-st-red">{err}</p>}
          <div className="flex gap-2">
            <button disabled={busy || !outcome.trim()} className="rounded-lg bg-brand-teal text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
              {busy ? 'Saving…' : 'Save visit'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold">Cancel</button>
          </div>
        </form>
      )}
    </li>
  )
}
