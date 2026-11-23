import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePatientData } from '../lib/usePatientData'
import { longDate, greeting, time12 } from '../lib/format'
import { Badge } from '../components/ui'

const CLINIC = import.meta.env.VITE_CLINIC_NAME || 'RHU Dalaguete'
const STATUS = { completed: ['green', 'Completed'], missed: ['red', 'Missed'], upcoming: ['blue', 'Upcoming'], reschedule_requested: ['amber', 'Reschedule requested'], rescheduled: ['gray', 'Rescheduled'] }

export function PatientNotice({ state }) {
  if (state.loading) return <p className="text-sm text-muted">Loading…</p>
  if (state.error) return <p role="alert" className="text-sm text-st-red">Could not load your record: {state.error}</p>
  if (state.unlinked) return <p className="text-sm text-muted">Your account is not linked to a patient record yet. Please ask your barangay health worker.</p>
  return null
}

export default function PatientHome() {
  const { profile } = useAuth()
  const state = usePatientData()
  const notice = <PatientNotice state={state} />
  if (state.loading || state.error || state.unlinked) return notice

  const { next, appts, names, bhw } = state
  const nextDate = next ? new Date(next.scheduled_at) : null
  const past = appts.filter((a) => ['completed', 'missed'].includes(a.status)).slice(0, 5)

  return (
    <div className="max-w-[1100px]">
      <h1 className="text-3xl">{greeting()}, {profile.full_name.split(' ')[0]}</h1>
      <p className="text-sm text-muted mt-1">{longDate()}</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5 min-w-0">
          <section className="rounded-xl bg-brand-deep text-white p-6">
            <p className="text-sm text-sb-text">Next follow-up</p>
            {next ? (
              <>
                <p className="font-serif text-3xl sm:text-4xl font-semibold mt-2 leading-tight">
                  {longDate(nextDate)}<br />{time12(nextDate)}
                </p>
                <p className="mt-4 text-sm text-sb-text">
                  {names[next.clinician_id] ?? 'Your doctor'}, Municipal Psychiatrist. {CLINIC}.
                </p>
                {next.status === 'reschedule_requested' ? (
                  <p role="status" className="mt-5 rounded-lg bg-white/10 px-4 py-3 text-sm">
                    You asked for a new date. Your doctor will choose one and you will get a message.
                  </p>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link to={`/cannot-attend/${next.appointment_id}`} className="flex-1 min-w-[160px] text-center rounded-lg bg-white text-st-red font-semibold py-3">Cannot attend</Link>
                    <button disabled title="Coming soon" className="flex-1 min-w-[160px] rounded-lg border border-white/30 py-3 font-semibold opacity-60">Contact my BHW</button>
                  </div>
                )}
              </>
            ) : (
              <p className="font-serif text-2xl font-semibold mt-2">No appointment is scheduled right now.</p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-white">
            <h2 className="px-5 py-4 text-base font-sans font-semibold">Past appointments</h2>
            <ul>
              {past.length === 0 && <li className="px-5 pb-4 text-sm text-muted">No past appointments yet.</li>}
              {past.map((a) => (
                <li key={a.appointment_id} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-line text-sm">
                  <span className="font-semibold">{new Date(a.scheduled_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(',', '')}</span>
                  <span className="text-muted hidden sm:block">{names[a.clinician_id]}</span>
                  <Badge tone={STATUS[a.status][0]}>{STATUS[a.status][1]}</Badge>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-line bg-white">
            <h2 className="px-5 py-4 text-base font-sans font-semibold">My BHW</h2>
            <div className="px-5 pb-5 flex items-center gap-3">
              <div className="size-11 rounded-full bg-tint-teal text-brand-teal text-sm font-semibold grid place-items-center">
                {bhw ? bhw.split(' ').map((w) => w[0]).slice(0, 2).join('') : '?'}
              </div>
              <div>
                <p className="font-semibold text-sm">{bhw ?? 'Not assigned yet'}</p>
                <p className="text-xs text-muted">{bhw ? `Your BHW in ${state.me.purok}` : 'Ask your health center'}</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
