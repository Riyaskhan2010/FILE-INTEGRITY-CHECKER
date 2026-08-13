import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, Fingerprint, User, Mail, Lock, Eye, EyeOff, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    const { name, email, password, confirm } = form
    if (!name || !email || !password || !confirm) { toast.error('Please fill in all fields'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }

    setLoading(true)
    try {
      await register(name, email, password)
      toast.success('Account created! Demo data loaded.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div className="min-h-screen bg-cyber-bg flex items-center justify-center px-4 py-8">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyber-accent opacity-5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-30 items-center justify-center mb-4">
            <Fingerprint className="w-7 h-7 text-cyber-accent" />
          </div>
          <h1 className="text-2xl font-bold text-cyber-text">Create account</h1>
          <p className="text-cyber-muted text-sm mt-1">Start monitoring your files today</p>
        </div>

        <div className="card cyber-glow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input type="text" value={form.name} onChange={set('name')} className="input-field pl-10" placeholder="John Doe" autoComplete="name" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input type="email" value={form.email} onChange={set('email')} className="input-field pl-10" placeholder="you@example.com" autoComplete="email" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password} onChange={set('password')}
                  className="input-field pl-10 pr-10"
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-muted hover:text-cyber-text">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.confirm} onChange={set('confirm')}
                  className="input-field pl-10"
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                />
              </div>
              {form.confirm && form.password !== form.confirm && (
                <p className="text-cyber-red text-xs mt-1">Passwords do not match</p>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-sm font-semibold mt-1">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin" /> Creating account...</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Create Account</>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-cyber-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-cyber-accent hover:underline font-medium">Sign in</Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-cyber-muted mt-6">
          <Link to="/" className="hover:text-cyber-accent transition-colors">← Back to home</Link>
        </p>
      </div>
    </div>
  )
}
