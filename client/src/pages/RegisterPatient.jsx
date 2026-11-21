import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const BARANGAY = import.meta.env.VITE_BARANGAY || 'Balud'
const todayStr = () => new Date().toISOString().slice(0, 10)
const cleanMobile = (s) => s.replace(/[\s-]/g, '')
const MOBILE_OK = (s) => /^09\d{9}$/.test(cleanMobile(s))

const input = 'mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal'

function Section({ n, title, children }) {
  return (
    <section className="rounded-xl border border-line bg-white">
      <header className="flex items-center gap-3 px-5 py-3.5 border-b border-line">
        <span className="size-6 rounded-full bg-tint-teal text-brand-teal text-xs font-semibold grid place-items-center">{n}</span>
        <h2 className="text-base font-sans font-semibold">{title}</h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Field({ label, required, error, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold">{label}{required && <span className="text-st-red"> *</span>}</span>
      {children}
      {error && <span role="alert" className="block mt-1 text-xs text-st-red">{error}</span>}
      {hint && !error && <span className="block mt-1 text-xs text-muted">{hint}</span>}
    </label>
  )
}

export default function RegisterPatient() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const entryId = useRef(crypto.randomUUID()) // same id on retry, so a double click cannot create two patients

  const blank = () => ({
    full_name: '', birth_date: '', sex: '', purok: profile.purok_assigned ?? '',
    contact_name: '', mobile: '', has_caretaker: null, proxy: profile.user_id,
  })
  const [form, setForm] = useState(blank)
  const [puroks, setPuroks] = useState([])
  const [bhws, setBhws] = useState([])
  const [touched, setTouched] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState('')
  const [matches, setMatches] = useState(null) // null = not searched yet
  const [search, setSearch] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    supabase.from('puroks').select('name').order('name').then(({ data }) => setPuroks(data ?? []))
    supabase.from('profiles').select('user_id, full_name').eq('role', 'bhw').eq('status', 'active').order('full_name')
      .then(({ data }) => setBhws(data ?? []))
  }, [])

  // Step 1: look for an existing record (only records this BHW is allowed to see come back)
  useEffect(() => {
    const q = search.trim().replace(/[%,()*]/g, '')
    if (q.length < 3) { setMatches(null); return }
    const t = setTimeout(async () => {
      const { data: ids } = await supabase.from('patient_identities').select('patient_id, full_name').ilike('full_name', `%${q}%`).limit(5)
      if (!ids?.length) { setMatches([]); return }
      const { data: pts } = await supabase.from('patients').select('patient_id, purok').in('patient_id', ids.map((r) => r.patient_id))
      const purokOf = Object.fromEntries((pts ?? []).map((p) => [p.patient_id, p.purok]))
      setMatches(ids.map((r) => ({ ...r, purok: purokOf[r.patient_id] })))
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  // Checks that drive the "Before you save" list
  const basicOk = form.full_name.trim() && form.birth_date && form.birth_date <= todayStr() && form.sex && form.purok
  const mobileOk = MOBILE_OK(form.mobile)
  const contactOk = form.contact_name.trim() && mobileOk
  const caretakerOk = form.has_caretaker !== null
  const proxyOk = form.has_caretaker === false ? !!form.proxy : true
  const canSave = basicOk && contactOk && caretakerOk && proxyOk && !busy

  async function save() {
    setBusy(true); setError('')
    const { data, error } = await supabase.rpc('register_patient', {
      p_client_entry_id: entryId.current,
      p_full_name: form.full_name.trim(),
      p_birth_date: form.birth_date,
      p_sex: form.sex,
      p_purok: form.purok,
      p_emergency_contact: `${form.contact_name.trim()} (${cleanMobile(form.mobile)})`,
      p_has_caretaker: form.has_caretaker,
      p_assigned_bhw: form.has_caretaker ? null : form.proxy,
    })
    setBusy(false)
    if (error) { setError(error.message); return }
    setSavedId(data)
  }

  function another() {
    entryId.current = crypto.randomUUID()
    setForm(blank()); setTouched({}); setSearch(''); setMatches(null); setSavedId(''); setError('')
  }

  if (savedId) {
    return (
      <div className="max-w-md">
        <div className="rounded-xl border border-line bg-white p-6">
          <p className="text-xs text-muted">Patient registered</p>
          <p className="font-serif text-5xl font-semibold text-brand-teal mt-1">{savedId}</p>
          <p className="text-sm text-muted mt-2">Write this ID on the patient's card. IDs are never reused, even if a record is archived.</p>
          <div className="mt-5 flex gap-2">
            <button onClick={another} className="rounded-lg bg-brand-teal text-white px-4 py-2 text-sm font-semibold">Register another</button>
            <Link to="/patients" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">View patients</Link>
          </div>
        </div>
      </div>
    )
  }

  const border = (bad) => (bad ? 'border-st-red' : 'border-line')
  const mobileBad = touched.mobile && form.mobile && !mobileOk

  return (
    <div className="max-w-[1100px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">Register patient</h1>
          <p className="text-sm text-muted mt-1">Confirm the person is not already registered, then fill in the form. The patient ID is created when you save.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={save} disabled={!canSave} className="rounded-lg bg-brand-teal text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? 'Saving…' : 'Save patient'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-tint-red text-st-red text-sm px-4 py-3">{error}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5 min-w-0">
          <Section n="1" title="Check for an existing record">
            <Field label="Search by name">
              <input className={`${input} border-line`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type at least 3 letters" />
            </Field>
            {matches?.length === 0 && (
              <div className="mt-3 rounded-lg bg-tint-green text-st-green text-sm p-3">
                <p className="font-semibold">No match found</p>
                <p>Nobody named {search.trim()} is registered in {BARANGAY} that you can see. You can continue.</p>
              </div>
            )}
            {matches?.length > 0 && (
              <div className="mt-3 rounded-lg bg-tint-amber text-st-amber text-sm p-3">
                <p className="font-semibold">Possible existing record</p>
                <ul className="mt-1">{matches.map((m) => <li key={m.patient_id}>{m.patient_id}, {m.full_name}, {m.purok}</li>)}</ul>
                <p className="mt-1">Check this is not the same person before you continue.</p>
              </div>
            )}
          </Section>

          <Section n="2" title="Personal details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" required>
                <input className={`${input} border-line`} maxLength={120} value={form.full_name} onChange={set('full_name')} />
              </Field>
              <Field label="Birth date" required>
                <input type="date" max={todayStr()} className={`${input} border-line`} value={form.birth_date} onChange={set('birth_date')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 mt-4">
              <Field label="Sex" required>
                <select className={`${input} border-line`} value={form.sex} onChange={set('sex')}>
                  <option value="">Select</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Purok" required>
                <select className={`${input} border-line`} value={form.purok} onChange={set('purok')}>
                  <option value="">Select</option>
                  {puroks.map((p) => <option key={p.name}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Barangay">
                <input className={`${input} border-line bg-field text-muted`} value={BARANGAY} readOnly />
              </Field>
            </div>
          </Section>

          <Section n="3" title="Emergency contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact name" required>
                <input className={`${input} border-line`} maxLength={80} value={form.contact_name} onChange={set('contact_name')} placeholder="Name and relationship" />
              </Field>
              <Field label="Mobile number" required error={mobileBad ? 'Use 11 digits, for example 09171234567.' : ''}>
                <input inputMode="tel" className={`${input} ${border(mobileBad)}`} value={form.mobile} onChange={set('mobile')}
                  onBlur={() => setTouched((t) => ({ ...t, mobile: true }))} />
              </Field>
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section n="4" title="Family caretaker">
            <p className="text-sm font-semibold">Does the patient have a family caretaker?</p>
            <div className="mt-3 inline-flex rounded-lg border border-line overflow-hidden text-sm font-semibold">
              {[['Yes', true], ['No', false]].map(([label, val]) => (
                <button key={label} type="button" onClick={() => setForm((f) => ({ ...f, has_caretaker: val }))}
                  className={`px-5 py-2 ${form.has_caretaker === val ? 'bg-brand-teal text-white' : 'bg-white'}`}>{label}</button>
              ))}
            </div>
            {form.has_caretaker === false && (
              <>
                <div className="mt-4 rounded-lg bg-tint-amber text-st-amber text-sm p-3">
                  <p className="font-semibold">Solo patient</p>
                  <p>A proxy BHW is required before you can save. If this patient misses an appointment, a home visit task is created for the proxy.</p>
                </div>
                <div className="mt-4">
                  <Field label="Proxy BHW" required hint="Default is the BHW who registers the patient. Only active BHW accounts can be chosen.">
                    <select className={`${input} border-line`} value={form.proxy} onChange={set('proxy')}>
                      {bhws.map((b) => <option key={b.user_id} value={b.user_id}>{b.full_name}{b.user_id === profile.user_id ? ' (you)' : ''}</option>)}
                    </select>
                  </Field>
                </div>
              </>
            )}
          </Section>

          <div className="rounded-xl border border-line bg-white p-5">
            <p className="text-xs text-muted">Patient ID</p>
            <p className="font-serif text-4xl font-semibold text-muted">MH-nnnn</p>
            <p className="text-sm text-muted mt-1">Created when you save. IDs are never reused, even if a record is archived.</p>
          </div>

          <div className="rounded-xl border border-line bg-white">
            <h2 className="px-5 py-3.5 text-base font-sans font-semibold border-b border-line">Before you save</h2>
            <ul className="p-5 space-y-2 text-sm">
              {[
                ['Name, birth date, sex, purok', basicOk],
                ['Emergency contact name and mobile number', contactOk],
                ['Caretaker answer', caretakerOk],
                ['Proxy BHW assigned (solo patients)', proxyOk && caretakerOk],
              ].map(([label, ok]) => (
                <li key={label} className={ok ? 'text-st-green' : 'text-muted'}>
                  <span aria-hidden="true" className="inline-block w-5">{ok ? '✓' : '○'}</span>{label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
