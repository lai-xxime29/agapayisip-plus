import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { whenLabel } from '../lib/format'
import { Table } from '../components/ui'

const ACTION_LABEL = {
  login: 'Signed in', register_patient: 'Registered a patient', archive_patient: 'Archived a patient',
  referral_arrived: 'Marked referral arrived', set_user_inactive: 'Deactivated an account', set_user_active: 'Reactivated an account',
}
const pretty = (a) => ACTION_LABEL[a] ?? a.replaceAll('_', ' ')

export default function AuditLog() {
  const [rows, setRows] = useState(null)
  const [action, setAction] = useState('all')
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      setRows(null)
      let q = supabase.from('audit_log')
        .select('log_id, action, entity, entity_id, created_at, user:profiles(full_name, username)')
        .order('created_at', { ascending: false }).limit(200)
      if (action !== 'all') q = q.eq('action', action)
      const { data, error } = await q
      if (error) { setError(error.message); return }
      setError(''); setRows(data)
    })()
  }, [action])

  return (
    <div className="max-w-[1100px]">
      <h1 className="text-3xl">Audit log</h1>
      <p className="text-sm text-muted mt-1 mb-4">Who did what, and when. This record cannot be edited or deleted. Showing the latest 200.</p>

      <select aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)}
        className="rounded-lg border border-line bg-white px-3 py-2 text-sm mb-4">
        <option value="all">All actions</option>
        {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      {error && <p role="alert" className="text-st-red text-sm mb-3">{error}</p>}
      <div className="rounded-xl border border-line bg-white">
        <Table heads={['When', 'Who', 'Action', 'Record']}>
          {!rows && <tr><td className="px-5 py-4 text-muted" colSpan={4}>Loading…</td></tr>}
          {rows?.length === 0 && <tr><td className="px-5 py-4 text-muted" colSpan={4}>No entries.</td></tr>}
          {rows?.map((r) => (
            <tr key={r.log_id}>
              <td className="px-5 py-2.5 whitespace-nowrap">{whenLabel(r.created_at)}</td>
              <td className="px-5 py-2.5">{r.user?.full_name ?? 'System'} <span className="text-xs text-muted">{r.user?.username}</span></td>
              <td className="px-5 py-2.5">{pretty(r.action)}</td>
              <td className="px-5 py-2.5 text-muted break-all">{r.entity_id ? `${r.entity} ${r.entity_id}` : '—'}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
