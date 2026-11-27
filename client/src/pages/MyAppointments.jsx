import { Link } from 'react-router-dom'
import { usePatientData } from '../lib/usePatientData'
import { whenLabel } from '../lib/format'
import { Badge } from '../components/ui'
import { PatientNotice, STATUS } from './PatientHome'
import { useLang } from '../lib/i18n'


export default function MyAppointments() {
  const { t } = useLang()
  const state = usePatientData()
  if (state.loading || state.error || state.unlinked) return <PatientNotice state={state} />

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl">{t('My appointments')}</h1>
      <ul className="mt-5 rounded-xl border border-line bg-white divide-y divide-line">
        {state.appts.length === 0 && <li className="p-5 text-sm text-muted">{t('You have no appointments yet.')}</li>}
        {state.appts.map((a) => {
          const canCancel = a.status === 'upcoming' && new Date(a.scheduled_at) > new Date()
          return (
            <li key={a.appointment_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
              <div>
                <p className="font-semibold">{whenLabel(a.scheduled_at)}</p>
                <p className="text-xs text-muted">{state.names[a.clinician_id]}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={STATUS[a.status][0]}>{t(STATUS[a.status][1])}</Badge>
                {canCancel && <Link to={`/cannot-attend/${a.appointment_id}`} className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-st-red">{t('Cannot attend')}</Link>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
