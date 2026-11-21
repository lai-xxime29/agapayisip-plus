// Small shared pieces taken from the Figma design: badges, cards, patient cell.

const BADGE = {
  blue: 'bg-tint-blue text-st-blue',
  amber: 'bg-tint-amber text-st-amber',
  red: 'bg-tint-red text-st-red',
  green: 'bg-tint-green text-st-green',
  gray: 'bg-tint-gray text-muted',
  solidRed: 'bg-st-red text-white',
}

export function Badge({ tone = 'gray', children }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}>
      {children}
    </span>
  )
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-line bg-white ${className}`}>
      <header className="flex items-center justify-between px-5 py-4">
        <h2 className="text-base font-sans font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Lock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
         className="inline-block mr-1 -mt-0.5" aria-label="Name hidden">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

// MH-0377 / Antonio R. Pepito, Purok 3   or   MH-0388 / (lock) R.T., Purok 1
export function PatientCell({ id, patient, fullName }) {
  return (
    <div>
      <p className="font-semibold text-sm">{id}</p>
      <p className="text-xs text-muted">
        {fullName ? fullName : <><Lock />{patient?.initials}</>}
        {patient?.purok ? `, ${patient.purok}` : ''}
      </p>
    </div>
  )
}

export function Table({ heads, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-field text-left text-xs text-muted">
            {heads.map((h) => <th key={h} className="px-5 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}

export function GhostButton({ children, ...props }) {
  return (
    <button
      className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  )
}
