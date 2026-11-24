import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { whenLabel, dayLabel, time12 } from '../lib/format'
import { Badge, Card, PatientCell, Table } from '../components/ui'

export default function Reminders() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const from = new Date().toISOString()
      const to = new Date(Date.now() + 7 * 86400000).toISOString()
      const [appts, failed] = await Promise.all([
        supabase.from('appointments').select('appointment_id, patient_id, scheduled_at, reminder_sent_at, patients(purok, initials)')
          .eq('status', 'upcoming').gte('scheduled_at', from).lte('scheduled_at', to).order('scheduled_at'),
        supabase.from('notifications').select('notification_id, patient_id, message, sent_at, delivery_status, patients(purok, initials)')
          .in('delivery_status', ['failed', 'no_subscription']).order('sent_at', { ascending: false }).limit(30),
      ])
      const err = [appts, failed].find((r) => r.error)?.error
      if (err) { setError(err.message); return }
      const ids = [...new Set([...appts.data, ...failed.data].map((r) => r.patient_id))]
      const names = {}
      if (ids.length) {
        const { data: rows } = await supabase.from('patient_identities').select('patient_id, full_name').in('patient_id', ids)
        ;(rows ?? []).forEach((r) => { names[r.patient_id] = r.full_name })
      }
      setData({ appts: appts.data, failed: failed.data, names })
    })()
  }, [])

  if (error) return <p role="alert" className="text-st-red text-sm">Could not load reminders: {error}</p>
  if (!data) return <p className="text-sm text-muted">Loading…</p>
  const { appts, failed, names } = data

  return (
    <div className="max-w-[1100px] space-y-5">
      <div>
        <h1 className="text-3xl">Reminders</h1>
        <p className="text-sm text-muted mt-1">Reminders go out automatically 24 hours before each appointment. Messages use a fixed template and never include health details.</p>
      </div>

      <Card title="Contact manually">
        <p className="px-5 pb-3 text-sm text-muted">These reminders could not be delivered (no device registered or delivery failed). Please visit or call.</p>
        <Table heads={['Patient', 'Message', 'Tried', 'Reason']}>
          {failed.length === 0 && <tr><td className="px-5 py-4 text-muted" colSpan={4}>All reminders were delivered.</td></tr>}
          {failed.map((n) => (
            <tr key={n.notification_id}>
              <td className="px-5 py-2.5"><PatientCell id={n.patient_id} patient={n.patients} fullName={names[n.patient_id]} /></td>
              <td className="px-5 py-2.5 break-words">{n.message}</td>
              <td className="px-5 py-2.5 whitespace-nowrap">{whenLabel(n.sent_at)}</td>
              <td className="px-5 py-2.5"><Badge tone="amber">{n.delivery_status === 'no_subscription' ? 'No device' : 'Failed'}</Badge></td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Next 7 days">
        <Table heads={['Patient', 'Appointment', 'Reminder']}>
          {appts.length === 0 && <tr><td className="px-5 py-4 text-muted" colSpan={3}>No appointments in the next 7 days.</td></tr>}
          {appts.map((a) => {
            const auto = new Date(new Date(a.scheduled_at).getTime() - 86400000)
            return (
              <tr key={a.appointment_id}>
                <td className="px-5 py-2.5"><PatientCell id={a.patient_id} patient={a.patients} fullName={names[a.patient_id]} /></td>
                <td className="px-5 py-2.5 whitespace-nowrap">{whenLabel(a.scheduled_at)}</td>
                <td className="px-5 py-2.5">
                  {a.reminder_sent_at ? <Badge tone="green">Sent</Badge> : <span className="text-muted">Auto {dayLabel(auto)}, {time12(auto)}</span>}
                </td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </div>
  )
}
