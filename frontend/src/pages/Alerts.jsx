import React, { useState, useEffect, useCallback } from 'react'
import {
  Bell, AlertTriangle, CheckCircle, Trash2, RefreshCw,
  X, ShieldOff, ChevronDown, ChevronUp, Info
} from 'lucide-react'
import api from '../services/api'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import toast from 'react-hot-toast'

/* ── helpers ─────────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

/* ── severity config ─────────────────────────────────────────── */
const SEV = {
  critical: {
    border:  'border-red-600',
    badge:   'bg-red-900 bg-opacity-40 text-red-300 border border-red-700 border-opacity-50',
    icon:    'bg-red-900 bg-opacity-40',
    text:    'text-red-400',
    glow:    'danger-glow',
    label:   'CRITICAL',
  },
  high: {
    border:  'border-red-800',
    badge:   'bg-red-900 bg-opacity-30 text-cyber-red border border-red-800 border-opacity-40',
    icon:    'bg-red-900 bg-opacity-20',
    text:    'text-cyber-red',
    glow:    '',
    label:   'HIGH',
  },
  medium: {
    border:  'border-yellow-800',
    badge:   'bg-yellow-900 bg-opacity-30 text-cyber-yellow border border-yellow-800 border-opacity-40',
    icon:    'bg-yellow-900 bg-opacity-20',
    text:    'text-cyber-yellow',
    glow:    '',
    label:   'MEDIUM',
  },
  low: {
    border:  'border-blue-800',
    badge:   'bg-blue-900 bg-opacity-30 text-cyber-blue border border-blue-800 border-opacity-40',
    icon:    'bg-blue-900 bg-opacity-20',
    text:    'text-cyber-blue',
    glow:    '',
    label:   'LOW',
  },
}

const getSev = key => SEV[key?.toLowerCase()] || SEV.high

/* ── Alert card ─────────────────────────────────────────────── */
function AlertCard({ alert, onReview, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const isUnread = alert.status === 'unread'
  const isDemo   = alert.is_demo === 1
  const s        = getSev(alert.severity)

  return (
    <div className={`card transition-all duration-200
      ${isUnread ? `${s.border} border-opacity-50 ${s.glow}` : 'opacity-60 border-cyber-border'}
    `}>
      <div className="flex items-start gap-3">
        {/* Severity icon */}
        <div className={`w-10 h-10 rounded-xl ${s.icon} flex items-center justify-center flex-shrink-0`}>
          <AlertTriangle className={`w-5 h-5 ${s.text}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className={`badge text-xs ${s.badge}`}>{s.label}</span>
              {isUnread && <span className="w-2 h-2 rounded-full bg-cyber-red animate-pulse flex-shrink-0" />}
              {isDemo   && <span className="badge text-xs bg-cyber-border border-cyber-border text-cyber-muted">DEMO</span>}
            </div>
            <span className="text-xs text-cyber-muted whitespace-nowrap flex-shrink-0">{timeAgo(alert.created_at)}</span>
          </div>

          {/* Title */}
          <p className="text-sm font-semibold text-cyber-text mt-1.5">
            {alert.alert_type === 'MODIFICATION_DETECTED' ? '🚨 File Modification Detected' : alert.alert_type}
          </p>

          {/* File name */}
          <p className="text-xs text-cyber-muted mt-0.5">
            File: <span className="text-cyber-text font-medium">{alert.file_name}</span>
          </p>

          {/* Detected time */}
          <p className="text-xs text-cyber-muted mt-0.5">
            Detected: <span className="text-cyber-text">{formatDateTime(alert.created_at)}</span>
          </p>

          {/* Message preview */}
          <p className="text-xs text-cyber-muted mt-2 leading-relaxed line-clamp-2">{alert.message}</p>

          {/* Expand button */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-cyber-accent hover:underline"
          >
            {expanded ? <><ChevronUp className="w-3 h-3" /> Hide details</> : <><ChevronDown className="w-3 h-3" /> View details</>}
          </button>

          {/* Expanded: file change analysis */}
          {expanded && (
            <div className="mt-3 space-y-3 animate-fade-in">
              <div className={`rounded-lg p-3 border ${s.border} border-opacity-30 bg-cyber-surface`}>
                <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-2">
                  Alert Details
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-cyber-muted">Severity</p>
                    <p className={`font-semibold ${s.text}`}>{s.label}</p>
                  </div>
                  <div>
                    <p className="text-cyber-muted">Status</p>
                    <p className="text-cyber-text capitalize font-semibold">{alert.status}</p>
                  </div>
                  <div>
                    <p className="text-cyber-muted">Alert Type</p>
                    <p className="text-cyber-text">{alert.alert_type}</p>
                  </div>
                  <div>
                    <p className="text-cyber-muted">Alert ID</p>
                    <p className="text-cyber-text font-mono">#{alert.id}</p>
                  </div>
                </div>
              </div>

              <div className={`rounded-lg p-3 border ${
                alert.severity === 'critical' || alert.severity === 'high'
                  ? 'border-red-800 border-opacity-30 bg-red-900 bg-opacity-5'
                  : 'border-yellow-800 border-opacity-30 bg-yellow-900 bg-opacity-5'
              }`}>
                <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> What does this mean?
                </p>
                <p className="text-xs text-cyber-muted leading-relaxed">
                  A hash mismatch was detected on <span className="text-cyber-text font-medium">{alert.file_name}</span>.
                  This confirms the file's byte content has changed since the trusted baseline was created.
                  Hash comparison detects <em>that</em> content changed — it does not identify who changed it or why.
                  Investigate the file and its access history through your system logs.
                </p>
              </div>

              <div className="rounded-lg p-3 border border-cyber-border bg-cyber-surface text-xs">
                <p className="text-cyber-muted font-semibold uppercase tracking-wider mb-1.5">Recommended Actions</p>
                <ul className="space-y-1 text-cyber-muted">
                  {[
                    'Compare the current file with a known-good backup',
                    'Check system access logs for unauthorised activity',
                    'Verify whether the change was an authorised update',
                    'Re-create the baseline after confirming the new version is trusted',
                  ].map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-cyber-accent mt-0.5">·</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {isUnread && (
              <button onClick={() => onReview(alert.id)}
                className="btn-secondary text-xs py-1.5 px-3">
                <CheckCircle className="w-3.5 h-3.5" /> Mark Reviewed
              </button>
            )}
            <button onClick={() => onDelete(alert.id)}
              className="btn-ghost text-xs py-1.5 px-3 hover:text-cyber-red hover:bg-red-900 hover:bg-opacity-10">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══ Main page ═══════════════════════════════════════════════════ */
export default function Alerts() {
  const [alerts,  setAlerts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/alerts')
      setAlerts(r.data.alerts || [])
    } catch {
      toast.error('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleReview = async id => {
    try {
      await api.post(`/alerts/${id}/review`)
      toast.success('Alert marked as reviewed')
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'reviewed' } : a))
    } catch { toast.error('Action failed') }
  }

  const handleDelete = async id => {
    try {
      await api.delete(`/alerts/${id}`)
      toast.success('Alert deleted')
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch { toast.error('Delete failed') }
  }

  const handleClearAll = async () => {
    if (!window.confirm('Delete all alerts? This cannot be undone.')) return
    try {
      await api.delete('/alerts/clear-all')
      toast.success('All alerts cleared')
      setAlerts([])
    } catch { toast.error('Clear failed') }
  }

  const unreadCount    = alerts.filter(a => a.status === 'unread').length
  const criticalCount  = alerts.filter(a => a.severity === 'critical' && a.status === 'unread').length

  const filtered =
    filter === 'unread'   ? alerts.filter(a => a.status === 'unread') :
    filter === 'reviewed' ? alerts.filter(a => a.status === 'reviewed') :
    filter === 'critical' ? alerts.filter(a => a.severity === 'critical') :
    alerts

  if (loading) return <LoadingSpinner size="lg" text="Loading alerts…" />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-cyber-text">Security Alerts</h2>
          <p className="text-sm text-cyber-muted">
            {unreadCount > 0
              ? <span className="text-cyber-red font-medium">{unreadCount} unread alert{unreadCount > 1 ? 's' : ''}</span>
              : 'All alerts reviewed'
            }
            {alerts.length > 0 && <span className="text-cyber-muted"> · {alerts.length} total</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost text-sm py-2 px-3">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {alerts.length > 0 && (
            <button onClick={handleClearAll} className="btn-danger text-sm py-2 px-4">
              <X className="w-4 h-4" /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Critical banner */}
      {criticalCount > 0 && (
        <div className="card border-red-600 border-opacity-60 bg-red-900 bg-opacity-10 danger-glow py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-900 bg-opacity-40 flex items-center justify-center flex-shrink-0">
              <ShieldOff className="w-5 h-5 text-red-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-300">
                {criticalCount} CRITICAL Alert{criticalCount > 1 ? 's' : ''} — Immediate Action Required
              </p>
              <p className="text-xs text-cyber-muted">
                Critical-severity files (config, database, scripts) have been modified. Investigate immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Unread banner (non-critical) */}
      {unreadCount > 0 && criticalCount === 0 && (
        <div className="card border-cyber-red border-opacity-30 bg-red-900 bg-opacity-5 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-cyber-red flex-shrink-0" />
            <p className="text-sm text-cyber-red font-medium">
              {unreadCount} unresolved security alert{unreadCount > 1 ? 's' : ''} — review and investigate.
            </p>
          </div>
        </div>
      )}

      {/* Severity legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-cyber-muted">Severity:</span>
        {[
          { key: 'critical', label: 'Critical', color: 'text-red-300' },
          { key: 'high',     label: 'High',     color: 'text-cyber-red' },
          { key: 'medium',   label: 'Medium',   color: 'text-cyber-yellow' },
          { key: 'low',      label: 'Low',      color: 'text-cyber-blue' },
        ].map(({ key, label, color }) => {
          const count = alerts.filter(a => a.severity === key).length
          if (count === 0) return null
          return (
            <span key={key} className={`text-xs font-medium ${color}`}>
              {label}: {count}
            </span>
          )
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-cyber-surface rounded-xl p-1 w-fit overflow-x-auto">
        {[
          { id: 'all',      label: `All (${alerts.length})` },
          { id: 'unread',   label: `Unread (${unreadCount})` },
          { id: 'critical', label: `Critical (${alerts.filter(a => a.severity === 'critical').length})` },
          { id: 'reviewed', label: `Reviewed (${alerts.filter(a => a.status === 'reviewed').length})` },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${filter === id
                ? 'bg-cyber-card text-cyber-accent border border-cyber-accent border-opacity-20'
                : 'text-cyber-muted hover:text-cyber-text'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? 'No unread alerts' : 'No alerts found'}
          description={
            filter === 'unread'
              ? 'All alerts have been reviewed. Your monitored files look good.'
              : 'File integrity alerts appear here automatically when modifications are detected.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(alert => (
            <AlertCard key={alert.id} alert={alert} onReview={handleReview} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
