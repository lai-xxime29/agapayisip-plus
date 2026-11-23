import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Badge, PatientCell, Table } from '../components/ui'

const PHASE = { screening: 'Screening', actively_monitoring: 'Actively monitoring', stable_recovery: 'Stable recovery', discharged: 'Discharged' }
const RISK_TONE = { high: 'red', moderate: 'amber', low: 'green' }

export default function Patients() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const [text, setText] = useState(q)
  const [rows, setRows] = useState(null)
  const [names, setNames] = useState({})
  const [error, setError] = useState('')

  useEffect(() => { setText(q) }, [q])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setRows(null)
      const safe = q.replace(/[%,()*]/g, '')
      let query = supabase.from('patients')
        .select('patient_id, initials, purok, case_phase, risk_level, has_caretaker')
        .eq('is_archived', false).order('patient_id').limit(50)

      if (safe) {
        // match on ID, purok, or a full name this user is allowed to see
        const { data: byName } = await supabase.from('patient_identities').select('patient_id').ilike('full_name', `%${safe}%`).limit(50)
        const ids = (byName ?? []).map((r) => r.patient_id)
        const parts = [`patient_id.ilike.%${safe}%`, `purok.ilike.%${safe}%`]
        if (ids.length) parts.push(`patient_id.in.(${ids.join(',')})`)
        query = query.or(parts.join(','))
      }

      const { data, error } = await query
      if (cancelled) return
      if (error) { setError(error.message); return }
      setError('')
      const map = {}
      if (data.length) {
        const { data: idRows } = await supabase.from('patient_identities').select('patient_id, full_name').in('patient_id', data.map((r) => r.patient_id))
        ;(idRows ?? []).forEach((r) => { map[r.patient_id] = r.full_name })
      }
      if (cancelled) return
      setNames(map); setRows(data)
    })()
    return () => { cancelled = true }
  }, [q])

  function submit(e) {
    e.preventDefault()
    setParams(text.trim() ? { q: text.trim() } : {})
  }

  return (
    <div className="max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Patients</h1>
          <p className="text-sm text-muted mt-1">Names show only for patients in your purok or assigned to you. Others show initials.</p>
        </div>
        {profile.role === 'bhw' && (
          <Link to="/register-patient" className="rounded-lg bg-brand-teal text-white px-3 py-2 text-sm font-semibold">Register patient</Link>
        )}
      </div>

      <form onSubmit={submit} className="mt-5 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Search patients"
          placeholder="Search by patient ID, name or purok"
          className="flex-1 max-w-md rounded-lg border border-line bg-white px-3 py-2.5 text-sm" />
        <button className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">Search</button>
        {q && <button type="button" onClick={() => setParams({})} className="rounded-lg px-3 py-2 text-sm text-muted">Clear</button>}
      </form>

      {error && <p role="alert" className="mt-4 text-sm text-st-red">Could not load patients: {error}</p>}

      <div className="mt-4 rounded-xl border border-line bg-white">
        {rows === null && !error && <p className="p-5 text-sm text-muted">Loading…</p>}
        {rows && (
          <>
            <Table heads={profile.role === 'psychiatrist' ? ['Patient', 'Care phase', 'Risk', 'Caretaker', ''] : ['Patient', 'Care phase', 'Risk', 'Caretaker']}>
              {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-4 text-muted">{q ? `No patients match "${q}".` : 'No patients yet.'}</td></tr>}
              {rows.map((p) => (
                <tr key={p.patient_id}>
                  <td className="px-5 py-2.5"><PatientCell id={p.patient_id} patient={p} fullName={names[p.patient_id]} /></td>
                  <td className="px-5 py-2.5">{PHASE[p.case_phase]}</td>
                  <td className="px-5 py-2.5"><Badge tone={RISK_TONE[p.risk_level]}>{p.risk_level[0].toUpperCase() + p.risk_level.slice(1)}</Badge></td>
                  <td className="px-5 py-2.5 text-muted">{p.has_caretaker ? 'Yes' : 'No (solo)'}</td>
                  {profile.role === 'psychiatrist' && (
                    <td className="px-5 py-2.5 text-right">
                      <Link to={`/consultations/${p.patient_id}`} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold">Open</Link>
                    </td>
                  )}
                </tr>
              ))}
            </Table>
            <p className="px-5 py-3 text-xs text-muted border-t border-line">
              Showing {rows.length} patient{rows.length === 1 ? '' : 's'}{rows.length === 50 ? ' (first 50, narrow your search to see others)' : ''}.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
