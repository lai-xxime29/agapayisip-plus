import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { daysSince } from '../lib/format'

export default function TaskRow({ task, name, onDone }) {
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
