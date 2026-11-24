import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { whenLabel } from '../lib/format'
import { Badge, PatientCell, Table, GhostButton } from '../components/ui'

const TONE = { upcoming: 'blue', missed: 'red', reschedule_requested: 'amber', completed: 'green', rescheduled: 'gray' }
const LABEL = { upcoming: 'Upcoming', missed: 'Missed', reschedule_requested: 'Reschedule requested', completed: 'Completed', rescheduled: 'Rescheduled' }
const FILTERS = [['all', 'All'], ['upcoming', 'Upcoming'], ['missed', 'Missed'], ['reschedule_requested', 'Reschedule requested'], ['completed', 'Completed']]

export default function Appointments() {
  const { profile } = useAuth()
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState(null)
  const [names, setNames] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setRows(null)
      let q = supabase.from('appointments')
        .select('appointment_id, patient_id, scheduled_at, status, patients(purok, initials)')
        .order('scheduled_at', { ascending: false }).limit(100)
      if (filter !== 'all') q = q.eq('status', filter)
      const { data, error } = await q
      if (cancelled) return
      if (error) { setError(error.message); return }
      const ids = [...new Set(data.map((r) => r.patient_id))]
      const map = {}
      if (ids.length) {
        const { data: idRows } = await supabase.from('patient_identities').select('patient_id, full_name').in('patient_id', ids)
        ;(idRows ?? []).forEach((r) => { map[r.patient_id] = r.full_name })
      }
      if (cancelled) return
      setError(''); setNames(map); setRows(data)
    })()
    return () => { cancelled = true }
  }, [filter])

  return (
    <div className="max-w-[1100px]">
      <h1 className="text-3xl">Appointments</h1>
      <p className="text-sm text-muted mt-1 mb-4">Newest first. Showing up to 100.</p>

      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by status">
        {FILTERS.map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${filter === key ? 'bg-brand-teal text-white border-brand-teal' : 'bg-white border-line'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-st-red text-sm mb-3">{error}</p>}
      <div className="rounded-xl border border-line bg-white">
        <Table heads={['Patient', 'When', 'Status', '']}>
          {!rows && <tr><td className="px-5 py-4 text-muted" colSpan={4}>Loading…</td></tr>}
          {rows?.length === 0 && <tr><td className="px-5 py-4 text-muted" colSpan={4}>No appointments match.</td></tr>}
          {rows?.map((a) => (
            <tr key={a.appointment_id}>
              <td className="px-5 py-2.5"><PatientCell id={a.patient_id} patient={a.patients} fullName={names[a.patient_id]} /></td>
              <td className="px-5 py-2.5 whitespace-nowrap">{whenLabel(a.scheduled_at)}</td>
              <td className="px-5 py-2.5"><Badge tone={TONE[a.status]}>{LABEL[a.status]}</Badge></td>
              <td className="px-5 py-2.5 text-right whitespace-nowrap">
                {profile.role === 'psychiatrist' && a.status === 'upcoming' &&
                  <Link to={`/consultations/${a.patient_id}`}><GhostButton type="button">Open</GhostButton></Link>}
                {profile.role === 'bhw' && a.status === 'upcoming' &&
                  <Link to={`/cannot-attend/${a.appointment_id}`}><GhostButton type="button">Cannot attend</GhostButton></Link>}
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
