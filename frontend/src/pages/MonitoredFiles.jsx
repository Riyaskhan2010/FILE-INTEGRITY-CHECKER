import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye, RefreshCw, Pause, Play, Trash2, CheckCircle, X,
  AlertTriangle, Clock, Plus, FileText, ShieldCheck,
  Radio, RadioTower, FolderOpen, Info, Zap, Lock
} from 'lucide-react'
import api from '../services/api'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import HashDisplay from '../components/ui/HashDisplay'
import toast from 'react-hot-toast'

/* ─── helpers ────────────────────────────────────────────────── */
function formatSize(bytes) {
  if (!bytes) return '0 B'
  let b = bytes
  for (const u of ['B', 'KB', 'MB', 'GB']) {
    if (b < 1024) return `${parseFloat(b.toFixed(1))} ${u}`
    b /= 1024
  }
  return `${b.toFixed(1)} TB`
}

function timeAgo(ts) {
  if (!ts) return 'Never'
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/* ─── Realtime monitoring panel (inside each non-demo FileCard) ─ */
function RealtimeMonitorPanel({ file, onRefresh }) {
  const [absPath,    setAbsPath]    = useState(file.abs_file_path || '')
  const [enabling,   setEnabling]   = useState(false)
  const [pausing,    setPausing]    = useState(false)
  const [resuming,   setResuming]   = useState(false)
  const [disabling,  setDisabling]  = useState(false)
  const [showInput,  setShowInput]  = useState(false)

  const isWatched   = !!file.abs_file_path && file.watcher_enabled === 1
  const isPaused    = !!file.abs_file_path && file.watcher_enabled === 0
  const isDisabled  = !file.abs_file_path

  const handleEnable = async () => {
    if (!absPath.trim()) { toast.error('Enter the full file path first'); return }
    setEnabling(true)
    try {
      await api.post(`/files/${file.id}/monitor`, { abs_path: absPath.trim() })
      toast.success('Real-time monitoring enabled')
      setShowInput(false)
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to enable monitoring')
    } finally { setEnabling(false) }
  }

  const handlePause = async () => {
    setPausing(true)
    try {
      await api.post(`/files/${file.id}/pause-monitoring`)
      toast.success('Monitoring paused')
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Pause failed')
    } finally { setPausing(false) }
  }

  const handleResume = async () => {
    setResuming(true)
    try {
      await api.post(`/files/${file.id}/resume-monitoring`)
      toast.success('Monitoring resumed')
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Resume failed')
    } finally { setResuming(false) }
  }

  const handleDisable = async () => {
    setDisabling(true)
    try {
      await api.post(`/files/${file.id}/disable-monitoring`)
      toast.success('Real-time monitoring disabled')
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Disable failed')
    } finally { setDisabling(false) }
  }

  return (
    <div className={`rounded-xl p-3 border mt-3 ${
      isWatched
        ? 'bg-green-900 bg-opacity-5 border-green-800 border-opacity-30'
        : isPaused
        ? 'bg-yellow-900 bg-opacity-5 border-yellow-800 border-opacity-20'
        : 'bg-cyber-surface border-cyber-border'
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <RadioTower className={`w-3.5 h-3.5 ${
            isWatched ? 'text-cyber-green' : isPaused ? 'text-cyber-yellow' : 'text-cyber-muted'
          }`} />
          <span className="text-xs font-bold uppercase tracking-wider text-cyber-muted">
            Real-Time Monitor
          </span>
        </div>
        {/* Status pill */}
        {isWatched && (
          <span className="flex items-center gap-1 text-xs font-semibold text-cyber-green">
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
            ACTIVE
          </span>
        )}
        {isPaused && (
          <span className="flex items-center gap-1 text-xs font-semibold text-cyber-yellow">
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-yellow" />
            PAUSED
          </span>
        )}
        {isDisabled && (
          <span className="flex items-center gap-1 text-xs text-cyber-muted">
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-muted" />
            NOT SET
          </span>
        )}
      </div>

      {/* Watched path display */}
      {file.abs_file_path && (
        <p className="text-xs text-cyber-muted font-mono truncate mb-2 leading-relaxed"
          title={file.abs_file_path}>
          {file.abs_file_path}
        </p>
      )}

      {/* Last known hash info */}
      {file.last_known_hash && (
        <div className="text-xs text-cyber-muted mb-2">
          <span className="text-cyber-muted">Last seen: </span>
          <span className={`font-mono ${
            file.last_known_hash === file.trusted_hash ? 'text-cyber-green' : 'text-cyber-red'
          }`}>
            {file.last_known_hash?.slice(0, 16)}…
          </span>
          {file.last_known_hash !== file.trusted_hash && (
            <span className="text-cyber-red ml-1 font-semibold">⚠ MISMATCH</span>
          )}
        </div>
      )}

      {/* Path input (shown when clicking Enable) */}
      {showInput && (
        <div className="mb-2 animate-fade-in">
          <label className="block text-xs text-cyber-muted mb-1">
            Full filesystem path to watch
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={absPath}
              onChange={e => setAbsPath(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEnable()}
              placeholder="e.g. C:\Users\you\documents\config.json"
              className="input-field text-xs font-mono flex-1 py-1.5"
              autoFocus
            />
            <button onClick={() => setShowInput(false)}
              className="p-1.5 rounded text-cyber-muted hover:text-cyber-red transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-cyber-muted mt-1 leading-relaxed">
            Must be an absolute path on the server machine. The file must exist.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {isDisabled && !showInput && (
          <button onClick={() => setShowInput(true)}
            className="flex items-center gap-1 text-xs text-cyber-accent bg-cyber-accent bg-opacity-10
              border border-cyber-accent border-opacity-20 px-2.5 py-1.5 rounded-lg
              hover:bg-opacity-20 transition-colors font-medium">
            <Radio className="w-3 h-3" />
            Enable Monitoring
          </button>
        )}
        {showInput && (
          <button onClick={handleEnable} disabled={enabling}
            className="flex items-center gap-1 text-xs text-cyber-bg bg-cyber-accent
              px-2.5 py-1.5 rounded-lg hover:bg-opacity-90 transition-colors font-semibold disabled:opacity-50">
            {enabling
              ? <span className="w-3 h-3 border border-cyber-bg border-t-transparent rounded-full animate-spin" />
              : <Zap className="w-3 h-3" />
            }
            Start Watching
          </button>
        )}
        {isWatched && (
          <button onClick={handlePause} disabled={pausing}
            className="flex items-center gap-1 text-xs text-cyber-yellow bg-yellow-900 bg-opacity-20
              border border-yellow-800 border-opacity-30 px-2.5 py-1.5 rounded-lg
              hover:bg-opacity-30 transition-colors disabled:opacity-50">
            {pausing
              ? <span className="w-3 h-3 border border-cyber-yellow border-t-transparent rounded-full animate-spin" />
              : <Pause className="w-3 h-3" />
            }
            Pause
          </button>
        )}
        {isPaused && (
          <button onClick={handleResume} disabled={resuming}
            className="flex items-center gap-1 text-xs text-cyber-green bg-green-900 bg-opacity-20
              border border-green-800 border-opacity-30 px-2.5 py-1.5 rounded-lg
              hover:bg-opacity-30 transition-colors disabled:opacity-50">
            {resuming
              ? <span className="w-3 h-3 border border-cyber-green border-t-transparent rounded-full animate-spin" />
              : <Play className="w-3 h-3" />
            }
            Resume
          </button>
        )}
        {(isWatched || isPaused) && (
          <button onClick={handleDisable} disabled={disabling}
            className="flex items-center gap-1 text-xs text-cyber-muted hover:text-cyber-red
              px-2 py-1.5 rounded-lg hover:bg-red-900 hover:bg-opacity-10 transition-colors disabled:opacity-50 ml-auto">
            {disabling
              ? <span className="w-3 h-3 border border-cyber-muted border-t-transparent rounded-full animate-spin" />
              : <X className="w-3 h-3" />
            }
            Disable
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── FileCard ───────────────────────────────────────────────── */
function FileCard({ file, onToggleMonitor, onDelete, onVerify, verifying, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const isDemo = file.is_demo === 1
  const lastStatus = (file.last_status || file.status || 'VERIFIED').toUpperCase()
  const lastScanType = file.last_scan_type || ''
  const isRealtimeEvent = lastScanType === 'realtime_monitor'

  return (
    <div className={`card transition-all duration-200 hover:border-opacity-40
      ${lastStatus === 'MODIFIED'
        ? 'border-red-800 border-opacity-30'
        : lastStatus === 'NEW'
        ? 'border-blue-800 border-opacity-30'
        : file.watcher_enabled === 1
        ? 'border-green-800 border-opacity-20'
        : 'border-cyber-border'}
      ${isDemo ? 'border-opacity-20' : ''}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border
            ${lastStatus === 'MODIFIED'
              ? 'bg-red-900 bg-opacity-20 border-red-800 border-opacity-30'
              : lastStatus === 'NEW'
              ? 'bg-blue-900 bg-opacity-20 border-blue-800 border-opacity-30'
              : 'bg-cyber-accent bg-opacity-10 border-cyber-accent border-opacity-20'
            }`}>
            <FileText className={`w-5 h-5 ${
              lastStatus === 'MODIFIED' ? 'text-cyber-red' :
              lastStatus === 'NEW' ? 'text-cyber-blue' : 'text-cyber-accent'
            }`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-cyber-text truncate max-w-[180px]">{file.file_name}</p>
              {isDemo && <span className="text-xs bg-cyber-border text-cyber-muted px-1.5 py-0.5 rounded font-medium">DEMO</span>}
              {/* Real-time source badge */}
              {isRealtimeEvent && !isDemo && (
                <span className="flex items-center gap-1 text-xs text-teal-400 bg-teal-900 bg-opacity-20 border border-teal-800 border-opacity-30 px-1.5 py-0.5 rounded font-medium">
                  <RadioTower className="w-2.5 h-2.5" /> REAL-TIME
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <StatusBadge status={lastStatus} />
              <span className="text-xs text-cyber-muted">{formatSize(file.file_size)}</span>
              <span className="text-xs text-cyber-muted font-mono uppercase">{file.algorithm}</span>
              <span className="text-xs text-cyber-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(file.last_checked || file.last_scan_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Monitoring status badge */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
            file.monitoring_status === 'active'
              ? 'text-cyber-green bg-green-900 bg-opacity-20 border border-green-800 border-opacity-30'
              : 'text-cyber-muted bg-cyber-border bg-opacity-40 border border-cyber-border'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              file.monitoring_status === 'active' ? 'bg-cyber-green animate-pulse' : 'bg-cyber-muted'
            }`} />
            {file.monitoring_status === 'active' ? 'Active' : 'Paused'}
          </span>
          {/* Realtime watcher indicator */}
          {!isDemo && (
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              file.watcher_enabled === 1
                ? 'text-teal-400 bg-teal-900 bg-opacity-20'
                : 'text-cyber-muted opacity-50'
            }`}>
              <RadioTower className="w-3 h-3" />
              {file.watcher_enabled === 1 ? 'Watching' : 'No watcher'}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <button
          onClick={() => onVerify(file.id, isDemo)}
          disabled={verifying === file.id}
          className="btn-primary text-xs py-1.5 px-3"
        >
          {verifying === file.id
            ? <><span className="w-3 h-3 border border-cyber-bg border-t-transparent rounded-full animate-spin" /> Verifying...</>
            : <><ShieldCheck className="w-3.5 h-3.5" /> Verify Now</>
          }
        </button>

        <button onClick={() => onToggleMonitor(file.id, file.monitoring_status)}
          className="btn-ghost text-xs py-1.5 px-3">
          {file.monitoring_status === 'active'
            ? <><Pause className="w-3.5 h-3.5" /> Pause</>
            : <><Play className="w-3.5 h-3.5" /> Resume</>
          }
        </button>

        <button onClick={() => setExpanded(v => !v)}
          className="btn-ghost text-xs py-1.5 px-3">
          <Eye className="w-3.5 h-3.5" />
          {expanded ? 'Hide' : 'Details'}
        </button>

        {!isDemo && (
          <button onClick={() => onDelete(file.id, file.file_name)}
            className="btn-danger text-xs py-1.5 px-3 ml-auto">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-cyber-border space-y-3 animate-fade-in">
          <HashDisplay label="Trusted Baseline Hash" hash={file.trusted_hash} algorithm={file.algorithm} />

          {lastStatus === 'MODIFIED' && (
            <div className="rounded-lg p-3 bg-red-900 bg-opacity-10 border border-red-800 border-opacity-30">
              <p className="text-xs font-semibold text-cyber-red uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> File Change Analysis
              </p>
              <p className="text-xs text-cyber-muted leading-relaxed">
                Hash mismatch confirms file content has changed since the baseline.
                {isRealtimeEvent && ' Detected automatically by the real-time filesystem watcher.'}
                {' '}This does not identify who changed the file or why.
              </p>
              {file.last_known_hash && file.last_known_hash !== file.trusted_hash && (
                <div className="mt-2 space-y-1.5">
                  <div>
                    <p className="text-xs text-cyber-muted mb-0.5">Trusted Hash</p>
                    <p className="hash-text text-xs text-cyber-green">{file.trusted_hash?.slice(0, 32)}…</p>
                  </div>
                  <div>
                    <p className="text-xs text-cyber-muted mb-0.5">Last Seen Hash</p>
                    <p className="hash-text text-xs text-cyber-red">{file.last_known_hash?.slice(0, 32)}…</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-cyber-surface rounded-lg p-2.5">
              <p className="text-cyber-muted mb-0.5">File Type</p>
              <p className="text-cyber-text font-medium truncate">{file.file_type || 'N/A'}</p>
            </div>
            <div className="bg-cyber-surface rounded-lg p-2.5">
              <p className="text-cyber-muted mb-0.5">Added</p>
              <p className="text-cyber-text font-medium">{file.created_at?.slice(0, 10) || 'N/A'}</p>
            </div>
            <div className="bg-cyber-surface rounded-lg p-2.5">
              <p className="text-cyber-muted mb-0.5">File Size</p>
              <p className="text-cyber-text font-medium">{formatSize(file.file_size)}</p>
            </div>
            <div className="bg-cyber-surface rounded-lg p-2.5">
              <p className="text-cyber-muted mb-0.5">Last Checked</p>
              <p className="text-cyber-text font-medium">{timeAgo(file.last_checked || file.last_scan_at)}</p>
            </div>
            {file.last_known_size != null && (
              <div className="bg-cyber-surface rounded-lg p-2.5">
                <p className="text-cyber-muted mb-0.5">Last Known Size</p>
                <p className="text-cyber-text font-medium">{formatSize(file.last_known_size)}</p>
              </div>
            )}
            {file.last_modified_at && (
              <div className="bg-cyber-surface rounded-lg p-2.5">
                <p className="text-cyber-muted mb-0.5">File Modified At</p>
                <p className="text-cyber-text font-medium">{file.last_modified_at?.slice(0,16) || 'N/A'}</p>
              </div>
            )}
          </div>

          {file.notes && (
            <div className="bg-cyber-surface rounded-lg p-2.5 text-xs">
              <p className="text-cyber-muted mb-0.5">Notes</p>
              <p className="text-cyber-text">{file.notes}</p>
            </div>
          )}

          {/* V2.1 Real-Time Monitor panel — only for real (non-demo) files */}
          {!isDemo && (
            <RealtimeMonitorPanel file={file} onRefresh={onRefresh} />
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Service status badge ───────────────────────────────────── */
function ServiceStatusBadge({ status }) {
  if (status === null) return null
  const online = status?.service_running === true
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
      online
        ? 'bg-green-900 bg-opacity-15 border-green-800 border-opacity-30 text-cyber-green'
        : 'bg-cyber-surface border-cyber-border text-cyber-muted'
    }`}>
      <div className={`w-2 h-2 rounded-full ${online ? 'bg-cyber-green animate-pulse' : 'bg-cyber-muted'}`} />
      <RadioTower className="w-3.5 h-3.5" />
      {online
        ? `Watcher Online · ${status.watched_files} file${status.watched_files !== 1 ? 's' : ''} watched`
        : 'Watcher Offline'
      }
    </div>
  )
}

/* ════════════ MAIN PAGE ═════════════════════════════════════════ */
export default function MonitoredFiles() {
  const navigate = useNavigate()
  const [files,       setFiles]       = useState([])
  const [demoFiles,   setDemoFiles]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [verifying,   setVerifying]   = useState(null)
  const [tab,         setTab]         = useState('all')
  const [svcStatus,   setSvcStatus]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [filesRes, statusRes] = await Promise.all([
        api.get('/files'),
        api.get('/monitor/status').catch(() => ({ data: null })),
      ])
      setFiles(filesRes.data.files || [])
      setDemoFiles(filesRes.data.demo_files || [])
      if (statusRes.data) setSvcStatus(statusRes.data)
    } catch {
      toast.error('Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* Poll service status every 10s so the badge updates live */
  useEffect(() => {
    const id = setInterval(() => {
      api.get('/monitor/status').then(r => setSvcStatus(r.data)).catch(() => {})
    }, 10000)
    return () => clearInterval(id)
  }, [])

  const handleToggleMonitor = async (id, status) => {
    const endpoint = status === 'active' ? '/monitor/stop' : '/monitor/start'
    try {
      await api.post(endpoint, { file_id: id })
      toast.success(status === 'active' ? 'Monitoring paused' : 'Monitoring resumed')
      load()
    } catch { toast.error('Action failed') }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove "${name}" from monitoring?`)) return
    try {
      await api.delete(`/files/${id}`)
      toast.success(`${name} removed from monitoring`)
      load()
    } catch { toast.error('Delete failed') }
  }

  const handleVerify = async (id, isDemo) => {
    setVerifying(id)
    if (isDemo) {
      try {
        await api.post('/demo/run-scan', { file_id: id })
        toast.success('Demo scan complete')
        load()
      } catch {
        toast('Demo scan: re-check from dashboard', { icon: '🔄' })
        load()
      } finally { setVerifying(null) }
      return
    }
    try {
      const r = await api.post(`/monitor/verify/${id}`)
      if (r.data.verified) toast.success('Integrity verified ✓')
      else toast.error('Modification detected! Alert created.')
      load()
    } catch (e) {
      const msg = e.response?.data?.error || 'Verification failed'
      if (msg.includes('not available')) {
        toast.error('Original file not on server. Go to Integrity Check to re-upload and verify.', { duration: 5000 })
      } else {
        toast.error(msg)
      }
    } finally { setVerifying(null) }
  }

  const allFiles = [
    ...files,
    ...demoFiles.map(d => ({
      ...d,
      is_demo:      1,
      last_status:  d.status?.toUpperCase(),
      last_scan_at: d.last_checked,
      watcher_enabled: 0,
    })),
  ]

  const filtered =
    tab === 'real' ? files :
    tab === 'demo' ? allFiles.filter(f => f.is_demo === 1) :
    allFiles

  const stats = {
    total:    allFiles.length,
    verified: allFiles.filter(f => (f.last_status || f.status || '').toUpperCase() === 'VERIFIED').length,
    modified: allFiles.filter(f => (f.last_status || f.status || '').toUpperCase() === 'MODIFIED').length,
    active:   allFiles.filter(f => f.monitoring_status === 'active').length,
    watched:  files.filter(f => f.watcher_enabled === 1).length,
  }

  if (loading) return <LoadingSpinner size="lg" text="Loading monitored files..." />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-cyber-text">Monitored Files</h2>
          <p className="text-sm text-cyber-muted">
            {allFiles.length} file{allFiles.length !== 1 ? 's' : ''} tracked ·{' '}
            <span className="text-cyber-green">{stats.active} monitoring active</span>
            {stats.watched > 0 && (
              <span className="text-teal-400"> · {stats.watched} real-time watcher{stats.watched !== 1 ? 's' : ''}</span>
            )}
            {stats.modified > 0 && (
              <span className="text-cyber-red"> · {stats.modified} modification{stats.modified > 1 ? 's' : ''} detected</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* V2.1 service status badge */}
          <ServiceStatusBadge status={svcStatus} />
          <button onClick={load} className="btn-ghost text-sm py-2 px-3">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => navigate('/integrity-check')} className="btn-primary text-sm py-2 px-4">
            <Plus className="w-4 h-4" /> Add File
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-cyber-surface rounded-xl p-1 w-fit">
        {[['all', 'All Files'], ['real', 'My Files'], ['demo', 'Demo']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
              ${tab === id
                ? 'bg-cyber-card text-cyber-accent border border-cyber-accent border-opacity-20'
                : 'text-cyber-muted hover:text-cyber-text'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: stats.total,    color: 'text-cyber-accent' },
          { label: 'Verified', value: stats.verified,  color: 'text-cyber-green' },
          { label: 'Modified', value: stats.modified,  color: 'text-cyber-red'   },
          { label: 'Active',   value: stats.active,    color: 'text-cyber-blue'  },
          { label: 'Watching', value: stats.watched,   color: 'text-teal-400'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="card py-3 text-center">
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-cyber-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Monitoring info banner */}
      <div className="card border-cyber-accent border-opacity-10 bg-cyber-accent bg-opacity-5 py-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-cyber-accent flex-shrink-0 mt-0.5" />
          <div className="text-xs text-cyber-muted leading-relaxed space-y-1">
            <p>
              <span className="text-cyber-accent font-medium">Manual verification:</span>{' '}
              Click "Verify Now" to re-check any file using its stored server copy.
            </p>
            <p>
              <span className="text-teal-400 font-medium">Real-time watching (V2.1):</span>{' '}
              Expand a file card and enter its <strong>full filesystem path</strong> in the
              Real-Time Monitor panel. The backend will watch that path continuously and
              create alerts automatically when content changes. Only works for files
              accessible to the server process.
            </p>
          </div>
        </div>
      </div>

      {/* File grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Eye}
          title="No files found"
          description={tab === 'real'
            ? 'Upload a file and save it as a trusted baseline to begin monitoring.'
            : 'No files match the current filter.'}
          action={
            tab !== 'demo' && (
              <button onClick={() => navigate('/integrity-check')} className="btn-primary text-sm">
                <Plus className="w-4 h-4" /> Add First File
              </button>
            )
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(f => (
            <FileCard
              key={`${f.is_demo ? 'd' : 'r'}-${f.id}`}
              file={f}
              onToggleMonitor={handleToggleMonitor}
              onDelete={handleDelete}
              onVerify={handleVerify}
              verifying={verifying}
              onRefresh={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
