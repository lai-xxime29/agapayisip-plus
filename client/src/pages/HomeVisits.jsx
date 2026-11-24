import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { whenLabel } from '../lib/format'
import { Badge, Card, PatientCell, Table } from '../components/ui'
import TaskRow from '../components/TaskRow'

export default function HomeVisits() {
  const [tasks, setTasks] = useState(null)
  const [names, setNames] = useState({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('home_visit_tasks')
      .select('task_id, appointment_id, patient_id, status, outcome, created_at, completed_at, patients(purok, initials)')
      .order('created_at', { ascending: false }).limit(100)
    if (error) { setError(error.message); return }
    const ids = [...new Set(data.map((t) => t.patient_id))]
    const map = {}
    if (ids.length) {
      const { data: rows } = await supabase.from('patient_identities').select('patient_id, full_name').in('patient_id', ids)
      ;(rows ?? []).forEach((r) => { map[r.patient_id] = r.full_name })
    }
    setError(''); setNames(map); setTasks(data)
  }, [])

  useEffect(() => { load() }, [load])

  if (error) return <p role="alert" className="text-st-red text-sm">Could not load home visits: {error}</p>
  if (!tasks) return <p className="text-sm text-muted">Loading…</p>

  const open = tasks.filter((t) => t.status !== 'completed').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const done = tasks.filter((t) => t.status === 'completed')

  return (
    <div className="max-w-[1100px] space-y-5">
      <div>
        <h1 className="text-3xl">Home visit tasks</h1>
        <p className="text-sm text-muted mt-1">
          Created automatically when a patient with no family caretaker misses an appointment. Record what you found at the visit.
        </p>
      </div>

      <Card title={`To do (${open.length})`}>
        {open.length === 0 && <p className="px-5 pb-4 text-sm text-muted">No home visits waiting. Nice work.</p>}
        <ul>
          {open.map((t) => <TaskRow key={t.task_id} task={t} name={names[t.patient_id]} onDone={load} />)}
        </ul>
      </Card>

      <Card title={`Completed (${done.length})`}>
        <Table heads={['Patient', 'Visited', 'Outcome']}>
          {done.length === 0 && <tr><td className="px-5 py-4 text-muted" colSpan={3}>Nothing completed yet.</td></tr>}
          {done.map((t) => (
            <tr key={t.task_id}>
              <td className="px-5 py-2.5"><PatientCell id={t.patient_id} patient={t.patients} fullName={names[t.patient_id]} /></td>
              <td className="px-5 py-2.5 whitespace-nowrap"><Badge tone="green">Done</Badge> <span className="text-muted">{t.completed_at ? whenLabel(t.completed_at) : ''}</span></td>
              <td className="px-5 py-2.5 break-words">{t.outcome}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
