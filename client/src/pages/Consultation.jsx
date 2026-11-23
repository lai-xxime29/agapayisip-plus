import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { PHASE_LABEL, RISK_LABEL, RISK_TONE } from '../lib/labels'
import { whenLabel, time12 } from '../lib/format'
import { Badge } from '../components/ui'

const PHASES = ['screening', 'actively_monitoring', 'stable_recovery', 'discharged']
const TIMES = Array.from({ length: 17 }, (_, i) => { // 8:00 AM to 4:00 PM, every 30 minutes
  const h = 8 + Math.floor(i / 2), m = i % 2 ? 30 : 0
  return { value: `${String(h).padStart(2, '0')}:${m ? '30' : '00'}`, label: time12(new Date(2000, 0, 1, h, m)) }
})
const DOT = { observation: 'bg-tint-amber text-st-amber', consultation: 'bg-tint-blue text-st-blue', missed: 'bg-tint-red text-st-red', done: 'bg-tint-green text-st-green', task: 'bg-tint-red text-st-red', referral: 'bg-tint-teal text-brand-teal' }

const field = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal'

export default function Consultation() {
  const { patientId } = useParams()
  const [params] = useSearchParams()
  const appointmentId = params.get('appointment')
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [patient, setPatient] = useState(undefined) // undefined = loading, null = not found
  const [identity, setIdentity] = useState(null)
  const [proxy, setProxy] = useState('')
  const [history, setHistory] = useState([])
  const [notes, setNotes] = useState('')
  const [evaluation, setEvaluation] = useState('')
  const [meds, setMeds] = useState('')
  const [phase, setPhase] = useState('screening')
  const [fuDate, setFuDate] = useState('')
  const [fuTime, setFuTime] = useState('09:00')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [pt, idn, obs, cons, appts, refs, tasks] = await Promise.all([
        supabase.from('patients').select('patient_id, initials, purok, case_phase, risk_level, has_caretaker, assigned_bhw').eq('patient_id', patientId).maybeSingle(),
        supabase.from('patient_identities').select('full_name').eq('patient_id', patientId).maybeSingle(),
        supabase.from('observations').select('observation_id, signs_checked, suicidal_ideation, self_harm_history, observed_at').eq('patient_id', patientId).order('observed_at', { ascending: false }).limit(5),
        supabase.from('consultations').select('consultation_id, care_phase, medications_noted, consulted_at').eq('patient_id', patientId).order('consulted_at', { ascending: false }).limit(5),
        supabase.from('appointments').select('appointment_id, status, scheduled_at').eq('patient_id', patientId).in('status', ['missed', 'completed']).order('scheduled_at', { ascending: false }).limit(5),
        supabase.from('referrals').select('referral_id, status, referred_at, arrived_at').eq('patient_id', patientId).order('referred_at', { ascending: false }).limit(5),
        supabase.from('home_visit_tasks').select('task_id, status, created_at').eq('patient_id', patientId).in('status', ['open', 'overdue']).limit(3),
      ])
      if (cancelled) return
      if (!pt.data) { setPatient(null); return }
      setPatient(pt.data); setPhase(pt.data.case_phase); setIdentity(idn.data?.full_name ?? null)
      if (pt.data.assigned_bhw) {
        const { data } = await supabase.from('profiles').select('full_name').eq('user_id', pt.data.assigned_bhw).maybeSingle()
        if (!cancelled) setProxy(data?.full_name ?? '')
      }
      const ev = []
      obs.data?.forEach((o) => ev.push({ at: o.observed_at, kind: 'observation', title: 'Observation', detail: `${o.signs_checked.length} signs. ${o.suicidal_ideation || o.self_harm_history ? 'Risk High.' : 'No risk answers.'}` }))
      cons.data?.forEach((c) => ev.push({ at: c.consulted_at, kind: 'consultation', title: 'Consultation', detail: `${PHASE_LABEL[c.care_phase]}.${c.medications_noted ? ` ${c.medications_noted} noted.` : ''}` }))
      appts.data?.forEach((a) => ev.push({ at: a.scheduled_at, kind: a.status === 'missed' ? 'missed' : 'done', title: a.status === 'missed' ? 'Appointment missed' : 'Appointment completed', detail: a.status === 'missed' ? 'Task created for the proxy BHW.' : '' }))
      refs.data?.forEach((r) => ev.push(r.status === 'arrived'
        ? { at: r.arrived_at, kind: 'done', title: 'Referral arrived', detail: 'Marked by RHU staff.' }
        : { at: r.referred_at, kind: 'referral', title: 'Referral sent', detail: r.status === 'not_arrived' ? 'Not arrived after 7 days.' : 'Awaiting arrival.' }))
      tasks.data?.forEach((t) => ev.push({ at: t.created_at, kind: 'task', title: t.status === 'overdue' ? 'Home visit overdue' : 'Home visit due', detail: 'Open task for the proxy BHW.' }))
      ev.sort((a, b) => new Date(b.at) - new Date(a.at))
      setHistory(ev.slice(0, 8))
    })()
    return () => { cancelled = true }
  }, [patientId])

  const followUpAt = fuDate ? new Date(`${fuDate}T${fuTime}`) : null
  const futureOk = !followUpAt || followUpAt > new Date()
  const canSave = notes.trim() && evaluation.trim() && futureOk && !busy

  async function save() {
    setBusy(true); setError('')
    const plan = followUpAt ? `Next follow-up: ${whenLabel(followUpAt.toISOString())}` : null
    const { error: e1 } = await supabase.from('consultations').insert({
      patient_id: patientId, notes: notes.trim(), evaluation: evaluation.trim(),
      medications_noted: meds.trim() || null, care_phase: phase, follow_up_plan: plan,
    })
    if (e1) { setBusy(false); setError(e1.message); return }
    if (followUpAt) {
      const { error: e2 } = await supabase.from('appointments').insert({ patient_id: patientId, clinician_id: profile.user_id, scheduled_at: followUpAt.toISOString() })
      if (e2) { setBusy(false); setError(`Consultation saved, but the follow-up could not be scheduled: ${e2.message}`); return }
    }
    if (appointmentId) await supabase.from('appointments').update({ status: 'completed' }).eq('appointment_id', appointmentId).eq('status', 'upcoming')
    setBusy(false)
    setSaved({ phase, plan })
  }

  if (patient === undefined) return <p className="text-sm text-muted">Loading…</p>
  if (patient === null) return <p role="alert" className="text-sm text-st-red">Patient {patientId} was not found.</p>

  if (saved) {
    return (
      <div className="max-w-md rounded-xl border border-line bg-white p-6">
        <h1 className="text-2xl">Consultation saved</h1>
        <p className="text-sm text-muted mt-2">
          {patientId} is now in <strong>{PHASE_LABEL[saved.phase]}</strong>. {saved.plan ? `${saved.plan}.` : 'No follow-up was scheduled.'}
        </p>
        <div className="mt-5 flex gap-2">
          <Link to="/dashboard" className="rounded-lg bg-brand-teal text-white px-4 py-2 text-sm font-semibold">Back to dashboard</Link>
          <Link to="/patients" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">Patients</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1100px]">
      <div className="rounded-xl border border-line bg-white p-4 flex flex-wrap items-center gap-4">
        <div className="size-11 rounded-full bg-tint-teal text-brand-teal text-sm font-semibold grid place-items-center">{patient.initials}</div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-2xl font-semibold">{identity ?? patient.initials}</span>
            <span className="text-sm text-muted">{patient.patient_id}, {patient.purok}</span>
            <Badge tone={RISK_TONE[patient.risk_level]}>{RISK_LABEL[patient.risk_level]}</Badge>
            {!patient.has_caretaker && <Badge tone="amber">Solo patient</Badge>}
          </p>
          {proxy && <p className="text-xs text-muted mt-1">Proxy BHW: {proxy}.</p>}
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-tint-red text-st-red text-sm px-4 py-3">{error}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr]">
        <section className="rounded-xl border border-line bg-white h-fit">
          <h2 className="px-5 py-3.5 text-base font-sans font-semibold border-b border-line">History</h2>
          <ul>
            {history.length === 0 && <li className="p-5 text-sm text-muted">Nothing recorded yet.</li>}
            {history.map((h, i) => (
              <li key={i} className="flex gap-3 px-5 py-3 border-b border-line last:border-b-0">
                <span className={`size-8 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${DOT[h.kind]}`} aria-hidden="true">{h.title[0]}</span>
                <div className="text-sm min-w-0">
                  <p className="font-semibold">{h.title}</p>
                  <p className="text-xs text-muted">{h.detail}</p>
                  <p className="text-xs text-muted">{whenLabel(h.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-line bg-white">
          <h2 className="px-5 py-3.5 text-base font-sans font-semibold border-b border-line">New consultation</h2>
          <div className="p-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold">Consultation notes <span className="text-st-red">*</span></span>
              <textarea rows={4} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold">Clinical evaluation <span className="text-st-red">*</span></span>
              <textarea rows={2} value={evaluation} onChange={(e) => setEvaluation(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold">Medications noted</span>
              <input maxLength={1000} value={meds} onChange={(e) => setMeds(e.target.value)} className={field} />
            </label>

            <div>
              <p className="text-xs font-semibold">Care phase</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {PHASES.map((p) => (
                  <button key={p} type="button" onClick={() => setPhase(p)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${phase === p ? 'border-brand-teal bg-tint-teal text-brand-teal' : 'border-line bg-white'}`}>
                    {PHASE_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold">Next follow-up</span>
                <input type="date" value={fuDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setFuDate(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Time</span>
                <select value={fuTime} onChange={(e) => setFuTime(e.target.value)} className={field}>
                  {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </div>
            {!futureOk && <p role="alert" className="text-xs text-st-red">The follow-up must be in the future.</p>}

            <label className="block">
              <span className="text-xs font-semibold">Clinician</span>
              <input readOnly value={`${profile.full_name} (you)`} className={`${field} bg-field text-muted`} />
            </label>

            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={!canSave} className="rounded-lg bg-brand-teal text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {busy ? 'Saving…' : 'Save consultation'}
              </button>
              <button onClick={() => navigate(-1)} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">Discard</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
