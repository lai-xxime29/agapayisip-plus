import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n'
import { pushStatus, enablePush, disablePush, sendTestPush } from '../lib/push'

// "Appointment reminders" card on the patient home page.
export default function ReminderCard() {
  const { t } = useLang()
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { pushStatus().then(setStatus) }, [])
  if (!status) return null

  async function run(fn) {
    setBusy(true); setMsg('')
    try { setStatus(await fn()) } catch (e) { setMsg(e.message) }
    setBusy(false)
  }
  async function test() {
    setBusy(true); setMsg('')
    try {
      const r = await sendTestPush()
      setMsg(r.delivered > 0 ? t('Test sent. Check your notifications.') : t('No phone is registered yet. Turn on reminders first.'))
    } catch (e) { setMsg(e.message) }
    setBusy(false)
  }

  const hints = {
    needs_install: t('On iPhone: tap Share, then "Add to Home Screen", then open AgapayIsip+ from your home screen and come back here.'),
    unsupported: t('This browser cannot show reminders. Try Chrome on your phone.'),
    not_set_up: t('Reminders are not set up yet.'),
    denied: t('Notifications are blocked. Allow them for this site in your browser settings, then reload.'),
  }

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="text-base font-sans font-semibold">{t('Appointment reminders')}</h2>
      {status === 'on' ? (
        <>
          <p className="mt-2 text-sm text-st-green" role="status">{t('Reminders are on for this phone. You get a message 1 day before your appointment.')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={test} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50">{t('Send me a test')}</button>
            <button disabled={busy} onClick={() => run(disablePush)} className="rounded-lg px-3 py-2 text-sm text-muted underline disabled:opacity-50">{t('Turn off')}</button>
          </div>
        </>
      ) : status === 'off' ? (
        <>
          <p className="mt-2 text-sm text-muted">{t('Get a message on this phone 1 day before each appointment.')}</p>
          <button disabled={busy} onClick={() => run(enablePush)} className="mt-3 rounded-lg bg-brand-teal text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? t('Saving…') : t('Turn on reminders')}
          </button>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">{hints[status]}</p>
      )}
      {msg && <p role="alert" className="mt-2 text-sm text-muted">{msg}</p>}
    </section>
  )
}
