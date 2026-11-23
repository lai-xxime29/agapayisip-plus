import RescheduleRequests from '../components/RescheduleRequests'

export default function Reschedules() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl">Reschedules</h1>
      <p className="text-sm text-muted mt-1 mb-5">Patients who cannot attend. Set a new date for each request.</p>
      <RescheduleRequests />
    </div>
  )
}
