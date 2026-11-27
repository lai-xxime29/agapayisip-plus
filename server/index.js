import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { runReminders, pushToUser } from './reminders.js'

const app = express()
const PORT = process.env.PORT || 4000

// Only the React site may call this server from a browser.
const allowed = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim())
app.use(cors({ origin: allowed }))
app.use(express.json())

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET } = process.env
const ready = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && CRON_SECRET
const sb = ready ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null
if (ready) webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@agapayisip.local', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
else console.warn('Push is OFF: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and CRON_SECRET')

const send = (sub, payload) => webpush.sendNotification(sub, payload)

// Health check: Render uses it, and you can open it in a browser to confirm the server is awake.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'agapayisip-server', push: Boolean(ready), time: new Date().toISOString() })
})

// Called every 5 minutes by the database scheduler (it also wakes this server up).
app.post('/api/run-reminders', async (req, res) => {
  if (!ready) return res.status(503).json({ error: 'Push is not configured' })
  if (req.get('x-cron-secret') !== CRON_SECRET) return res.status(401).json({ error: 'Not allowed' })
  try { res.json(await runReminders(sb, send)) } catch (e) { console.error(e); res.status(500).json({ error: e.message }) }
})

// A signed-in user asks for a test message on their own devices (used in the demo).
const lastTest = new Map()
app.post('/api/push/test', async (req, res) => {
  if (!ready) return res.status(503).json({ error: 'Push is not configured' })
  const token = (req.get('authorization') || '').replace(/^Bearer /, '')
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) return res.status(401).json({ error: 'Please sign in again' })
  const uid = data.user.id
  if (Date.now() - (lastTest.get(uid) ?? 0) < 10000) return res.status(429).json({ error: 'Please wait a few seconds' })
  lastTest.set(uid, Date.now())
  try {
    const r = await pushToUser(sb, send, uid, { title: 'AgapayIsip+', body: 'Test: your reminders are working. / Pagsulay: molihok ang imong mga pahibalo.', url: '/my-appointments' })
    res.json({ devices: r.devices, delivered: r.results.filter((x) => x.ok).length })
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }) }
})

app.listen(PORT, () => console.log(`AgapayIsip+ server listening on port ${PORT}`))
