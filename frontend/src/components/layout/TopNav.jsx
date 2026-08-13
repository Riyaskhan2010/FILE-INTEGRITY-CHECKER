import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Bell, ShieldCheck, Fingerprint } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

const PAGE_TITLES = {
  '/dashboard':       'Dashboard',
  '/integrity-check': 'Integrity Check',
  '/monitored-files': 'Monitored Files',
  '/hash-comparison': 'Hash Comparison',
  '/history':         'Scan History',
  '/alerts':          'Security Alerts',
  '/reports':         'Reports',
  '/settings':        'Settings',
  '/developer':       'Developer Profile',
}

export default function TopNav({ onMenuClick }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  useEffect(() => {
    api.get('/alerts').then(res => {
      const count = res.data.alerts?.filter(a => a.status === 'unread').length || 0
      setUnreadAlerts(count)
    }).catch(() => {})
  }, [pathname])

  return (
    <header className="sticky top-0 z-10 bg-cyber-surface border-b border-cyber-border px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-cyber-muted hover:text-cyber-text p-1"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-cyber-text">
            {PAGE_TITLES[pathname] || 'File Integrity Checker'}
          </h1>
          <p className="text-xs text-cyber-muted hidden sm:block">
            Cybersecurity File Monitoring & Tamper Detection
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Security indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-900 bg-opacity-20 border border-green-800 border-opacity-30">
          <Fingerprint className="w-3.5 h-3.5 text-cyber-green" />
          <span className="text-xs text-cyber-green font-medium">Protected</span>
        </div>

        {/* Alerts bell */}
        <button
          onClick={() => navigate('/alerts')}
          className="relative p-2 rounded-lg text-cyber-muted hover:text-cyber-text hover:bg-cyber-border hover:bg-opacity-50 transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadAlerts > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-cyber-red rounded-full text-xs text-white flex items-center justify-center font-bold">
              {unreadAlerts > 9 ? '9+' : unreadAlerts}
            </span>
          )}
        </button>

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-cyber-accent bg-opacity-20 border border-cyber-accent border-opacity-30 flex items-center justify-center">
          <span className="text-cyber-accent text-xs font-bold">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
      </div>
    </header>
  )
}
