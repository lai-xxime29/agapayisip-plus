import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ComingSoon from './pages/ComingSoon'
import Patients from './pages/Patients'
import RegisterPatient from './pages/RegisterPatient'
import NewObservation from './pages/NewObservation'
import Referrals from './pages/Referrals'
import Consultation from './pages/Consultation'
import Reschedules from './pages/Reschedules'
import MyAppointments from './pages/MyAppointments'
import CannotAttend from './pages/CannotAttend'

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
          <Route path="/patients" element={<Patients />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/appointments" element={<ComingSoon title="Appointments" />} />
          <Route path="/team-notes" element={<ComingSoon title="Team notes" />} />
        </Route>
      </Route>

      {/* Patient / caretaker */}
      <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/my-appointments" element={<MyAppointments />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['patient', 'bhw']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/cannot-attend/:appointmentId" element={<CannotAttend />} />
        </Route>
      </Route>

      {/* Psychiatrist only */}
      <Route element={<ProtectedRoute allowedRoles={['psychiatrist']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/consultations/:patientId" element={<Consultation />} />
          <Route path="/reschedules" element={<Reschedules />} />
        </Route>
      </Route>

      {/* BHW only */}
      <Route element={<ProtectedRoute allowedRoles={['bhw']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/home-visits" element={<ComingSoon title="Home visit tasks" />} />
          <Route path="/reminders" element={<ComingSoon title="Reminders" />} />
          <Route path="/register-patient" element={<RegisterPatient />} />
          <Route path="/new-observation" element={<NewObservation />} />
          <Route path="/new-referral" element={<Referrals />} />
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
