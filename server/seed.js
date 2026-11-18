// Demo data for AgapayIsip+  |  run once from the server folder:  npm run seed
// Uses the Supabase SECRET key (server/.env), so it must never run in the browser.
//
// Creates: 3 BHWs, 1 psychiatrist, 1 coordinator, 2 patient logins,
//          200 fake patients, and appointments / referrals / home-visit tasks / notes for the dashboards.
// All people and numbers are made up. Do not use this data outside the demo.

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const PASSWORD = process.env.SEED_PASSWORD || 'Demo#Agapay2026'
const force = process.argv.includes('--force')

// ---- small helpers ---------------------------------------------------------
let seed = 20261115
function rand() { // repeatable random numbers
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const hours = (h) => new Date(Date.now() + h * 3600e3).toISOString()
const days = (d) => hours(d * 24)
const check = (label, { error }) => { if (error) { console.error(`FAILED: ${label}\n`, error); process.exit(1) } }

// ---- accounts --------------------------------------------------------------
const USERS = [
  { username: 'lmontecillo', full_name: 'Liza Montecillo', role: 'bhw', purok: 'Purok 3' },
  { username: 'rcabahug', full_name: 'Rosa Cabahug', role: 'bhw', purok: 'Purok 1' },
  { username: 'jvillaruz', full_name: 'Jun Villaruz', role: 'bhw', purok: 'Purok 5' },
  { username: 'dralcantara', full_name: 'Dr. Miguel Alcantara', role: 'psychiatrist', purok: null },
  { username: 'coordinator', full_name: 'Carmen Dizon', role: 'coordinator', purok: null },
]

async function ensureAuthUser(username) {
  const email = `${username}@agapayisip.local`
  const { data, error } = await sb.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (!error) return data.user.id
  const { data: list, error: e2 } = await sb.auth.admin.listUsers({ perPage: 1000 })
  if (e2) throw e2
  const found = list.users.find((u) => u.email === email)
  if (!found) throw error
  return found.id
}

async function ensureProfile(u) {
  const id = await ensureAuthUser(u.username)
  check(`profile ${u.username}`, await sb.from('profiles').upsert({
    user_id: id, username: u.username, full_name: u.full_name, role: u.role, purok_assigned: u.purok, status: 'active',
  }))
  return id
}

// ---- main ------------------------------------------------------------------
const { count } = await sb.from('patients').select('patient_id', { count: 'exact', head: true })
if (count > 0 && !force) {
  console.error(`The database already has ${count} patients. Nothing was changed.\nRun "npm run seed -- --force" only if you want to add another batch.`)
  process.exit(1)
}

console.log('Creating accounts...')
const ids = {}
for (const u of USERS) ids[u.username] = await ensureProfile(u)
const bhwOf = { 'Purok 1': ids.rcabahug, 'Purok 2': ids.rcabahug, 'Purok 3': ids.lmontecillo, 'Purok 4': ids.lmontecillo,
                'Purok 5': ids.jvillaruz, 'Purok 6': ids.jvillaruz, 'Purok 7': ids.jvillaruz }

const FIRST = ['Maria','Josefa','Elena','Rodrigo','Antonio','Juan','Rosario','Teresita','Pedro','Lourdes','Carlos','Imelda','Ramon','Felisa','Eduardo','Nena','Roberto','Gloria','Danilo','Marites','Jose','Ana','Ricardo','Luz','Fernando','Cecilia','Alfredo','Divina','Mario','Corazon']
const MID = ['R.','L.','C.','M.','T.','A.','S.','B.','D.','V.']
const LAST = ['Pepito','Cabahug','Villaruz','Gonzaga','Sabellano','Quirog','Alcantara','Montecillo','Lumapas','Tumulak','Bacalso','Ouano','Cuizon','Rosal','Pacaña','Dizon','Abella','Ybañez','Estrera','Labra']
const PUROKS = ['Purok 1','Purok 2','Purok 3','Purok 4','Purok 5','Purok 6','Purok 7']
const PHASES = ['screening','actively_monitoring','actively_monitoring','stable_recovery','discharged']

console.log('Creating 200 patients...')
const people = Array.from({ length: 200 }, () => {
  const first = pick(FIRST), mid = pick(MID), last = pick(LAST)
  const purok = pick(PUROKS)
  const hasCaretaker = rand() < 0.65
  return {
    full_name: `${first} ${mid} ${last}`, initials: `${first[0]}${mid[0]}${last[0]}`.replace('.', ''),
    purok, hasCaretaker,
    birth: new Date(1950 + Math.floor(rand() * 58), Math.floor(rand() * 12), 1 + Math.floor(rand() * 28)).toISOString().slice(0, 10),
    sex: pick(['female', 'male']), phase: pick(PHASES), risk: rand() < 0.15 ? 'high' : rand() < 0.3 ? 'moderate' : 'low',
    phone: `09${Math.floor(100000000 + rand() * 899999999)}`,
  }
})
const { data: pRows, error: pErr } = await sb.from('patients').insert(
  people.map((p) => ({
    client_entry_id: crypto.randomUUID(), initials: p.initials, purok: p.purok, has_caretaker: p.hasCaretaker,
    assigned_bhw: p.hasCaretaker ? null : bhwOf[p.purok], registered_by: bhwOf[p.purok],
    case_phase: p.phase, risk_level: p.risk,
  }))
).select('patient_id')
check('patients', { error: pErr })
pRows.forEach((r, i) => { people[i].id = r.patient_id })
check('identities', await sb.from('patient_identities').insert(
  people.map((p) => ({ patient_id: p.id, full_name: p.full_name, birth_date: p.birth, sex: p.sex, emergency_contact: p.phone }))
))

// Patient portal logins for two patients who have a caretaker
const withCare = people.filter((p) => p.hasCaretaker)
for (const [i, username] of ['patient01', 'patient02'].entries()) {
  const uid = await ensureProfile({ username, full_name: withCare[i].full_name, role: 'patient', purok: null })
  check('link patient login', await sb.from('patients').update({ user_id: uid }).eq('patient_id', withCare[i].id))
}

console.log('Creating appointments, referrals, tasks and notes...')
const doctor = ids.dralcantara
for (const bhwName of ['lmontecillo', 'rcabahug', 'jvillaruz']) {
  const mine = people.filter((p) => bhwOf[p.purok] === ids[bhwName])
  const solo = mine.filter((p) => !p.hasCaretaker), care = mine.filter((p) => p.hasCaretaker)
  const appt = async (p, whenIso, status, extra = {}) => {
    const { data, error } = await sb.from('appointments').insert({
      patient_id: p.id, clinician_id: doctor, scheduled_at: whenIso, status, created_by: ids[bhwName], ...extra,
    }).select('appointment_id').single()
    check('appointment', { error }); return data.appointment_id
  }

  // Missed solo patients -> Home Visit Required (one fresh, one overdue)
  const a1 = await appt(solo[0], days(-3), 'missed')
  const a2 = await appt(solo[1], days(-8), 'missed')
  check('task 1', await sb.from('home_visit_tasks').insert({ appointment_id: a1, patient_id: solo[0].id, assigned_bhw: ids[bhwName], status: 'open', created_at: days(-3) }))
  check('task 2', await sb.from('home_visit_tasks').insert({ appointment_id: a2, patient_id: solo[1].id, assigned_bhw: ids[bhwName], status: 'overdue', created_at: days(-7) }))

  await appt(care[0], days(2), 'reschedule_requested', { reschedule_reason: 'no_fare', preferred_date: days(5).slice(0, 10), requested_by: ids[bhwName] })
  const up1 = await appt(care[1], hours(10), 'upcoming')
  const up2 = await appt(solo[2], hours(20), 'upcoming', { reminder_sent_at: hours(-2) })
  await appt(care[2], days(3), 'upcoming'); await appt(solo[3], days(4), 'upcoming'); await appt(care[3], days(6), 'upcoming')
  await appt(solo[4], days(-5), 'completed'); await appt(care[4], days(-10), 'completed')

  check('failed reminder', await sb.from('notifications').insert({
    patient_id: solo[2].id, appointment_id: up2, message: 'Reminder: you have a check-up tomorrow.', delivery_status: 'no_subscription',
  }))

  const ref = (p, urgency, status, when, extra = {}) => ({ patient_id: p.id, referred_by: ids[bhwName], reason: 'Behavior changes noted at home visit', urgency, status, referred_at: when, ...extra })
  check('referrals', await sb.from('referrals').insert([
    ref(care[5], 'urgent', 'referred', hours(-3)),
    ref(solo[5], 'routine', 'not_arrived', days(-9)),
    ref(care[6], 'routine', 'arrived', days(-5), { arrived_at: days(-4) }),
  ]))

  check('observations', await sb.from('observations').insert([
    { patient_id: solo[6].id, recorded_by: ids[bhwName], signs_checked: ['isolating', 'poor sleep'], suicidal_ideation: false, self_harm_history: false },
    { patient_id: care[7].id, recorded_by: ids[bhwName], signs_checked: ['not eating'], suicidal_ideation: false, self_harm_history: false },
  ]))

  check('notes', await sb.from('patient_notes').insert([
    { patient_id: solo[0].id, author_id: doctor, body: 'Noted. Please visit Monday and check on meals.', created_at: days(-1) },
    { patient_id: solo[0].id, author_id: ids[bhwName], body: 'Patient anxious, skipped meals. Neighbor says he stayed indoors.', created_at: days(-2) },
  ]))
}

console.log(`\nDone. Demo logins (password for all: ${PASSWORD})`)
for (const u of [...USERS, { username: 'patient01', role: 'patient' }, { username: 'patient02', role: 'patient' }])
  console.log(`  ${u.username.padEnd(12)} ${u.role}`)
