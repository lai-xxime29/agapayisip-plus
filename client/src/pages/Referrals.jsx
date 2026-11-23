import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { usePatientOptions } from '../lib/usePatientOptions'
import { REF_TONE, referralStatusText } from '../lib/labels'
import { referredLabel } from '../lib/format'
import { Badge, PatientCell, Table, GhostButton } from '../components/ui'
import ReferralQueue from '../components/ReferralQueue'

export default function Referrals() {
  const { profile } = useAuth()
  if (profile.role !== 'bhw') {
    return (
      <div className="max-w-[1100px]">
        <h1 className="text-3xl">Referral queue</h1>
        <p className="text-sm text-muted mt-1 mb-5">Urgent referrals come first. Mark a patient Arrived when they reach the RHU.</p>
        <ReferralQueue />
      </div>
    )
  }
  return <BhwReferrals />
}

function BhwReferrals() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const options = usePatientOptions()
  const [patientId, setPatientId] = useState(params.get('patient') ?? '')
  const [reason, setReason] = useState('')
  const [urgency, setUrgency] = useState(params.get('urgent') ? 'urgent' : 'routine')
  const [open, setOpen] = useState(null) // an open referral for the chosen patient, if any
  const [list, setList] = useState(null)
  const [names, setNames] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('referrals')
      .select('referral_id, patient_id, urgency, status, referred_at, arrived_at, patients(purok, initials)')
      .order('referred_at', { ascending: false }).limit(20)
    if (error) { setError(error.message); return }
    const ids = [...new Set(data.map((r) => r.patient_id))]
    const map = {}
    if (ids.length) {
      const { data: rows } = await supabase.from('patient_identities').select('patient_id, full_name').in('patient_id', ids)
      ;(rows ?? []).forEach((r) => { map[r.patient_id] = r.full_name })
    }
    setNames(map); setList(data)
  }, [])

  useEffect(() => { load() }, [load])

  // Warn when the patient already has a referral that is still open
  useEffect(() => {
    if (!patientId) { setOpen(null); return }
    let cancelled = false
    supabase.from('referrals').select('referral_id, referred_at, status').eq('patient_id', patientId)
      .in('status', ['referred', 'not_arrived']).order('referred_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (!cancelled) setOpen(data?.[0] ?? null) })
    return () => { cancelled = true }
  }, [patientId, sent])

  const patient = options?.find((p) => p.patient_id === patientId)
  const canSend = !!patientId && reason.trim().length > 0 && !busy

  async function send(e) {
    e.preventDefault()
    setBusy(true); setError(''); setSent('')
    const { error } = await supabase.from('referrals').insert({ patient_id: patientId, reason: reason.trim(), urgency })
    setBusy(false)
    if (error) { setError(error.message); return }
    setSent(patientId); setReason(''); setUrgency('routine'); setPatientId('')
    load()
  }

  const next = [
    ['You send the referral', 'Status is Referred.'],
    ['The psychiatrist is notified', 'Urgent ones appear first in the queue.'],
    ['The patient is marked Arrived', 'You are notified. After 7 days without arrival it shows Not arrived.'],
  ]

  return (
    <div className="max-w-[1100px]">
      <h1 className="text-3xl">Refer to the RHU</h1>
      <p className="text-sm text-muted mt-1">Send a registered patient to the Rural Health Unit. The psychiatrist is notified right away.</p>

      {sent && <p role="status" className="mt-4 rounded-lg bg-tint-green text-st-green text-sm px-4 py-3">Referral sent for {sent}. The psychiatrist can see it now.</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-tint-red text-st-red text-sm px-4 py-3">{error}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[400px_1fr]">
        <form onSubmit={send} className="rounded-xl border border-line bg-white h-fit">
          <h2 className="px-5 py-3.5 text-base font-sans font-semibold border-b border-line">Referral form</h2>
          <div className="p-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold">Patient <span className="text-st-red">*</span></span>
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={!options}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm">
                <option value="">{options ? 'Choose a patient' : 'Loading…'}</option>
                {options?.map((p) => <option key={p.patient_id} value={p.patient_id}>{p.full_name}, {p.patient_id}</option>)}
                {patientId && options && !patient && <option value={patientId}>{patientId}</option>}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold">Reason for referral <span className="text-st-red">*</span></span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal" />
            </label>

            <div>
              <p className="text-xs font-semibold">Urgency</p>
              <div className="mt-1 inline-flex rounded-lg border border-line overflow-hidden text-sm font-semibold">
                <button type="button" onClick={() => setUrgency('routine')} className={`px-5 py-2 ${urgency === 'routine' ? 'bg-brand-teal text-white' : 'bg-white'}`}>Routine</button>
                <button type="button" onClick={() => setUrgency('urgent')} className={`px-5 py-2 ${urgency === 'urgent' ? 'bg-st-red text-white' : 'bg-white'}`}>Urgent</button>
              </div>
              <p className="text-xs text-muted mt-2">Urgent referrals go to the top of the psychiatrist's queue.</p>
            </div>

            {open && (
              <div className="rounded-lg bg-tint-amber text-st-amber text-sm p-3">
                <p className="font-semibold">Open referral already exists</p>
                <p>{patientId} was referred {referredLabel(open.referred_at).toLowerCase()} and has not arrived yet. Continue only if this is a new concern.</p>
              </div>
            )}

            <div className="flex gap-2">
              <button disabled={!canSend} className="rounded-lg bg-brand-teal text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {busy ? 'Sending…' : 'Confirm and send'}
              </button>
              <button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </form>

        <div className="space-y-5 min-w-0">
          <section className="rounded-xl border border-line bg-white">
            <header className="flex items-center justify-between px-5 py-4">
              <h2 className="text-base font-sans font-semibold">My referrals</h2>
              <Link to="/referrals" className="text-sm font-semibold text-brand-teal">View all ›</Link>
            </header>
            {list === null ? <p className="px-5 pb-4 text-sm text-muted">Loading…</p> : (
              <Table heads={['Patient', 'Urgency', 'Referred', 'Status', '']}>
                {list.length === 0 && <tr><td colSpan={5} className="px-5 py-4 text-muted">No referrals yet.</td></tr>}
                {list.slice(0, 6).map((r) => (
                  <tr key={r.referral_id}>
                    <td className="px-5 py-2.5"><PatientCell id={r.patient_id} patient={r.patients} fullName={names[r.patient_id]} /></td>
                    <td className="px-5 py-2.5"><Badge tone={r.urgency === 'urgent' ? 'solidRed' : 'gray'}>{r.urgency === 'urgent' ? 'Urgent' : 'Routine'}</Badge></td>
                    <td className="px-5 py-2.5 whitespace-nowrap">{referredLabel(r.referred_at)}</td>
                    <td className="px-5 py-2.5"><Badge tone={REF_TONE[r.status]}>{referralStatusText(r)}</Badge></td>
                    <td className="px-5 py-2.5 text-right">{r.status === 'not_arrived' && <GhostButton disabled title="Coming soon">Follow up</GhostButton>}</td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section className="rounded-xl bg-tint-teal p-5 text-sm">
            <p className="font-semibold">Why Not arrived?</p>
            <p className="mt-1">A referral not confirmed within 7 days is shown as Not arrived so you can follow up with the patient or family.</p>
          </section>

          <section className="rounded-xl border border-line bg-white">
            <h2 className="px-5 py-3.5 text-base font-sans font-semibold border-b border-line">What happens next</h2>
            <ol className="p-5 space-y-3">
              {next.map(([t, s], i) => (
                <li key={t} className="flex gap-3">
                  <span className="size-7 shrink-0 rounded-full bg-tint-teal text-brand-teal text-xs font-semibold grid place-items-center">{i + 1}</span>
                  <div><p className="text-sm font-semibold">{t}</p><p className="text-xs text-muted">{s}</p></div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
