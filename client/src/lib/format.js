// Date helpers shared by the dashboards. Uses the browser's own time zone (Asia/Manila for your users).
import { CEB, MONTHS_CEB, MONTHS_FULL_CEB, WEEKDAYS_CEB, WEEKDAYS_FULL_CEB } from './ceb'

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS_FULL_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS_FULL_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// Set by the language provider so every date on screen follows the chosen language
let lang = 'en'
export function setFormatLang(l) { lang = l }
const ceb = () => lang === 'ceb'
const MONTHS = { get: (i) => (ceb() ? MONTHS_CEB : MONTHS_EN)[i] }
const WEEKDAYS = { get: (i) => (ceb() ? WEEKDAYS_CEB : WEEKDAYS_EN)[i] }

export function time12(d) {
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m} ${ampm}`
}

// "Fri 6 Nov, 9:00 AM"
export function whenLabel(iso) {
  const d = new Date(iso)
  return `${WEEKDAYS.get(d.getDay())} ${d.getDate()} ${MONTHS.get(d.getMonth())}, ${time12(d)}`
}

// "Mon 2 Nov"
export function dayLabel(iso) {
  const d = new Date(iso)
  return `${WEEKDAYS.get(d.getDay())} ${d.getDate()} ${MONTHS.get(d.getMonth())}`
}

// "Today, 8:40 AM" or "Mon 2 Nov"
export function referredLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay ? `${ceb() ? 'Karon' : 'Today'}, ${time12(d)}` : dayLabel(iso)
}

export function longDate(d = new Date()) {
  const day = (ceb() ? WEEKDAYS_FULL_CEB : WEEKDAYS_FULL_EN)[d.getDay()]
  const month = (ceb() ? MONTHS_FULL_CEB : MONTHS_FULL_EN)[d.getMonth()]
  return `${day}, ${d.getDate()} ${month} ${d.getFullYear()}`
}

// "Fri 6 Nov 2026"
export function dateWithYear(iso) {
  return `${dayLabel(iso)} ${new Date(iso).getFullYear()}`
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  const en = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return ceb() ? CEB[en] : en
}

export function daysSince(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}
