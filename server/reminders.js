// Sends the 24-hour appointment reminders. Written so it can be tested without a database or a phone:
// `sb` is a Supabase client, `send(subscription, payload)` sends one web push.

const CLINIC = 'RHU Dalaguete'

// Fixed template only (BRL-08): clinic, date and time. Never a diagnosis, medicine, or reason.
export function reminderText(scheduledAt) {
  const when = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(scheduledAt))
  return `Pahinumdom / Reminder: Check-up sa ${CLINIC}, ${when}.`
}

// Send one push to every device a user registered. Expired devices are removed.
export async function pushToUser(sb, send, userId, payload) {
  const { data: subs, error } = await sb.from('push_subscriptions').select('subscription_id, endpoint, keys').eq('user_id', userId)
  if (error) throw new Error(error.message)
  const results = []
  for (const s of subs ?? []) {
    try {
      await send({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload))
      results.push({ subscription_id: s.subscription_id, ok: true })
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await sb.from('push_subscriptions').delete().eq('subscription_id', s.subscription_id)
      results.push({ subscription_id: s.subscription_id, ok: false, status: e.statusCode })
    }
  }
  return { devices: (subs ?? []).length, results }
}

export async function runReminders(sb, send, now = new Date()) {
  const horizon = new Date(now.getTime() + 24 * 3600 * 1000).toISOString()
  const { data: due, error } = await sb.from('appointments')
    .select('appointment_id, patient_id, scheduled_at')
    .eq('status', 'upcoming').is('reminder_sent_at', null)
    .gt('scheduled_at', now.toISOString()).lte('scheduled_at', horizon).limit(200)
  if (error) throw new Error(error.message)

  const summary = { due: due.length, sent: 0, failed: 0, no_device: 0 }
  for (const a of due) {
    // Claim it first, so two overlapping runs can never send the same reminder twice
    const { data: claimed } = await sb.from('appointments')
      .update({ reminder_sent_at: now.toISOString() }).eq('appointment_id', a.appointment_id).is('reminder_sent_at', null).select('appointment_id')
    if (!claimed?.length) continue

    const message = reminderText(a.scheduled_at)
    const { data: patient } = await sb.from('patients').select('user_id').eq('patient_id', a.patient_id).maybeSingle()
    const base = { patient_id: a.patient_id, appointment_id: a.appointment_id, message }

    if (!patient?.user_id) { await sb.from('notifications').insert({ ...base, delivery_status: 'no_subscription' }); summary.no_device++; continue }
    const { devices, results } = await pushToUser(sb, send, patient.user_id, { title: 'AgapayIsip+', body: message, url: '/my-appointments' })
    if (devices === 0) { await sb.from('notifications').insert({ ...base, delivery_status: 'no_subscription' }); summary.no_device++; continue }
    for (const r of results) {
      await sb.from('notifications').insert({ ...base, subscription_id: r.ok ? r.subscription_id : null, delivery_status: r.ok ? 'sent' : 'failed' })
    }
    results.some((r) => r.ok) ? summary.sent++ : summary.failed++
  }
  return summary
}
