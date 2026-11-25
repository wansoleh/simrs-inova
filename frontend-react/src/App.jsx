import { useEffect, useState } from 'react'
import { ConfigProvider, App as AntApp, theme } from 'antd'
import idID from 'antd/locale/id_ID'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import Registration from './pages/Registration'
import DoctorQueue from './pages/DoctorQueue'
import Exam from './pages/Exam'
import Pharmacy from './pages/Pharmacy'
import Lab from './pages/Lab'
import Cashier from './pages/Cashier'
import Reports from './pages/Reports'
import MasterData from './pages/MasterData'
import Users from './pages/Users'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'
import './App.css'

const THEME_KEY = 'simrs_theme'

function Protected({ children }) {
  const { isAuthenticated, booting } = useAuth()
  if (booting) return <div className="boot-screen"><div className="boot-logo">+</div><span>Menyiapkan SIMRS…</span></div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function Guard({ permission, children }) {
  const { hasPermission } = useAuth()
  if (!hasPermission(permission)) return <Navigate to="/app" replace />
  return children
}

function GuardAny({ permissions, children }) {
  const { hasPermission } = useAuth()
  if (!permissions.some((permission) => hasPermission(permission))) return <Navigate to="/app" replace />
  return children
}

function AppRoutes({ dark, onToggleTheme }) {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/app"
        element={(
          <Protected>
            <AppLayout dark={dark} onToggleTheme={onToggleTheme} />
          </Protected>
        )}
      >
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="registration" element={<Guard permission="visit.register"><Registration /></Guard>} />
        <Route path="doctor-queue" element={<Guard permission="exam.read"><DoctorQueue /></Guard>} />
        <Route path="exam/:visitId" element={<Guard permission="exam.read"><Exam /></Guard>} />
        <Route path="pharmacy" element={<Guard permission="rx.read"><Pharmacy /></Guard>} />
        <Route path="lab" element={<GuardAny permissions={['lab.result.write', 'lab.order']}><Lab /></GuardAny>} />
        <Route path="cashier" element={<Guard permission="billing.read"><Cashier /></Guard>} />
        <Route path="reports" element={<Reports />} />
        <Route path="master" element={<MasterData />} />
        <Route path="users" element={<Guard permission="user.manage"><Users /></Guard>} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === 'dark')

  useEffect(() => {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])

  const toggleTheme = () => setDark((value) => !value)

  return (
    <ConfigProvider
      locale={idID}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#0f8b8d',
          colorInfo: '#0f8b8d',
          colorSuccess: '#16a34a',
          colorWarning: '#f59e0b',
          colorError: '#e11d48',
          borderRadius: 12,
          borderRadiusLG: 18,
          fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
          colorBgLayout: dark ? '#080f1c' : '#f4f7fb',
          colorBgContainer: dark ? '#101a2c' : '#ffffff',
          colorBorderSecondary: dark ? '#1e2b42' : '#e8eef6',
          boxShadowSecondary: dark
            ? '0 18px 40px rgba(0, 0, 0, 0.35)'
            : '0 18px 40px rgba(15, 45, 80, 0.08)',
        },
        components: {
          Layout: {
            siderBg: '#08111f',
            headerBg: 'transparent',
            bodyBg: dark ? '#080f1c' : '#f4f7fb',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(15, 139, 141, 0.22)',
            darkItemSelectedColor: '#5eead4',
            darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
            itemBorderRadius: 12,
          },
          Card: { borderRadiusLG: 18 },
          Button: { borderRadius: 10, controlHeight: 38, fontWeight: 600 },
          Input: { controlHeight: 40 },
          Select: { controlHeight: 40 },
          Table: {
            headerBg: dark ? '#132038' : '#f7fafc',
            headerColor: dark ? '#cbd5e1' : '#334155',
            rowHoverBg: dark ? '#132038' : '#f8fbff',
          },
          Tabs: { itemSelectedColor: '#0f8b8d', inkBarColor: '#0f8b8d' },
        },
      }}
    >
      <AntApp>
        <AuthProvider>
          <AppRoutes dark={dark} onToggleTheme={toggleTheme} />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}
