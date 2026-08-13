import React, { useState, useEffect } from 'react'
import { User, Lock, ShieldCheck, Bell, LogOut, Save } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [profile,  setProfile]  = useState(null)
  const [pwForm,   setPwForm]   = useState({ current: '', next: '', confirm: '' })
  const [showPw,   setShowPw]   = useState(false)
  const [saving,   setSaving]   = useState(false)

  // Fetch full profile (includes created_at)
  useEffect(() => {
    api.get('/auth/me').then(r => setProfile(r.data.user)).catch(() => {})
  }, [])

  const displayUser = profile || user

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const handleChangePw = async e => {
    e.preventDefault()
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      toast.error('Fill in all password fields'); return
    }
    if (pwForm.next !== pwForm.confirm) {
      toast.error('New passwords do not match'); return
    }
    if (pwForm.next.length < 8) {
      toast.error('Password must be at least 8 characters'); return
    }
    setSaving(true)
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current,
        new_password:     pwForm.next,
      })
      toast.success('Password updated successfully')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (e) {
      toast.error(e.response?.data?.error || 'Password change failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-cyber-text">Settings</h2>
        <p className="text-sm text-cyber-muted">Manage your account and application preferences.</p>
      </div>

      {/* ── Account info ── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20 flex items-center justify-center">
            <User className="w-4 h-4 text-cyber-accent" />
          </div>
          <p className="text-sm font-semibold text-cyber-text">Account</p>
        </div>
        <div className="space-y-3">
          <div className="bg-cyber-surface rounded-lg p-3 text-sm">
            <p className="text-xs text-cyber-muted mb-0.5">Full Name</p>
            <p className="text-cyber-text font-medium">{displayUser?.name || '—'}</p>
          </div>
          <div className="bg-cyber-surface rounded-lg p-3 text-sm">
            <p className="text-xs text-cyber-muted mb-0.5">Email Address</p>
            <p className="text-cyber-text font-medium">{displayUser?.email || '—'}</p>
          </div>
          <div className="bg-cyber-surface rounded-lg p-3 text-sm">
            <p className="text-xs text-cyber-muted mb-0.5">Member Since</p>
            <p className="text-cyber-text font-medium">
              {displayUser?.created_at
                ? new Date(displayUser.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Change password ── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20 flex items-center justify-center">
            <Lock className="w-4 h-4 text-cyber-accent" />
          </div>
          <p className="text-sm font-semibold text-cyber-text">Change Password</p>
        </div>
        <form onSubmit={handleChangePw} className="space-y-3">
          {[
            { key: 'current', label: 'Current Password',  auto: 'current-password' },
            { key: 'next',    label: 'New Password',       auto: 'new-password' },
            { key: 'confirm', label: 'Confirm New Password',auto: 'new-password' },
          ].map(({ key, label, auto }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-1.5">{label}</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={pwForm[key]}
                onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                className="input-field text-sm"
                placeholder="••••••••"
                autoComplete={auto}
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input id="showpw" type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} className="accent-cyber-accent" />
            <label htmlFor="showpw" className="text-xs text-cyber-muted cursor-pointer">Show passwords</label>
          </div>
          <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-5">
            {saving
              ? <><span className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Update Password</>
            }
          </button>
        </form>
      </div>

      {/* ── Security info ── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-cyber-accent" />
          </div>
          <p className="text-sm font-semibold text-cyber-text">Security Information</p>
        </div>
        <div className="space-y-2 text-xs text-cyber-muted">
          {[
            'Passwords are hashed with bcrypt (12 rounds) — never stored in plain text.',
            'Authentication uses JWT tokens with a 24-hour expiry.',
            'All file uploads are sanitised and treated as untrusted data.',
            'Uploaded files are never executed by the server.',
            'Each user can only access their own files, history, and alerts.',
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <ShieldCheck className="w-3 h-3 text-cyber-green flex-shrink-0 mt-0.5" />
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* ── Notifications placeholder ── */}
      <div className="card opacity-60">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-cyber-border flex items-center justify-center">
            <Bell className="w-4 h-4 text-cyber-muted" />
          </div>
          <p className="text-sm font-semibold text-cyber-text">Notifications</p>
          <span className="text-xs text-cyber-muted bg-cyber-border px-2 py-0.5 rounded-full">Coming soon</span>
        </div>
        <p className="text-xs text-cyber-muted">
          Email notifications for integrity alerts will be available in a future update.
        </p>
      </div>

      {/* ── Logout ── */}
      <div className="card border-red-900 border-opacity-30">
        <p className="text-sm font-semibold text-cyber-text mb-3">Session</p>
        <button onClick={handleLogout} className="btn-danger text-sm py-2 px-5">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  )
}
