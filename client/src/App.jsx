import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ComingSoon from './pages/ComingSoon'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />

      {/* Signed-in users (any role) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Route>

      {/* BHW + Psychiatrist (clinical staff) */}
      <Route element={<ProtectedRoute allowedRoles={['bhw', 'psychiatrist']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/patients" element={<ComingSoon title="Patients" />} />
          <Route path="/referrals" element={<ComingSoon title="Referrals" />} />
          <Route path="/appointments" element={<ComingSoon title="Appointments" />} />
          <Route path="/team-notes" element={<ComingSoon title="Team notes" />} />
        </Route>
      </Route>

      {/* BHW only */}
      <Route element={<ProtectedRoute allowedRoles={['bhw']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/home-visits" element={<ComingSoon title="Home visit tasks" />} />
          <Route path="/reminders" element={<ComingSoon title="Reminders" />} />
          <Route path="/register-patient" element={<ComingSoon title="Register patient" />} />
          <Route path="/new-observation" element={<ComingSoon title="New observation" />} />
          <Route path="/new-referral" element={<ComingSoon title="New referral" />} />
        </Route>
      </Route>

      {/* Administrator only */}
      <Route element={<ProtectedRoute allowedRoles={['administrator']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/users" element={<ComingSoon title="User accounts" />} />
          <Route path="/audit-log" element={<ComingSoon title="Audit log" />} />
          <Route path="/archive" element={<ComingSoon title="Patient archive" />} />
        </Route>
      </Route>

      <Route path="*" element={<h1 className="p-6 text-xl">No page at this address</h1>} />
    </Routes>
  )
}
