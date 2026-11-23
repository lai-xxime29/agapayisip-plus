import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { REF_TONE, referralStatusText } from '../lib/labels'
import { referredLabel } from '../lib/format'
import { Badge, Card, PatientCell, Table } from './ui'

// Open referrals, urgent first. The psychiatrist confirms arrival here (FR-10).
export default function ReferralQueue({ limit = 50, onChange, showLink = false }) {
  const [rows, setRows] = useState(null)
  const [names, setNames] = useState({})
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('referrals')
      .select('referral_id, patient_id, urgency, status, referred_at, arrived_at, referrer:profiles(full_name), patients(purok, initials)')
      .in('status', ['referred', 'not_arrived'])
      .order('urgency', { ascending: false }).order('referred_at', { ascending: true }).limit(limit)
    if (error) { setError(error.message); return }
    const ids = [...new Set(data.map((r) => r.patient_id))]
    const map = {}
    if (ids.length) {
      const { data: idRows } = await supabase.from('patient_identities').select('patient_id, full_name').in('patient_id', ids)
      ;(idRows ?? []).forEach((r) => { map[r.patient_id] = r.full_name })
    }
    setError(''); setNames(map); setRows(data)
  }, [limit])

  useEffect(() => { load() }, [load])

  async function markArrived(id) {
    setBusyId(id); setError('')
    const { error } = await supabase.rpc('mark_referral_arrived', { p_referral_id: id })
    setBusyId('')
    if (error) { setError(error.message); return }
    await load(); onChange?.()
  }

  return (
    <Card title="Referral queue" action={showLink && <Link to="/referrals" className="text-sm font-semibold text-brand-teal">View all ›</Link>}>
      {error && <p role="alert" className="px-5 pb-3 text-sm text-st-red">{error}</p>}
      {rows === null ? <p className="px-5 pb-4 text-sm text-muted">Loading…</p> : (
        <Table heads={['Patient', 'Urgency', 'Referred by', 'Status', '']}>
          {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-4 text-muted">No referrals are waiting.</td></tr>}
          {rows.map((r) => (
            <tr key={r.referral_id}>
              <td className="px-5 py-2.5">
                <Link to={`/consultations/${r.patient_id}`} className="hover:underline">
                  <PatientCell id={r.patient_id} patient={r.patients} fullName={names[r.patient_id]} />
                </Link>
              </td>
              <td className="px-5 py-2.5"><Badge tone={r.urgency === 'urgent' ? 'solidRed' : 'gray'}>{r.urgency === 'urgent' ? 'Urgent' : 'Routine'}</Badge></td>
              <td className="px-5 py-2.5"><p className="font-semibold">{r.referrer?.full_name ?? '—'}</p><p className="text-xs text-muted">{referredLabel(r.referred_at)}</p></td>
              <td className="px-5 py-2.5"><Badge tone={REF_TONE[r.status]}>{referralStatusText(r)}</Badge></td>
              <td className="px-5 py-2.5 text-right">
                <button onClick={() => markArrived(r.referral_id)} disabled={busyId === r.referral_id}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${r.urgency === 'urgent' ? 'bg-brand-teal text-white' : 'border border-line bg-white'}`}>
                  {busyId === r.referral_id ? 'Saving…' : 'Mark arrived'}
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}
