import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { ROLE_LABELS } from '../lib/nav'
import { Badge, Table, GhostButton } from '../components/ui'

export default function Users() {
  const { profile } = useAuth()
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles')
      .select('user_id, username, full_name, role, purok_assigned, status, created_at').order('full_name')
    if (error) { setError(error.message); return }
    setError(''); setRows(data)
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(u) {
    const next = u.status === 'active' ? 'inactive' : 'active'
    if (next === 'inactive' && !window.confirm(`Deactivate ${u.full_name}? They will not be able to sign in.`)) return
    setBusyId(u.user_id); setError('')
    const { error } = await supabase.rpc('set_user_status', { p_user_id: u.user_id, p_status: next })
    setBusyId('')
    if (error) setError(error.message); else load()
  }

  const shown = (rows ?? []).filter((u) =>
    (role === 'all' || u.role === role) &&
    (!q.trim() || `${u.full_name} ${u.username}`.toLowerCase().includes(q.trim().toLowerCase())))

  return (
    <div className="max-w-[1100px]">
      <h1 className="text-3xl">User accounts</h1>
      <p className="text-sm text-muted mt-1 mb-4">Deactivate an account when a staff member leaves. Nothing is deleted, so the audit trail stays complete.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input aria-label="Search users" placeholder="Search by name or username" value={q} onChange={(e) => setQ(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm w-64" />
        <select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <option value="all">All roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="text-st-red text-sm mb-3">{error}</p>}
      <div className="rounded-xl border border-line bg-white">
        <Table heads={['Name', 'Username', 'Role', 'Purok', 'Status', '']}>
          {!rows && <tr><td className="px-5 py-4 text-muted" colSpan={6}>Loading…</td></tr>}
          {rows && shown.length === 0 && <tr><td className="px-5 py-4 text-muted" colSpan={6}>No users match.</td></tr>}
          {shown.map((u) => (
            <tr key={u.user_id}>
              <td className="px-5 py-2.5 font-semibold">{u.full_name}</td>
              <td className="px-5 py-2.5">{u.username}</td>
              <td className="px-5 py-2.5">{ROLE_LABELS[u.role]}</td>
              <td className="px-5 py-2.5 text-muted">{u.purok_assigned ?? '—'}</td>
              <td className="px-5 py-2.5"><Badge tone={u.status === 'active' ? 'green' : 'gray'}>{u.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
              <td className="px-5 py-2.5 text-right">
                {u.user_id !== profile.user_id && (
                  <GhostButton type="button" disabled={busyId === u.user_id} onClick={() => toggle(u)}>
                    {u.status === 'active' ? 'Deactivate' : 'Reactivate'}
                  </GhostButton>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>
      <p className="text-xs text-muted mt-3">New accounts are created by the LGU IT office in Supabase (Authentication, Add user) and then given a profile row.</p>
    </div>
  )
}
