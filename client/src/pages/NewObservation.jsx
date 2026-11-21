import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePatientOptions } from '../lib/usePatientOptions'
import { PHASE_LABEL, RISK_LABEL, RISK_TONE } from '../lib/labels'
import { longDate } from '../lib/format'
import { Badge } from '../components/ui'

// Plain-language signs from the Figma design (stored as short keys)
const SIGNS = [
  ['isolates', 'Stays away from family and friends'],
  ['talks_to_self', 'Talks to self'],
  ['angry', 'Gets angry for no reason'],
  ['paranoia', 'Says people want to harm them'],
  ['violence', 'Hurts or threatens others'],
  ['self_care', 'Has trouble bathing, dressing, or eating'],
  ['sleep_eating', 'Sleeps or eats much less or much more'],
  ['stopped_meds', 'Stopped taking medicines (if already diagnosed)'],
  ['family_history', 'Someone in the family has a mental illness'],
]

function YesNo({ value, onChange, label }) {
  return (
    <div className="mt-3 inline-flex rounded-lg border border-line overflow-hidden text-sm font-semibold" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(true)} className={`px-5 py-2 ${value === true ? 'bg-st-red text-white' : 'bg-white'}`}>Yes</button>
      <button type="button" onClick={() => onChange(false)} className={`px-5 py-2 ${value === false ? 'bg-brand-teal text-white' : 'bg-white'}`}>No</button>
    </div>
  )
}

export default function NewObservation() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const options = usePatientOptions()
  const [patientId, setPatientId] = useState(params.get('patient') ?? '')
  const [signs, setSigns] = useState(new Set())
  const [ideation, setIdeation] = useState(null)
  const [selfHarm, setSelfHarm] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const patient = options?.find((p) => p.patient_id === patientId)
  const flagged = ideation === true || selfHarm === true
  const levelAfter = flagged ? 'high' : patient?.risk_level
  const canSave = !!patient && ideation !== null && selfHarm !== null && !busy

  const toggle = (key) => setSigns((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })

  async function save(thenReferral = false) {
    setBusy(true); setError('')
    const { error } = await supabase.from('observations').insert({
      patient_id: patient.patient_id, signs_checked: [...signs], suicidal_ideation: ideation, self_harm_history: selfHarm,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    if (thenReferral) navigate(`/new-referral?patient=${patient.patient_id}&urgent=1`)
    else setSaved(true)
  }

  function again() {
    setPatientId(''); setSigns(new Set()); setIdeation(null); setSelfHarm(null); setDismissed(false); setSaved(false); setError('')
  }

  if (saved) {
    return (
      <div className="max-w-md rounded-xl border border-line bg-white p-6">
        <h1 className="text-2xl">Observation saved</h1>
        <p className="text-sm text-muted mt-2">
          {flagged
            ? `${patient.patient_id} is now flagged High Risk. If you have not already, send an urgent referral to the RHU.`
            : `The observation for ${patient.patient_id} was recorded.`}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {flagged && <Link to={`/new-referral?patient=${patient.patient_id}&urgent=1`} className="rounded-lg bg-st-red text-white px-4 py-2 text-sm font-semibold">Send urgent referral</Link>}
          <button onClick={again} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">Record another</button>
          <Link to="/dashboard" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">Back to dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1100px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">New observation</h1>
          <p className="text-sm text-muted mt-1">Tick only what you saw or were told today. Plain words are fine. No medical terms needed.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={() => save(false)} disabled={!canSave} className="rounded-lg bg-brand-teal text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? 'Saving…' : 'Save observation'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-tint-red text-st-red text-sm px-4 py-3">{error}</p>}

      <div className="mt-5 rounded-xl border border-line bg-white p-4 flex flex-wrap items-center gap-4">
        {patient ? (
          <>
            <div className="size-11 rounded-full bg-tint-teal text-brand-teal text-sm font-semibold grid place-items-center">{patient.initials}</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{patient.full_name}</p>
              <p className="text-xs text-muted">{patient.patient_id}, {patient.purok}. Your purok, so the full name is shown.</p>
            </div>
            <Badge tone={RISK_TONE[patient.risk_level]}>{RISK_LABEL[patient.risk_level]}</Badge>
            <span className="text-sm text-muted">{PHASE_LABEL[patient.case_phase]}</span>
            <div className="border-l border-line pl-4">
              <p className="text-xs text-muted">Observation date</p>
              <p className="text-sm font-semibold">{longDate().split(', ')[1]}</p>
            </div>
          </>
        ) : (
          <label className="block flex-1 min-w-[260px]">
            <span className="text-xs font-semibold">Patient <span className="text-st-red">*</span></span>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={!options}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm">
              <option value="">{options ? 'Choose a patient' : 'Loading…'}</option>
              {options?.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.full_name}, {p.patient_id}</option>)}
            </select>
            {patientId && options && <span role="alert" className="block mt-1 text-xs text-st-red">You can only record observations for patients in your purok or assigned to you.</span>}
          </label>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="rounded-xl border border-line bg-white">
          <h2 className="px-5 py-3.5 text-base font-sans font-semibold border-b border-line">Behavior signs</h2>
          <div className="p-5">
            <p className="text-sm text-muted">What have you noticed in the last two weeks?</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {SIGNS.map(([key, label]) => {
                const on = signs.has(key)
                return (
                  <label key={key} className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-sm cursor-pointer ${on ? 'border-brand-teal bg-tint-teal' : 'border-line bg-white'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(key)} className="size-4 accent-brand-teal" />
                    {label}
                  </label>
                )
              })}
            </div>
            <p className="mt-6 text-xs font-semibold text-brand-teal">{signs.size} sign{signs.size === 1 ? '' : 's'} ticked</p>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-line bg-white">
            <h2 className="px-5 py-3.5 text-base font-sans font-semibold border-b border-line">Immediate-risk questions</h2>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-sm font-semibold">Has the person talked about wanting to end their life?</p>
                <YesNo value={ideation} onChange={setIdeation} label="Talked about wanting to end their life" />
              </div>
              <div>
                <p className="text-sm font-semibold">Has the person ever hurt themselves on purpose?</p>
                <YesNo value={selfHarm} onChange={setSelfHarm} label="Hurt themselves on purpose" />
              </div>
            </div>
          </section>

          {flagged && !dismissed && (
            <section role="alert" className="rounded-xl border border-st-red/30 bg-tint-red p-5">
              <h2 className="text-base font-sans font-semibold text-st-red">This patient will be flagged High Risk</h2>
              <p className="text-sm mt-2">
                A risk answer is Yes. Send an urgent referral to the RHU now so the psychiatrist sees it at the top of the queue.
                If the person is in danger right now, stay with them and call the RHU.
              </p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => save(true)} disabled={!canSave} className="rounded-lg bg-brand-teal text-white px-3 py-2 text-sm font-semibold disabled:opacity-50">Send urgent referral</button>
                <button onClick={() => setDismissed(true)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold">Not now</button>
              </div>
            </section>
          )}

          <div className="rounded-xl border border-line bg-white px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-muted">Risk level after saving</span>
            {levelAfter ? <Badge tone={RISK_TONE[levelAfter]}>{RISK_LABEL[levelAfter]}</Badge> : <span className="text-muted">—</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
