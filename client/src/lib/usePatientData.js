import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

// The signed-in patient's own record, appointments, and the names of their clinician and BHW.
// The database only returns rows that belong to this patient (row-level security).
export function usePatientData() {
  const { profile } = useAuth()
  const [state, setState] = useState({ loading: true })

  const load = useCallback(async () => {
    const { data: me, error } = await supabase.from('patients')
      .select('patient_id, assigned_bhw, purok').eq('user_id', profile.user_id).maybeSingle()
    if (error) { setState({ error: error.message }); return }
    if (!me) { setState({ unlinked: true }); return }

    const { data: appts, error: e2 } = await supabase.from('appointments')
      .select('appointment_id, scheduled_at, status, clinician_id')
      .eq('patient_id', me.patient_id).order('scheduled_at', { ascending: false }).limit(40)
    if (e2) { setState({ error: e2.message }); return }

    const ids = [...new Set([me.assigned_bhw, ...appts.map((a) => a.clinician_id)].filter(Boolean))]
    const names = {}
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids)
      ;(profs ?? []).forEach((p) => { names[p.user_id] = p.full_name })
    }
    const now = Date.now()
    const upcoming = appts.filter((a) => ['upcoming', 'reschedule_requested'].includes(a.status) && new Date(a.scheduled_at) >= now)
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    setState({ me, appts, names, next: upcoming[0] ?? null, bhw: names[me.assigned_bhw] ?? null })
  }, [profile.user_id])

  useEffect(() => { load() }, [load])
  return state
}
