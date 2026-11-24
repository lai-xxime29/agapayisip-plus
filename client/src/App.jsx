import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import RegisterPatient from './pages/RegisterPatient'
import NewObservation from './pages/NewObservation'
import Referrals from './pages/Referrals'
import Consultation from './pages/Consultation'
import Reschedules from './pages/Reschedules'
import MyAppointments from './pages/MyAppointments'
import CannotAttend from './pages/CannotAttend'
import HomeVisits from './pages/HomeVisits'
import Appointments from './pages/Appointments'
import Reminders from './pages/Reminders'
import TeamNotes from './pages/TeamNotes'
import Users from './pages/Users'
import AuditLog from './pages/AuditLog'
import Archive from './pages/Archive'

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
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/team-notes" element={<TeamNotes />} />
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
          <Route path="/home-visits" element={<HomeVisits />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/register-patient" element={<RegisterPatient />} />
          <Route path="/new-observation" element={<NewObservation />} />
          <Route path="/new-referral" element={<Referrals />} />
        </Route>
      </Route>

      {/* Administrator only */}
      <Route element={<ProtectedRoute allowedRoles={['administrator']} />}>
        <Route element={<DashboardLayout />}>
          <Route path="/users" element={<Users />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/archive" element={<Archive />} />
        </Route>
      </Route>

      <Route path="*" element={<h1 className="p-6 text-xl">No page at this address</h1>} />
    </Routes>
  )
}
