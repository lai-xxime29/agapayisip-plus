import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PHASE_LABEL } from '../lib/labels'
import { Badge, Card, Table, GhostButton, Lock } from '../components/ui'

// The administrator sees initials only (no full names), and archives instead of deleting (BRL-10).
export default function Archive() {
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('patients')
      .select('patient_id, initials, purok, case_phase, is_archived').order('patient_id').limit(500)
    if (error) { setError(error.message); return }
    setError(''); setRows(data)
  }, [])
  useEffect(() => { load() }, [load])

  async function archive(p) {
    if (!window.confirm(`Archive ${p.patient_id}? The record is kept but hidden from staff.`)) return
    setBusyId(p.patient_id); setError(''); setNotice('')
    const { error } = await supabase.rpc('archive_patient', { p_patient_id: p.patient_id })
    setBusyId('')
    if (error) setError(error.message)
    else { setNotice(`${p.patient_id} archived.`); load() }
  }

  const match = (p) => !q.trim() || `${p.patient_id} ${p.initials} ${p.purok}`.toLowerCase().includes(q.trim().toLowerCase())
  const active = (rows ?? []).filter((p) => !p.is_archived && match(p))
  const archived = (rows ?? []).filter((p) => p.is_archived && match(p))

  return (
    <div className="max-w-[1100px] space-y-5">
      <div>
        <h1 className="text-3xl">Patient archive</h1>
        <p className="text-sm text-muted mt-1">Records are never deleted. A patient with an open appointment cannot be archived yet.</p>
      </div>
      <input aria-label="Search patients" placeholder="Search by ID, initials or purok" value={q} onChange={(e) => setQ(e.target.value)}
        className="rounded-lg border border-line bg-white px-3 py-2 text-sm w-72" />
      {error && <p role="alert" className="text-st-red text-sm">{error}</p>}
      {notice && <p role="status" className="text-st-green text-sm">{notice}</p>}

      <Card title={`Active (${active.length})`}>
        <Table heads={['Patient', 'Purok', 'Phase', '']}>
          {!rows && <tr><td className="px-5 py-4 text-muted" colSpan={4}>Loading…</td></tr>}
          {active.slice(0, 100).map((p) => (
            <tr key={p.patient_id}>
              <td className="px-5 py-2.5"><span className="font-semibold">{p.patient_id}</span> <span className="text-xs text-muted"><Lock />{p.initials}</span></td>
              <td className="px-5 py-2.5">{p.purok}</td>
              <td className="px-5 py-2.5"><Badge tone="gray">{PHASE_LABEL[p.case_phase]}</Badge></td>
              <td className="px-5 py-2.5 text-right"><GhostButton type="button" disabled={busyId === p.patient_id} onClick={() => archive(p)}>Archive</GhostButton></td>
            </tr>
          ))}
        </Table>
        {active.length > 100 && <p className="px-5 py-3 text-xs text-muted">Showing the first 100. Use search to narrow down.</p>}
      </Card>

      <Card title={`Archived (${archived.length})`}>
        <Table heads={['Patient', 'Purok', 'Phase']}>
          {archived.length === 0 && <tr><td className="px-5 py-4 text-muted" colSpan={3}>No archived patients.</td></tr>}
          {archived.map((p) => (
            <tr key={p.patient_id}>
              <td className="px-5 py-2.5"><span className="font-semibold">{p.patient_id}</span> <span className="text-xs text-muted"><Lock />{p.initials}</span></td>
              <td className="px-5 py-2.5">{p.purok}</td>
              <td className="px-5 py-2.5"><Badge tone="gray">{PHASE_LABEL[p.case_phase]}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
