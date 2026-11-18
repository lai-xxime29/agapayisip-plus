// Date helpers shared by the dashboards. Uses the browser's own time zone (Asia/Manila for your users).
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

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
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${time12(d)}`
}

// "Mon 2 Nov"
export function dayLabel(iso) {
  const d = new Date(iso)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// "Today, 8:40 AM" or "Mon 2 Nov"
export function referredLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay ? `Today, ${time12(d)}` : dayLabel(iso)
}

export function longDate(d = new Date()) {
  const full = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]
  const month = ['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()]
  return `${full}, ${d.getDate()} ${month} ${d.getFullYear()}`
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function daysSince(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}
