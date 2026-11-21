import { dayLabel, daysSince, time12 } from './format'

export const PHASE_LABEL = {
  screening: 'Screening', actively_monitoring: 'Actively monitoring',
  stable_recovery: 'Stable recovery', discharged: 'Discharged',
}
export const RISK_TONE = { high: 'red', moderate: 'amber', low: 'green' }
export const RISK_LABEL = { high: 'High', moderate: 'Moderate', low: 'Low' }
export const REF_TONE = { referred: 'blue', not_arrived: 'amber', arrived: 'green', closed: 'gray' }

export function referralStatusText(r) {
  if (r.status === 'referred') return 'Awaiting arrival'
  if (r.status === 'not_arrived') return `Not arrived, ${daysSince(r.referred_at)} days`
  if (r.status === 'arrived') {
    const a = new Date(r.arrived_at)
    return `Arrived ${dayLabel(r.arrived_at).slice(4)}, ${time12(a)}`
  }
  return 'Closed'
}
