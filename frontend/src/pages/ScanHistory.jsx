import React, { useState, useEffect, useCallback } from 'react'
import {
  History, Search, ChevronLeft, ChevronRight, FileText,
  RefreshCw, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp,
  ArrowDown, X, Copy, Check, AlertTriangle, CheckCircle,
  Clock, Radio, Zap, Activity, RadioTower, ShieldCheck
} from 'lucide-react'
import api from '../services/api'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import HashDisplay from '../components/ui/HashDisplay'
import toast from 'react-hot-toast'

/* ── helpers ─────────────────────────────────────────────────── */
const STATUS_FILTERS = ['ALL', 'VERIFIED', 'MODIFIED', 'NEW', 'ERROR']
const SOURCE_FILTERS = [
  { id: 'all',       label: 'All Sources' },
  { id: 'realtime',  label: 'Real-Time'   },
  { id: 'manual',    label: 'Manual'      },
  { id: 'scheduled', label: 'Scheduled'   },
  { id: 'demo',      label: 'Demo'        },
]

const SOURCE_LABELS = {
  realtime_monitor: 'Real-Time Monitor',
  scheduled:        'Scheduled Scan',
  manual:           'Manual Verification',
  baseline:         'Baseline Creation',
  verification:     'Manual Verification',
  comparison:       'Hash Comparison',
  simulation:       'Demo Simulation',
  demo_scan:        'Demo Scan',
  auto:             'Automatic Scan',
}

function srcLabel(t) { return SOURCE_LABELS[t] || (t || 'Manual').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
function isRT(t) { return t === 'realtime_monitor' }
function isDemo(row) { return row.is_demo === 1 }

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}
function fmtSize(b) {
  if (!b) return '—'
  for (const u of ['B','KB','MB','GB']) { if (b < 1024) return `${parseFloat(b.toFixed(1))} ${u}`; b /= 1024 }
  return `${b.toFixed(1)} TB`
}
function shortHash(h, n=24) { return h ? (h.length > n ? h.slice(0,n)+'…' : h) : '—' }

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />
  return sortDir === 'asc'
    ? <ArrowUp   className="w-3 h-3 text-cyber-accent" />
    : <ArrowDown className="w-3 h-3 text-cyber-accent" />
}

/* ── Copy button ─────────────────────────────────────────────── */
function CopyBtn({ text, label = '' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast.success(label ? `${label} copied` : 'Copied')
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy} className="p-1 rounded text-cyber-muted hover:text-cyber-accent transition-colors flex-shrink-0" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-cyber-green" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

/* ── Source badge ────────────────────────────────────────────── */
function SourceBadge({ scanType, isDemoRow }) {
  if (isDemoRow) return (
    <span className="text-xs bg-cyber-border text-cyber-muted px-1.5 py-0.5 rounded font-medium">DEMO</span>
  )
  if (isRT(scanType)) return (
    <span className="flex items-center gap-1 text-xs text-teal-400 bg-teal-900 bg-opacity-20 border border-teal-800 border-opacity-30 px-1.5 py-0.5 rounded font-medium">
      <RadioTower className="w-2.5 h-2.5" /> RT
    </span>
  )
  return null
}

/* ════════════ DETAIL DRAWER ════════════════════════════════════ */
function ScanDetailDrawer({ scanId, onClose, onVerifyAgain, onViewAlert }) {
  const [detail,  setDetail]  = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!scanId) return
    setLoading(true)
    api.get(`/history/${scanId}`)
      .then(r => setDetail(r.data))
      .catch(() => toast.error('Failed to load scan details'))
      .finally(() => setLoading(false))
  }, [scanId])

  if (!scanId) return null

  const scan        = detail?.scan
  const fileInfo    = detail?.file_info
  const alert       = detail?.related_alert
  const prevVer     = detail?.prev_verified
  const baseline    = detail?.baseline_scan
  const srcLbl      = detail?.source_label || (scan ? srcLabel(scan.scan_type) : '')
  const isModified  = scan?.status === 'MODIFIED'
  const isVerified  = scan?.status === 'VERIFIED'
  const isDeleted   = scan?.status === 'DELETED'
  const isDemoScan  = scan?.is_demo === 1
  const hashMatch   = scan && scan.trusted_hash && scan.current_hash &&
                      scan.trusted_hash.toLowerCase() === scan.current_hash.toLowerCase()

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-60" />

      {/* Drawer panel */}
      <div
        className="relative w-full max-w-lg bg-cyber-surface border-l border-cyber-border
          flex flex-col h-full overflow-y-auto shadow-2xl animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyber-border sticky top-0 bg-cyber-surface z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isModified ? 'bg-red-900 bg-opacity-30' :
              isDeleted  ? 'bg-red-900 bg-opacity-50' :
              isVerified ? 'bg-green-900 bg-opacity-30' :
              'bg-cyber-border bg-opacity-50'
            }`}>
              {isModified || isDeleted
                ? <AlertTriangle className={`w-5 h-5 ${isDeleted ? 'text-red-300' : 'text-cyber-red'}`} />
                : <CheckCircle className="w-5 h-5 text-cyber-green" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-cyber-text truncate max-w-[240px]">
                {scan?.file_name || 'Scan Details'}
              </p>
              <p className="text-xs text-cyber-muted">{srcLbl}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-cyber-muted hover:text-cyber-text hover:bg-cyber-border transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <LoadingSpinner text="Loading scan details…" />
          </div>
        ) : !detail || !scan ? (
          <div className="flex-1 flex items-center justify-center py-16 text-cyber-muted text-sm">
            Scan details not found.
          </div>
        ) : (
          <div className="flex-1 px-5 py-4 space-y-5">

            {/* ── Status Banner ── */}
            <div className={`rounded-xl p-4 flex items-center gap-3 ${
              isModified ? 'bg-red-900 bg-opacity-20 border border-red-800 border-opacity-40 danger-glow' :
              isDeleted  ? 'bg-red-900 bg-opacity-30 border border-red-600 border-opacity-50' :
              'bg-green-900 bg-opacity-20 border border-green-800 border-opacity-40 verified-glow'
            }`}>
              {isModified || isDeleted
                ? <AlertTriangle className={`w-7 h-7 flex-shrink-0 ${isDeleted ? 'text-red-300' : 'text-cyber-red'}`} />
                : <CheckCircle className="w-7 h-7 text-cyber-green flex-shrink-0" />
              }
              <div>
                <p className={`font-black text-base ${
                  isModified ? 'text-cyber-red' :
                  isDeleted  ? 'text-red-300' :
                  'text-cyber-green'
                }`}>
                  {isModified  ? 'MODIFICATION DETECTED' :
                   isDeleted   ? 'FILE DELETED' :
                   isVerified  ? 'INTEGRITY VERIFIED' :
                   scan.status}
                </p>
                <p className="text-xs text-cyber-muted mt-0.5">
                  {isRT(scan.scan_type) && !isDemoScan ? 'Detected by real-time filesystem monitor' :
                   isDemoScan ? 'Demo simulation event' :
                   srcLbl}
                </p>
              </div>
              {isDemoScan && (
                <span className="ml-auto text-xs bg-cyber-border text-cyber-muted px-2 py-0.5 rounded font-medium">DEMO</span>
              )}
            </div>

            {/* ── File Information ── */}
            <section>
              <p className="text-xs font-bold text-cyber-muted uppercase tracking-wider mb-2">File Information</p>
              <div className="bg-cyber-card rounded-xl border border-cyber-border overflow-hidden">
                {[
                  { label: 'File Name',   value: scan.file_name },
                  { label: 'File Size',   value: fmtSize(scan.file_size) },
                  { label: 'Type',        value: fileInfo?.file_type || '—' },
                  { label: 'Algorithm',   value: scan.algorithm?.toUpperCase() || '—', mono: true },
                  { label: 'Monitoring',  value: fileInfo?.monitoring_status || '—' },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex items-center justify-between px-3 py-2 border-b border-cyber-border border-opacity-40 last:border-0">
                    <span className="text-xs text-cyber-muted">{label}</span>
                    <span className={`text-xs font-medium text-cyber-text ${mono ? 'font-mono' : ''}`}>{value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Scan Information ── */}
            <section>
              <p className="text-xs font-bold text-cyber-muted uppercase tracking-wider mb-2">Scan Information</p>
              <div className="bg-cyber-card rounded-xl border border-cyber-border overflow-hidden">
                {[
                  { label: 'Scan ID',     value: `#${scan.id}` },
                  { label: 'Source',      value: srcLbl },
                  { label: 'Type',        value: scan.scan_type?.replace(/_/g,' ') || '—' },
                  { label: 'Algorithm',   value: scan.algorithm?.toUpperCase() || '—', mono: true },
                  { label: 'Timestamp',   value: fmtDate(scan.scanned_at) },
                  { label: 'Result',      value: scan.status },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex items-center justify-between px-3 py-2 border-b border-cyber-border border-opacity-40 last:border-0">
                    <span className="text-xs text-cyber-muted">{label}</span>
                    <span className={`text-xs font-medium text-cyber-text ${mono ? 'font-mono' : ''}`}>{value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Hash Verification ── */}
            <section>
              <p className="text-xs font-bold text-cyber-muted uppercase tracking-wider mb-2">Hash Verification</p>
              <div className="space-y-2.5">
                {/* Trusted hash */}
                <div className="bg-cyber-card rounded-xl border border-cyber-border p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-cyber-muted uppercase tracking-wider">Trusted Hash</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-cyber-accent">{scan.algorithm?.toUpperCase()}</span>
                      {scan.trusted_hash && scan.trusted_hash !== 'N/A' && (
                        <CopyBtn text={scan.trusted_hash} label="Trusted hash" />
                      )}
                    </div>
                  </div>
                  <p className="font-mono text-xs text-cyber-green break-all leading-relaxed select-text">
                    {scan.trusted_hash || '—'}
                  </p>
                </div>

                {/* Current hash */}
                <div className={`rounded-xl border p-3 ${
                  isModified || isDeleted
                    ? 'bg-red-900 bg-opacity-10 border-red-800 border-opacity-40'
                    : 'bg-cyber-card border-cyber-border'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-cyber-muted uppercase tracking-wider">Current Hash</span>
                    {scan.current_hash && scan.current_hash !== '<deleted>' && (
                      <CopyBtn text={scan.current_hash} label="Current hash" />
                    )}
                  </div>
                  <p className={`font-mono text-xs break-all leading-relaxed select-text ${
                    isModified || isDeleted ? 'text-cyber-red' : 'text-cyber-green'
                  }`}>
                    {scan.current_hash || '—'}
                  </p>
                </div>

                {/* Match result */}
                {scan.trusted_hash && scan.current_hash && scan.current_hash !== '<deleted>' && (
                  <div className={`rounded-lg p-3 flex items-center gap-2 ${
                    hashMatch
                      ? 'bg-green-900 bg-opacity-15 border border-green-800 border-opacity-30'
                      : 'bg-red-900 bg-opacity-15 border border-red-800 border-opacity-30'
                  }`}>
                    {hashMatch
                      ? <CheckCircle className="w-4 h-4 text-cyber-green flex-shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-cyber-red flex-shrink-0" />
                    }
                    <div>
                      <p className={`text-xs font-bold ${hashMatch ? 'text-cyber-green' : 'text-cyber-red'}`}>
                        {hashMatch ? '✓ INTEGRITY VERIFIED' : '⚠ MODIFICATION DETECTED'}
                      </p>
                      <p className="text-xs text-cyber-muted mt-0.5">
                        {hashMatch
                          ? 'Hash match — no content difference detected.'
                          : 'Hash mismatch — file content has changed since the trusted baseline was created.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Change Analysis ── */}
            {(isModified || isDeleted) && (
              <section>
                <p className="text-xs font-bold text-cyber-muted uppercase tracking-wider mb-2">Change Analysis</p>
                <div className="rounded-xl bg-red-900 bg-opacity-10 border border-red-800 border-opacity-30 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {prevVer && (
                      <>
                        <div className="bg-cyber-surface rounded-lg p-2.5">
                          <p className="text-cyber-muted mb-1">Previous Verified</p>
                          <p className="text-cyber-text font-medium">{fmtDate(prevVer.scanned_at)}</p>
                        </div>
                        <div className="bg-cyber-surface rounded-lg p-2.5">
                          <p className="text-cyber-muted mb-1">Previous Size</p>
                          <p className="text-cyber-text font-medium">{fmtSize(prevVer.file_size)}</p>
                        </div>
                      </>
                    )}
                    <div className="bg-cyber-surface rounded-lg p-2.5">
                      <p className="text-cyber-muted mb-1">Current Size</p>
                      <p className={`font-medium ${
                        prevVer && prevVer.file_size !== scan.file_size ? 'text-cyber-red' : 'text-cyber-text'
                      }`}>{fmtSize(scan.file_size)}</p>
                    </div>
                    <div className="bg-cyber-surface rounded-lg p-2.5">
                      <p className="text-cyber-muted mb-1">Detection Time</p>
                      <p className="text-cyber-text font-medium">{fmtDate(scan.scanned_at)}</p>
                    </div>
                  </div>

                  {isRT(scan.scan_type) && !isDemoScan && (
                    <div className="rounded-lg bg-teal-900 bg-opacity-15 border border-teal-800 border-opacity-30 p-3 flex items-start gap-2">
                      <RadioTower className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-teal-400">REAL-TIME DETECTION</p>
                        <p className="text-xs text-cyber-muted mt-0.5 leading-relaxed">
                          File modification was detected by the real-time filesystem monitor.
                          Hash mismatch confirms the byte content changed. This system records
                          what changed — it does not identify who changed the file or why.
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-cyber-muted leading-relaxed">
                    Hash mismatch confirms byte content differs from the trusted baseline.
                    Review access logs and compare the current file against a known-good backup
                    to investigate the cause of the change.
                  </p>
                </div>
              </section>
            )}

            {/* ── Detection Timeline ── */}
            {(baseline || prevVer || scan) && (
              <section>
                <p className="text-xs font-bold text-cyber-muted uppercase tracking-wider mb-2">Detection Timeline</p>
                <div className="space-y-0">
                  {[
                    baseline  && { dot: 'bg-cyber-accent', label: 'Baseline Created',            time: baseline.scanned_at },
                    prevVer   && { dot: 'bg-cyber-green',  label: 'Last Successful Verification', time: prevVer.scanned_at },
                    isModified && { dot: 'bg-cyber-red',   label: 'Modification Detected',        time: scan.scanned_at },
                    isDeleted  && { dot: 'bg-red-400',     label: 'File Deletion Detected',       time: scan.scanned_at },
                    isVerified && { dot: 'bg-cyber-green', label: 'Integrity Verified',           time: scan.scanned_at },
                    alert     && { dot: 'bg-cyber-red',    label: 'Security Alert Created',       time: alert.created_at },
                  ].filter(Boolean).map((evt, i, arr) => (
                    <div key={i} className="flex items-start gap-3 relative">
                      {/* Vertical line */}
                      {i < arr.length - 1 && (
                        <div className="absolute left-[7px] top-5 bottom-0 w-px bg-cyber-border" />
                      )}
                      <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-1 ${evt.dot}`} />
                      <div className="pb-4 min-w-0">
                        <p className="text-xs font-semibold text-cyber-text">{evt.label}</p>
                        <p className="text-xs text-cyber-muted">{fmtDate(evt.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Related Alert ── */}
            {alert && (
              <section>
                <p className="text-xs font-bold text-cyber-muted uppercase tracking-wider mb-2">Related Alert</p>
                <div className="bg-cyber-card rounded-xl border border-red-800 border-opacity-30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`badge text-xs uppercase ${
                      alert.severity === 'critical' ? 'bg-red-900 bg-opacity-40 text-red-300 border border-red-700 border-opacity-50' :
                      alert.severity === 'high'     ? 'status-modified' :
                      alert.severity === 'medium'   ? 'status-error' : 'status-new'
                    }`}>{alert.severity?.toUpperCase()}</span>
                    <span className={`text-xs capitalize font-medium ${
                      alert.status === 'unread' ? 'text-cyber-red' : 'text-cyber-green'
                    }`}>{alert.status}</span>
                  </div>
                  <p className="text-xs text-cyber-muted leading-relaxed line-clamp-3">{alert.message}</p>
                  {onViewAlert && alert.id && (
                    <button
                      onClick={() => onViewAlert(alert.id)}
                      className="mt-2 text-xs text-cyber-accent hover:underline flex items-center gap-1"
                    >
                      View alert →
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* ── Actions ── */}
            <section>
              <p className="text-xs font-bold text-cyber-muted uppercase tracking-wider mb-2">Actions</p>
              <div className="flex flex-wrap gap-2">
                {scan.trusted_hash && scan.trusted_hash !== 'N/A' && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(scan.trusted_hash); toast.success('Trusted hash copied') }}
                    className="btn-ghost text-xs py-1.5 px-3"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Trusted Hash
                  </button>
                )}
                {scan.current_hash && scan.current_hash !== '<deleted>' && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(scan.current_hash); toast.success('Current hash copied') }}
                    className="btn-ghost text-xs py-1.5 px-3"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Current Hash
                  </button>
                )}
                {onVerifyAgain && scan.file_id && !isDemoScan && (
                  <button onClick={() => onVerifyAgain(scan.file_id)} className="btn-secondary text-xs py-1.5 px-3">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verify Again
                  </button>
                )}
              </div>
            </section>

          </div>
        )}

        {/* Drawer footer */}
        <div className="px-5 py-4 border-t border-cyber-border">
          <button onClick={onClose} className="btn-ghost text-sm py-2 px-4 w-full justify-center">
            <X className="w-4 h-4" /> Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════ MAIN PAGE ═════════════════════════════════════════ */
export default function ScanHistory() {
  const [history,      setHistory]      = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [totalPages,   setTotalPages]   = useState(1)
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [search,       setSearch]       = useState('')
  const [searchInput,  setSearchInput]  = useState('')
  const [sortCol,      setSortCol]      = useState('scanned_at')
  const [sortDir,      setSortDir]      = useState('desc')
  const [detailId,     setDetailId]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page, per_page: 15,
        status:   statusFilter,
        source:   sourceFilter,
        search,
        sort_col: sortCol,
        sort_dir: sortDir,
      })
      const r = await api.get(`/history?${params}`)
      setHistory(r.data.history    || [])
      setTotal(r.data.total        || 0)
      setTotalPages(r.data.total_pages || 1)
    } catch {
      toast.error('Failed to load scan history')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, sourceFilter, search, sortCol, sortDir])

  useEffect(() => { load() }, [load])

  const handleSearch = e => { e.preventDefault(); setSearch(searchInput); setPage(1) }
  const handleStatus = s => { setStatusFilter(s); setPage(1) }
  const handleSource = s => { setSourceFilter(s); setPage(1) }
  const handleSort   = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  const COLS = [
    { key: 'file_name',  label: 'File',        sortable: true  },
    { key: 'scan_type',  label: 'Source',      sortable: false },
    { key: 'algorithm',  label: 'Algorithm',   sortable: false },
    { key: 'status',     label: 'Status',      sortable: true  },
    { key: 'scanned_at', label: 'Date / Time', sortable: true  },
    { key: '_action',    label: '',            sortable: false },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-cyber-text">Scan History</h2>
          <p className="text-sm text-cyber-muted">{total} total record{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} className="btn-ghost text-sm py-2 px-3">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by filename…" className="input-field pl-9 text-sm" />
        </div>
        <button type="submit" className="btn-secondary text-sm py-2 px-4">
          <Search className="w-4 h-4" />
        </button>
      </form>

      {/* Status filters */}
      <div className="flex items-center gap-1 bg-cyber-surface rounded-xl p-1 overflow-x-auto">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => handleStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-all
              ${statusFilter === s
                ? 'bg-cyber-card text-cyber-accent border border-cyber-accent border-opacity-20'
                : 'text-cyber-muted hover:text-cyber-text'}`}
          >{s}</button>
        ))}
      </div>

      {/* Source filters */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-cyber-muted font-medium mr-1">Source:</span>
        {SOURCE_FILTERS.map(({ id, label }) => (
          <button key={id} onClick={() => handleSource(id)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
              sourceFilter === id
                ? 'bg-cyber-card text-cyber-accent border-cyber-accent border-opacity-30'
                : 'text-cyber-muted border-cyber-border hover:text-cyber-text hover:border-cyber-accent hover:border-opacity-20'
            }`}
          >
            {id === 'realtime' && <RadioTower className="w-3 h-3 inline mr-1" />}
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? <LoadingSpinner text="Loading history…" /> : history.length === 0 ? (
        <EmptyState
          icon={History}
          title="No scan records found"
          description={search ? `No scans match "${search}"` : 'Run your first integrity check to see results here.'}
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyber-border bg-cyber-surface">
                  {COLS.map(col => (
                    <th key={col.key}
                      className={`px-4 py-3 text-left text-xs font-semibold text-cyber-muted uppercase tracking-wider
                        ${col.sortable ? 'cursor-pointer hover:text-cyber-text select-none' : ''}`}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.sortable && <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row.id}
                    className="border-b border-cyber-border border-opacity-40 hover:bg-cyber-surface hover:bg-opacity-60 transition-colors"
                  >
                    {/* File */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyber-muted flex-shrink-0" />
                        <span className="font-medium text-cyber-text truncate max-w-[140px]">{row.file_name}</span>
                        <SourceBadge scanType={row.scan_type} isDemoRow={isDemo(row)} />
                      </div>
                    </td>
                    {/* Source */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-cyber-muted">{srcLabel(row.scan_type)}</span>
                    </td>
                    {/* Algorithm */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-cyber-accent uppercase">{row.algorithm}</span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-cyber-muted whitespace-nowrap">
                      {fmtDate(row.scanned_at)}
                    </td>
                    {/* Action */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailId(row.id)}
                        className="text-xs text-cyber-accent hover:underline font-medium whitespace-nowrap"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-cyber-border">
              <p className="text-xs text-cyber-muted">
                Page {page} of {totalPages} · {total} records
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                  className="p-1.5 rounded text-cyber-muted hover:text-cyber-text hover:bg-cyber-border disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_,i) => {
                  const p = Math.max(1, Math.min(page-2, totalPages-4)) + i
                  if (p < 1 || p > totalPages) return null
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors
                        ${page===p ? 'bg-cyber-accent text-cyber-bg' : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-border'}`}
                    >{p}</button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                  className="p-1.5 rounded text-cyber-muted hover:text-cyber-text hover:bg-cyber-border disabled:opacity-40 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail drawer */}
      {detailId && (
        <ScanDetailDrawer
          scanId={detailId}
          onClose={() => setDetailId(null)}
          onVerifyAgain={fileId => {
            setDetailId(null)
            toast('Go to Monitored Files → Verify Now to re-verify this file.', { icon: '🔍', duration: 5000 })
          }}
        />
      )}
    </div>
  )
}
