import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { whenLabel, dayLabel } from '../lib/format'
import { Card, Lock } from './ui'

const REASON = { no_fare: 'No fare', sick: 'Feeling unwell', work_or_school: 'Work or school', no_companion: 'No companion', other: 'Other' }

// Appointments the patient cannot attend. The psychiatrist sets a new date (FR-14).
export default function RescheduleRequests({ limit = 50, onChange, showLink = false }) {
  const [rows, setRows] = useState(null)
  const [names, setNames] = useState({})
  const [openId, setOpenId] = useState('')
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('appointments')
      .select('appointment_id, patient_id, scheduled_at, reschedule_reason, preferred_date, patients(purok, initials)')
      .eq('status', 'reschedule_requested').order('scheduled_at').limit(limit)
    if (error) { setError(error.message); return }
    const ids = [...new Set(data.map((r) => r.patient_id))]
    const map = {}
    if (ids.length) {
      const { data: idRows } = await supabase.from('patient_identities').select('patient_id, full_name').in('patient_id', ids)
      ;(idRows ?? []).forEach((r) => { map[r.patient_id] = r.full_name })
    }
    setError(''); setNames(map); setRows(data)
  }, [limit])

  useEffect(() => { load() }, [load])

  function start(r) {
    setOpenId(r.appointment_id); setError('')
    // suggest the patient's preferred day at 9:00 AM
    setWhen(r.preferred_date ? `${r.preferred_date}T09:00` : '')
  }

  async function confirm(id) {
    if (!when || new Date(when) <= new Date()) { setError('Choose a date and time in the future.'); return }
    setBusy(true); setError('')
    const { error } = await supabase.rpc('resolve_reschedule', { p_appointment_id: id, p_new_at: new Date(when).toISOString() })
    setBusy(false)
    if (error) { setError(error.message); return }
    setOpenId(''); await load(); onChange?.()
  }

  return (
    <Card title="Reschedule requests" action={showLink && <Link to="/reschedules" className="text-sm font-semibold text-brand-teal">View all ›</Link>}>
      {error && <p role="alert" className="px-5 pb-3 text-sm text-st-red">{error}</p>}
      {rows === null ? <p className="px-5 pb-4 text-sm text-muted">Loading…</p> : (
        <ul className="divide-y divide-line">
          {rows.length === 0 && <li className="px-5 pb-4 text-sm text-muted">No requests waiting.</li>}
          {rows.map((r) => (
            <li key={r.appointment_id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {names[r.patient_id] ?? <><Lock />{r.patients?.initials}</>}
                    <span className="font-normal text-muted"> {r.patient_id}</span>
                  </p>
                  <p className="text-xs text-muted">Appointment {whenLabel(r.scheduled_at)}.</p>
                  <p className="text-xs">Reason: {REASON[r.reschedule_reason] ?? '—'}{r.preferred_date ? `. Prefers ${dayLabel(r.preferred_date + 'T00:00')}.` : ''}</p>
                </div>
                {openId !== r.appointment_id && (
                  <button onClick={() => start(r)} className="shrink-0 rounded-lg bg-brand-teal text-white px-3 py-1.5 text-sm font-semibold">Set new date</button>
                )}
              </div>
              {openId === r.appointment_id && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-semibold" htmlFor={`d-${r.appointment_id}`}>New date and time</label>
                  <input id={`d-${r.appointment_id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => confirm(r.appointment_id)} disabled={busy} className="rounded-lg bg-brand-teal text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
                      {busy ? 'Saving…' : 'Confirm new date'}
                    </button>
                    <button onClick={() => setOpenId('')} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold">Cancel</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
