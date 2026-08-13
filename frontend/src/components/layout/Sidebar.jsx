import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, LayoutDashboard, Eye, GitCompare,
  History, Bell, FileText, Settings, LogOut, X, User, Fingerprint
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard'       },
  { to: '/integrity-check', icon: ShieldCheck,     label: 'Integrity Check' },
  { to: '/monitored-files', icon: Eye,             label: 'Monitored Files' },
  { to: '/hash-comparison', icon: GitCompare,      label: 'Hash Comparison' },
  { to: '/history',         icon: History,         label: 'Scan History'    },
  { to: '/alerts',          icon: Bell,            label: 'Security Alerts' },
  { to: '/reports',         icon: FileText,        label: 'Reports'         },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return (
    <aside className={`
      fixed top-0 left-0 h-full w-64 bg-cyber-surface border-r border-cyber-border
      flex flex-col z-30 transition-transform duration-300
      ${open ? 'translate-x-0' : '-translate-x-full'}
      lg:translate-x-0
    `}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-cyber-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-30 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-cyber-accent" />
          </div>
          <div>
            <p className="text-sm font-bold text-cyber-text tracking-wide">FILE INTEGRITY</p>
            <p className="text-xs text-cyber-muted">Checker v1.0</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden text-cyber-muted hover:text-cyber-text">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-200 group
              ${isActive
                ? 'bg-cyber-accent bg-opacity-10 text-cyber-accent border border-cyber-accent border-opacity-20'
                : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-border hover:bg-opacity-40'
              }
            `}
          >
            <Icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-cyber-border space-y-1">
        {/* Settings link */}
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            transition-all duration-200
            ${isActive
              ? 'bg-cyber-accent bg-opacity-10 text-cyber-accent border border-cyber-accent border-opacity-20'
              : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-border hover:bg-opacity-40'
            }
          `}
        >
          <Settings style={{ width: '18px', height: '18px' }} />
          Settings
        </NavLink>

        {/* Developer profile link */}
        <NavLink
          to="/developer"
          onClick={onClose}
          className={({ isActive }) => `
            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            transition-all duration-200
            ${isActive
              ? 'bg-cyber-accent bg-opacity-10 text-cyber-accent border border-cyber-accent border-opacity-20'
              : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-border hover:bg-opacity-40'
            }
          `}
        >
          <User style={{ width: '18px', height: '18px' }} />
          Developer
        </NavLink>
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          <div className="w-8 h-8 rounded-full bg-cyber-accent bg-opacity-20 border border-cyber-accent border-opacity-30 flex items-center justify-center flex-shrink-0">
            <span className="text-cyber-accent text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-cyber-text truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-cyber-muted truncate">{user?.email || ''}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                     text-cyber-muted hover:text-cyber-red hover:bg-red-900 hover:bg-opacity-10
                     transition-all duration-200"
        >
          <LogOut style={{ width: '18px', height: '18px' }} />
          Logout
        </button>
      </div>
    </aside>
  )
}
