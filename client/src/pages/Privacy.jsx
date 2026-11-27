import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import Logo from '../components/Logo'
import { useLang } from '../lib/i18n'

const SECTIONS = [
  ['Who we are', 'AgapayIsip+ is run by the Rural Health Unit (RHU) and the barangay health centers of the Municipality of Dalaguete, Cebu, to keep track of mental health care and follow-up visits.'],
  ['What we keep', 'For patients: a patient ID, initials, birth date, sex, purok, an emergency contact, health observations, referrals, appointments, and consultation notes. For staff: your name, username, role and assigned purok, and a record of what you do in the system.'],
  ['Why we keep it', 'To make sure no patient is lost between visits: to record observations, refer patients to the RHU, remind them of appointments, and arrange a home visit when someone misses one.'],
  ['Who can see it', 'Only people who need it for care. Full patient names are visible to the psychiatrist, the BHW of the patient’s purok, and the patient or caretaker. The Coordinator and Administrator see counts only. Consultation notes are visible to the psychiatrist only. Reminder messages never contain health details.'],
  ['How we protect it', 'Everyone signs in with a personal account. Sessions end after 30 minutes of inactivity, accounts lock after 5 wrong passwords, and every sign-in and sensitive action is written to an audit log that cannot be edited.'],
  ['How long we keep it', 'Records are archived, not deleted. They are kept as long as the program needs them for care and reporting.'],
  ['Your rights', 'Under the Data Privacy Act of 2012 (RA 10173) you may ask to see, correct, or object to the processing of your information. Ask your BHW or the LGU IT office.'],
]

export default function Privacy() {
  const { profile, acceptPrivacy } = useAuth()
  const { t } = useLang()
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (profile.consent_at) return <Navigate to="/dashboard" replace />

  async function accept() {
    setBusy(true); setError('')
    const msg = await acceptPrivacy()
    setBusy(false)
    if (msg) setError(msg) // on success the profile updates and we redirect above
  }

  return (
    <main className="min-h-screen bg-field">
      <header className="bg-brand-deep px-6 py-4"><Logo /></header>
      <div className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="text-3xl">{t('Privacy notice')}</h1>
        <p className="text-sm text-muted mt-1">{t('Please read this before you continue, {name}.', { name: profile.full_name.split(' ')[0] })}</p>

        <div className="mt-5 rounded-xl border border-line bg-white divide-y divide-line">
          {SECTIONS.map(([h, body]) => (
            <section key={h} className="p-5">
              <h2 className="text-base font-sans font-semibold">{t(h)}</h2>
              <p className="mt-1 text-sm text-ink/80">{t(body)}</p>
            </section>
          ))}
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>{t('I have read this notice and I agree to the use of my information as described.')}</span>
        </label>

        {error && <p role="alert" className="mt-3 text-sm text-st-red">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={accept} disabled={!agree || busy}
            className="rounded-lg bg-brand-teal text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
            {busy ? t('Saving…') : t('I agree and continue')}
          </button>
          <button onClick={() => supabase.auth.signOut()} className="rounded-lg border border-line bg-white px-5 py-2.5 text-sm font-semibold">
            {t('Decline and sign out')}
          </button>
        </div>
      </div>
    </main>
  )
}
