// Sidebar items per role (from the Figma role dashboards).
export const ROLE_LABELS = {
  bhw: 'BHW',
  psychiatrist: 'Psychiatrist',
  coordinator: 'Coordinator',
  administrator: 'Administrator',
  patient: 'Patient',
}

export const NAV = {
  bhw: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Patients', to: '/patients' },
    { label: 'Referrals', to: '/referrals' },
    { label: 'Appointments', to: '/appointments' },
    { label: 'Home visits', to: '/home-visits' },
    { label: 'Reminders', to: '/reminders' },
    { label: 'Team notes', to: '/team-notes' },
  ],
  psychiatrist: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Patients', to: '/patients' },
    { label: 'Referrals', to: '/referrals' },
    { label: 'Appointments', to: '/appointments' },
    { label: 'Team notes', to: '/team-notes' },
  ],
  coordinator: [{ label: 'Overview', to: '/dashboard' }],
  administrator: [
    { label: 'Overview', to: '/dashboard' },
    { label: 'User accounts', to: '/users' },
    { label: 'Audit log', to: '/audit-log' },
    { label: 'Patient archive', to: '/archive' },
  ],
  patient: [{ label: 'Home', to: '/dashboard' }],
}
