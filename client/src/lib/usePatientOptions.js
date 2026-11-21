import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Patients the signed-in BHW can open (their full name is visible to them), for pickers.
export function usePatientOptions() {
  const [options, setOptions] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: ids } = await supabase.from('patient_identities')
        .select('patient_id, full_name').order('full_name').limit(300)
      if (!ids?.length) { if (!cancelled) setOptions([]); return }
      const { data: pts } = await supabase.from('patients')
        .select('patient_id, initials, purok, case_phase, risk_level, has_caretaker')
        .eq('is_archived', false).in('patient_id', ids.map((r) => r.patient_id))
      const byId = Object.fromEntries((pts ?? []).map((p) => [p.patient_id, p]))
      const list = ids.filter((r) => byId[r.patient_id]).map((r) => ({ ...byId[r.patient_id], full_name: r.full_name }))
      if (!cancelled) setOptions(list)
    })()
    return () => { cancelled = true }
  }, [])

  return options
}
