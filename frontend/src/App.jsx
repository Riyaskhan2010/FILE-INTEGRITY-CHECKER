import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

import LandingPage    from './pages/LandingPage'
import LoginPage      from './pages/LoginPage'
import RegisterPage   from './pages/RegisterPage'
import AppLayout      from './components/layout/AppLayout'
import Dashboard      from './pages/Dashboard'
import IntegrityCheck from './pages/IntegrityCheck'
import MonitoredFiles from './pages/MonitoredFiles'
import HashComparison from './pages/HashComparison'
import ScanHistory    from './pages/ScanHistory'
import Alerts         from './pages/Alerts'
import Reports        from './pages/Reports'
import Settings       from './pages/Settings'
import Developer      from './pages/Developer'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-cyber-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-cyber-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-cyber-muted text-sm">Loading…</span>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/developer" element={<Developer />} />

      {/* /signin and /login are the same page */}
      <Route path="/login"   element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signin"  element={<PublicRoute><LoginPage /></PublicRoute>} />

      {/* /register and /signup are the same page */}
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/signup"   element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Protected app shell */}
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="dashboard"       element={<Dashboard />} />
        <Route path="integrity-check" element={<IntegrityCheck />} />
        <Route path="monitored-files" element={<MonitoredFiles />} />
        <Route path="hash-comparison" element={<HashComparison />} />
        <Route path="history"         element={<ScanHistory />} />
        <Route path="alerts"          element={<Alerts />} />
        <Route path="reports"         element={<Reports />} />
        <Route path="settings"        element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#141c2e',
              color: '#e2e8f0',
              border: '1px solid #1e2d4a',
              borderRadius: '10px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#00ff88', secondary: '#141c2e' } },
            error:   { iconTheme: { primary: '#ff4757', secondary: '#141c2e' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
