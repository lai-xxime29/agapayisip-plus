import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { usePatientOptions } from '../lib/usePatientOptions'
import { whenLabel } from '../lib/format'
import { Card } from '../components/ui'

export default function TeamNotes() {
  const { profile } = useAuth()
  const options = usePatientOptions()
  const [notes, setNotes] = useState(null)
  const [patientId, setPatientId] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('patient_notes')
      .select('note_id, patient_id, body, created_at, author_id, author:profiles(full_name, role)')
      .order('created_at', { ascending: false }).limit(60)
    if (error) { setError(error.message); return }
    setError(''); setNotes(data)
  }, [])
  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.from('patient_notes').insert({ patient_id: patientId, body: body.trim(), author_id: profile.user_id })
    setBusy(false)
    if (error) { setError(error.message); return }
    setBody(''); load()
  }

  return (
    <div className="max-w-[900px] space-y-5">
      <div>
        <h1 className="text-3xl">Team notes</h1>
        <p className="text-sm text-muted mt-1">Short notes shared between BHWs and the psychiatrist about a patient. Keep them factual.</p>
      </div>

      <Card title="Add a note">
        <form onSubmit={add} className="px-5 pb-5 space-y-3">
          <label htmlFor="note-patient" className="block text-sm font-semibold">Patient</label>
          <select id="note-patient" required value={patientId} onChange={(e) => setPatientId(e.target.value)}
            className="w-full rounded-lg border border-line bg-white p-2 text-sm">
            <option value="">Choose a patient…</option>
            {(options ?? []).map((p) => <option key={p.patient_id} value={p.patient_id}>{p.patient_id}: {p.full_name}, {p.purok}</option>)}
          </select>
          <label htmlFor="note-body" className="block text-sm font-semibold">Note</label>
          <textarea id="note-body" required maxLength={2000} rows={3} value={body} onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-lg border border-line bg-white p-2 text-sm" />
          {error && <p role="alert" className="text-sm text-st-red">{error}</p>}
          <button disabled={busy || !patientId || !body.trim()} className="rounded-lg bg-brand-teal text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? 'Saving…' : 'Add note'}
          </button>
        </form>
      </Card>

      <Card title="Recent notes">
        <ul className="divide-y divide-line">
          {!notes && <li className="px-5 pb-4 text-sm text-muted">Loading…</li>}
          {notes?.length === 0 && <li className="px-5 pb-4 text-sm text-muted">No notes yet.</li>}
          {notes?.map((n) => (
            <li key={n.note_id} className="px-5 py-3 text-sm">
              <p className="text-xs text-muted">
                {n.author_id === profile.user_id ? 'You' : n.author?.full_name} on {n.patient_id}, {whenLabel(n.created_at)}
              </p>
              <p className="mt-1 break-words">{n.body}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
