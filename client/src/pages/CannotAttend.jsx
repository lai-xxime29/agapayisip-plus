import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { longDate, time12, dayLabel } from '../lib/format'
import { Badge } from '../components/ui'

const CLINIC = import.meta.env.VITE_CLINIC_NAME || 'RHU Dalaguete'
const REASONS = [
  ['no_fare', 'I have no money for the fare'],
  ['sick', 'I feel unwell'],
  ['work_or_school', 'I have work or family duties'],
  ['other', 'Another reason'],
]

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// the next three weekdays after today
function nextDays(n) {
  const out = []; const d = new Date()
  while (out.length < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) out.push(ymd(d)) }
  return out
}

export default function CannotAttend() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const [appt, setAppt] = useState(undefined)
  const [doctor, setDoctor] = useState('')
  const [reason, setReason] = useState('')
  const [day, setDay] = useState(null) // a yyyy-mm-dd string, or 'other'
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const chips = nextDays(3)
  const tomorrow = nextDays(1)[0]

  useEffect(() => {
    supabase.from('appointments').select('appointment_id, scheduled_at, status, clinician_id').eq('appointment_id', appointmentId).maybeSingle()
      .then(async ({ data }) => {
        setAppt(data ?? null)
        if (data) {
          const { data: p } = await supabase.from('profiles').select('full_name').eq('user_id', data.clinician_id).maybeSingle()
          setDoctor(p?.full_name ?? 'Your doctor')
        }
      })
  }, [appointmentId])

  const preferred = day === 'other' ? custom : day
  const canSend = reason && preferred && preferred >= tomorrow && !busy

  async function send() {
    setBusy(true); setError('')
    const { error } = await supabase.rpc('request_reschedule', { p_appointment_id: appointmentId, p_reason: reason, p_preferred_date: preferred })
    setBusy(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  if (appt === undefined) return <p className="text-sm text-muted">Loading…</p>
  if (appt === null) return <p role="alert" className="text-sm text-st-red">That appointment was not found.</p>

  if (sent) {
    return (
      <div className="max-w-md rounded-xl border border-line bg-white p-6">
        <h1 className="text-2xl">Request sent</h1>
        <p className="text-sm text-muted mt-2">{doctor} will choose a new date and you will get a message. Until then your appointment shows as "Reschedule requested".</p>
        <Link to="/dashboard" className="mt-5 inline-block rounded-lg bg-brand-teal text-white px-4 py-2 text-sm font-semibold">Back to home</Link>
      </div>
    )
  }

  const when = new Date(appt.scheduled_at)
  return (
    <div className="max-w-[1100px]">
      <Link to="/dashboard" className="text-sm font-semibold text-brand-teal">← Back to home</Link>
      <h1 className="text-3xl mt-4">I cannot attend</h1>
      <p className="text-sm text-muted mt-1">Tell the clinic why you cannot come. {doctor} will choose a new date.</p>

      {error && <p role="alert" className="mt-4 rounded-lg bg-tint-red text-st-red text-sm px-4 py-3">{error}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4 min-w-0">
          <div className="rounded-xl border border-line bg-white p-4 flex items-center gap-3">
            <div className="size-11 rounded-lg bg-tint-blue text-st-blue grid place-items-center text-sm font-semibold">{when.getDate()}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{longDate(when)}, {time12(when)}</p>
              <p className="text-xs text-muted">{doctor}, {CLINIC}</p>
            </div>
            <Badge tone="blue">Upcoming</Badge>
          </div>

          <fieldset className="rounded-xl border border-line bg-white">
            <legend className="sr-only">Why can't you come?</legend>
            <h2 className="px-5 py-4 text-base font-sans font-semibold border-b border-line">Why can't you come?</h2>
            <div className="p-5 grid gap-3 sm:grid-cols-2">
              {REASONS.map(([value, label]) => (
                <label key={value} className={`flex items-center gap-3 rounded-lg border px-4 py-3.5 text-sm cursor-pointer ${reason === value ? 'border-brand-teal bg-tint-teal' : 'border-line bg-white'}`}>
                  <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="size-4 accent-brand-teal" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <section className="rounded-xl border border-line bg-white">
            <h2 className="px-5 py-4 text-base font-sans font-semibold border-b border-line">Which day is better for you?</h2>
            <div className="p-5">
              <div className="flex flex-wrap gap-3">
                {chips.map((c) => (
                  <button key={c} type="button" onClick={() => setDay(c)} className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${day === c ? 'border-brand-teal bg-tint-teal text-brand-teal' : 'border-line bg-white'}`}>
                    {dayLabel(`${c}T00:00`)}
                  </button>
                ))}
                <button type="button" onClick={() => setDay('other')} className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${day === 'other' ? 'border-brand-teal bg-tint-teal text-brand-teal' : 'border-line bg-white'}`}>Another day</button>
              </div>
              {day === 'other' && (
                <label className="block mt-3 text-xs font-semibold">Choose a day
                  <input type="date" min={tomorrow} value={custom} onChange={(e) => setCustom(e.target.value)} className="mt-1 block rounded-lg border border-line px-3 py-2 text-sm" />
                </label>
              )}
              <p className="text-xs text-muted mt-3">Pick a day after today. The doctor makes the final choice and you will get a message.</p>
            </div>
          </section>

          <div className="flex gap-3">
            <button onClick={send} disabled={!canSend} className="rounded-lg bg-brand-teal text-white px-6 py-3 text-sm font-semibold disabled:opacity-50">{busy ? 'Sending…' : 'Send request'}</button>
            <button onClick={() => navigate(-1)} className="rounded-lg border border-line bg-white px-6 py-3 text-sm font-semibold">Go back</button>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-line bg-white">
            <h2 className="px-5 py-4 text-base font-sans font-semibold border-b border-line">What happens next</h2>
            <ol className="p-5 space-y-3 text-sm">
              <li><p className="font-semibold">Your request goes to the doctor</p><p className="text-xs text-muted">It appears on the doctor's list within seconds.</p></li>
              <li><p className="font-semibold">You get a message with the new date</p><p className="text-xs text-muted">It shows the clinic, date, and time only.</p></li>
              <li><p className="font-semibold">Your BHW is told too</p><p className="text-xs text-muted">They will know your new date.</p></li>
            </ol>
          </section>
          <section className="rounded-xl bg-tint-teal p-5 text-sm">
            <p className="font-semibold">Until then</p>
            <p className="mt-1">Your appointment stays on your list as "Reschedule requested".</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
