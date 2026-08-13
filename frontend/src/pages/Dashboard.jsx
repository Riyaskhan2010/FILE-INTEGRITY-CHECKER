import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, AlertTriangle, Plus, Activity, Bell,
  RefreshCw, TrendingUp, Eye, RotateCcw, Info, Lock, RadioTower
} from 'lucide-react'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

/* ─── Stat card ──────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color, onClick, tooltip }) {
  const cfg = {
    accent:  { text: 'text-cyber-accent',  border: 'border-cyber-accent',  bg: 'bg-cyber-accent'  },
    green:   { text: 'text-cyber-green',   border: 'border-green-700',     bg: 'bg-cyber-green'   },
    red:     { text: 'text-cyber-red',     border: 'border-red-800',       bg: 'bg-cyber-red'     },
    blue:    { text: 'text-cyber-blue',    border: 'border-blue-800',      bg: 'bg-cyber-blue'    },
    yellow:  { text: 'text-cyber-yellow',  border: 'border-yellow-800',    bg: 'bg-cyber-yellow'  },
    teal:    { text: 'text-teal-400',      border: 'border-teal-700',      bg: 'bg-teal-400'      },
  }[color] || { text: 'text-cyber-accent', border: 'border-cyber-accent', bg: 'bg-cyber-accent' }

  return (
    <div
      onClick={onClick}
      title={tooltip || ''}
      className={`card border-opacity-20 ${cfg.border} hover:border-opacity-50
        transition-all duration-200 ${onClick ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-cyber-muted uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
            {label}
            {tooltip && (
              <span className="inline-block w-3 h-3 rounded-full border border-cyber-muted text-cyber-muted text-center leading-none"
                style={{ fontSize: '9px', lineHeight: '12px' }}>?</span>
            )}
          </p>
          <p className={`text-3xl font-black ${cfg.text}`}>{value}</p>
          {sub && <p className="text-xs text-cyber-muted mt-1 leading-snug">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${cfg.bg} bg-opacity-10 border border-opacity-20
          ${cfg.border} flex items-center justify-center flex-shrink-0 ml-2`}>
          <Icon className={`w-5 h-5 ${cfg.text}`} />
        </div>
      </div>
    </div>
  )
}

/* ─── Security score gauge ───────────────────────────────────── */
function SecurityScore({ score, stats }) {
  const color = score >= 80 ? '#00ff88' : score >= 60 ? '#ffa502' : '#ff4757'
  const label = score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs Attention'
  const radius = 54
  const circ   = 2 * Math.PI * radius
  const dash   = (score / 100) * circ

  /* Build a compact breakdown so the user can see exactly what drives the score */
  const total    = stats?.total_files || 0
  const verified = stats?.verified    || 0
  const modified = stats?.modified    || 0
  const alerts   = stats?.unread_alerts || 0

  return (
    <div className="card flex flex-col items-center justify-center py-5">
      <p className="text-xs text-cyber-muted uppercase tracking-wider font-semibold mb-3">Security Score</p>
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#1e2d4a" strokeWidth="10" />
          <circle cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.2s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{score}</span>
          <span className="text-xs text-cyber-muted">/ 100</span>
        </div>
      </div>
      <p className="text-sm font-semibold mt-2" style={{ color }}>{label}</p>

      {/* Accurate factor description */}
      <p className="text-xs text-cyber-muted mt-2 text-center leading-relaxed max-w-[170px]">
        Based on verified files, modified files, unread alerts, and monitoring coverage.
      </p>

      {/* Compact factor breakdown */}
      {total > 0 && (
        <div className="mt-3 w-full space-y-1.5 px-1">
          {[
            { label: 'Verified',       val: verified,  of: total, color: '#00ff88', plus: true  },
            { label: 'Modified',       val: modified,  of: total, color: '#ff4757', plus: false },
            { label: 'Unread Alerts',  val: alerts,    of: null,  color: '#ff4757', plus: false },
          ].map(f => (
            <div key={f.label} className="flex items-center justify-between text-xs">
              <span className="text-cyber-muted">{f.label}</span>
              <span className="font-semibold" style={{ color: f.color }}>
                {f.of !== null ? `${f.val} / ${f.of}` : f.val}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Pie / donut chart ──────────────────────────────────────── */
const PIE_COLORS = { Verified: '#00ff88', Modified: '#ff4757', New: '#1e90ff', Other: '#64748b' }

function IntegrityPie({ stats }) {
  const data = [
    { name: 'Verified', value: stats?.verified   || 0 },
    { name: 'Modified', value: stats?.modified   || 0 },
    { name: 'New',      value: stats?.new_files  || 0 },
  ].filter(d => d.value > 0)

  if (data.length === 0) data.push({ name: 'No data', value: 1 })

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.08) return null
    const R = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + r * Math.cos(-midAngle * R)
    const y = cy + r * Math.sin(-midAngle * R)
    return (
      <text x={x} y={y} fill="#e2e8f0" textAnchor="middle" dominantBaseline="central"
        fontSize={10} fontWeight="600">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="card">
      <p className="text-sm font-semibold text-cyber-text mb-1">Integrity Status</p>
      <p className="text-xs text-cyber-muted mb-4">Distribution of all monitored files</p>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
            dataKey="value" labelLine={false} label={CustomLabel}>
            {data.map(entry => (
              <Cell key={entry.name} fill={PIE_COLORS[entry.name] || PIE_COLORS.Other} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#141c2e', border: '1px solid #1e2d4a', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#64748b' }}
            formatter={value => <span style={{ color: PIE_COLORS[value] || '#64748b' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Custom tooltip for area chart ─────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card text-xs py-2 px-3 shadow-xl min-w-[100px]">
      <p className="text-cyber-muted mb-1 font-semibold">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

/* ─── Recent Activity helpers ────────────────────────────────── */

/** Collapse consecutive rows with same file_name+status into one with a count. */
function groupActivity(rows) {
  const out = []
  for (const row of rows) {
    const prev = out[out.length - 1]
    if (prev && prev.file_name === row.file_name && prev.status === row.status && prev.is_demo === row.is_demo) {
      prev.count = (prev.count || 1) + 1
      prev.scanned_at = row.scanned_at  // keep most recent timestamp
    } else {
      out.push({ ...row, count: 1 })
    }
  }
  return out
}

/* ═══════════════ MAIN COMPONENT ═════════════════════════════════ */
export default function Dashboard() {
  const navigate  = useNavigate()
  const { user }  = useAuth()

  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [simulating,  setSimulating]  = useState(false)
  const [scanning,    setScanning]    = useState(false)
  const [resetting,   setResetting]   = useState(false)
  const [actFilter,   setActFilter]   = useState('all')
  const [svcStatus,   setSvcStatus]   = useState(null)   // V2.1 watcher status

  const load = useCallback(async () => {
    try {
      const [dashRes, svcRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/monitor/status').catch(() => ({ data: null })),
      ])
      setData(dashRes.data)
      if (svcRes.data) setSvcStatus(svcRes.data)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const simulateModification = async () => {
    setSimulating(true)
    try {
      await api.post('/demo/simulate-modification', { file_name: 'config.json' })
      toast.success('Modification simulated on config.json [DEMO]')
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Simulation failed')
    } finally { setSimulating(false) }
  }

  const runDemoScan = async () => {
    setScanning(true)
    try {
      const res  = await api.post('/demo/run-scan')
      const { results = [] } = res.data
      const mod  = results.filter(r => r.status === 'MODIFIED').length
      const ver  = results.filter(r => r.status === 'VERIFIED').length
      toast.success(`Demo scan: ${ver} verified, ${mod} modification${mod !== 1 ? 's' : ''} detected`, { duration: 5000 })
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Scan failed')
    } finally { setScanning(false) }
  }

  const resetDemo = async () => {
    setResetting(true)
    try {
      await api.post('/demo/reset')
      toast.success('Demo data reset')
      load()
    } catch {
      toast.error('Reset failed')
    } finally { setResetting(false) }
  }

  if (loading) return <LoadingSpinner size="lg" text="Loading dashboard..." />

  const { stats, recent_activity = [], chart_data = [] } = data || {}

  /* ── Filter + group recent activity ── */
  let actRows = recent_activity
  if (actFilter === 'real') actRows = actRows.filter(r => r.is_demo !== 1)
  if (actFilter === 'demo') actRows = actRows.filter(r => r.is_demo === 1)
  const filteredActivity = groupActivity(actRows).slice(0, 8)

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-cyber-text">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}
          </h2>
          <p className="text-sm text-cyber-muted">File integrity monitoring overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* V2.1 watcher service badge */}
          {svcStatus !== null && (
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${
              svcStatus.service_running
                ? 'bg-green-900 bg-opacity-15 border-green-800 border-opacity-30 text-teal-400'
                : 'bg-cyber-surface border-cyber-border text-cyber-muted'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                svcStatus.service_running ? 'bg-cyber-green animate-pulse' : 'bg-cyber-muted'
              }`} />
              <RadioTower className="w-3.5 h-3.5" />
              {svcStatus.service_running
                ? `Watcher · ${svcStatus.watched_files} file${svcStatus.watched_files !== 1 ? 's' : ''}`
                : 'Watcher Offline'
              }
            </div>
          )}
          <button onClick={load} className="btn-ghost text-sm py-2 px-3">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={() => navigate('/integrity-check')} className="btn-primary text-sm py-2 px-4">
            <ShieldCheck className="w-4 h-4" /> New Check
          </button>
        </div>
      </div>

      {/* ── Stat cards row 1 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ShieldCheck} label="Total Files" color="accent"
          value={stats?.total_files ?? 0}
          onClick={() => navigate('/monitored-files')}
        />
        <StatCard
          icon={ShieldCheck} label="Integrity Verified" color="green"
          value={stats?.verified ?? 0}
          onClick={() => navigate('/history')}
        />
        <StatCard
          icon={AlertTriangle} label="Modified" color="red"
          value={stats?.modified ?? 0}
          onClick={() => navigate('/alerts')}
        />
        <StatCard
          icon={Plus} label="New Files" color="blue"
          value={stats?.new_files ?? 0}
        />
      </div>

      {/* ── Stat cards row 2 ── */}
      {/*
        Change 1: "Active Monitoring" renamed to "Protected Files".
        The value is stats.active_monitoring = COUNT of monitored_files WHERE monitoring_status='active'.
        It represents files currently under active monitoring — i.e. "protected" files.
        Tooltip clarifies this so there is no ambiguity.
      */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Lock} label="Protected Files" color="teal"
          value={stats?.active_monitoring ?? 0}
          sub="Active monitoring on"
          tooltip="Files with monitoring_status = active — currently being watched for changes"
          onClick={() => navigate('/monitored-files')}
        />
        <StatCard
          icon={Bell} label="Unread Alerts" color="red"
          value={stats?.unread_alerts ?? 0}
          onClick={() => navigate('/alerts')}
        />
        <StatCard
          icon={Activity} label="Total Scans" color="blue"
          value={stats?.total_scans ?? 0}
          onClick={() => navigate('/history')}
        />
        <StatCard
          icon={TrendingUp} label="Last Scan" color="yellow"
          value={stats?.last_scan ? 'Recent' : 'None'}
          sub={
            stats?.last_scan
              ? new Date(stats.last_scan).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : 'No scans yet'
          }
        />
      </div>

      {/* ── Score + Pie + Area chart ── */}
      {/*
        Change 2: SecurityScore now receives stats prop and shows the actual
        scoring factors (verified/total, modified count, unread alerts) as a
        mini breakdown under the gauge. The description accurately reflects
        the real backend formula.
      */}
      <div className="grid lg:grid-cols-3 gap-4">
        <SecurityScore score={stats?.security_score ?? 85} stats={stats} />
        <IntegrityPie stats={stats} />

        <div className="card">
          <p className="text-sm font-semibold text-cyber-text mb-1">7-Day Scan Activity</p>
          <p className="text-xs text-cyber-muted mb-4">Scans run per day this week</p>
          <ResponsiveContainer width="100%" height={162}>
            <AreaChart data={chart_data} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00ff88" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00ff88" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ff4757" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ff4757" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#64748b' }} />
              <Area type="monotone" dataKey="verified" stroke="#00ff88" fill="url(#gV)" strokeWidth={2} name="Verified" />
              <Area type="monotone" dataKey="modified" stroke="#ff4757" fill="url(#gM)" strokeWidth={2} name="Modified" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent activity + Demo controls ── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* ── Recent Activity ── (Changes 3 + 4) */}
        <div className="card lg:col-span-2">
          {/* Header + filter tabs */}
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <p className="text-sm font-semibold text-cyber-text">Recent Activity</p>
            <div className="flex items-center gap-2">
              {/* Change 4: All / Real / Demo filter */}
              <div className="flex items-center gap-0.5 bg-cyber-bg rounded-lg p-0.5">
                {[
                  { id: 'all',  label: 'All'  },
                  { id: 'real', label: 'Real' },
                  { id: 'demo', label: 'Demo' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setActFilter(id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all
                      ${actFilter === id
                        ? 'bg-cyber-card text-cyber-accent border border-cyber-accent border-opacity-20'
                        : 'text-cyber-muted hover:text-cyber-text'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={() => navigate('/history')} className="text-xs text-cyber-accent hover:underline whitespace-nowrap">
                View all →
              </button>
            </div>
          </div>

          {/* Activity rows */}
          {filteredActivity.length > 0 ? (
            <div className="space-y-0.5">
              {filteredActivity.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-cyber-border border-opacity-30 last:border-0
                    hover:bg-cyber-surface hover:bg-opacity-40 px-2 rounded-lg -mx-2 transition-colors cursor-pointer"
                  onClick={() => navigate('/history')}
                >
                  {/* Left: dot + name + demo badge */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      item.status === 'VERIFIED' ? 'bg-cyber-green' :
                      item.status === 'MODIFIED' ? 'bg-cyber-red'   :
                      item.status === 'NEW'      ? 'bg-cyber-blue'  : 'bg-cyber-yellow'
                    }`} />
                    <span className="text-sm text-cyber-text truncate max-w-[150px]">{item.file_name}</span>
                    {item.is_demo === 1 && (
                      <span className="text-xs bg-cyber-border text-cyber-muted px-1.5 py-0.5 rounded flex-shrink-0">DEMO</span>
                    )}
                    {/* V2.1: real-time source badge */}
                    {item.scan_type === 'realtime_monitor' && item.is_demo !== 1 && (
                      <span className="flex items-center gap-0.5 text-xs text-teal-400 bg-teal-900 bg-opacity-20 border border-teal-800 border-opacity-30 px-1.5 py-0.5 rounded flex-shrink-0">
                        <RadioTower className="w-2.5 h-2.5" /> RT
                      </span>
                    )}
                    {/* Change 3: collapsed repeat count badge */}
                    {item.count > 1 && (
                      <span className="text-xs text-cyber-muted bg-cyber-surface border border-cyber-border
                        px-1.5 py-0.5 rounded-full flex-shrink-0 font-mono">
                        ×{item.count}
                      </span>
                    )}
                  </div>

                  {/* Right: status badge + time */}
                  <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
                    <StatusBadge status={item.status} showIcon={false} />
                    <span className="text-xs text-cyber-muted hidden sm:block whitespace-nowrap">
                      {item.scanned_at
                        ? new Date(item.scanned_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-cyber-muted text-sm">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {actFilter === 'real' ? 'No real file activity yet — run your first integrity check.' :
               actFilter === 'demo' ? 'No demo activity. Use Run Demo Scan or Simulate Modification.' :
               'No activity yet — run your first integrity check.'}
            </div>
          )}
        </div>

        {/* Demo controls + quick actions */}
        <div className="space-y-4">
          {/* Demo mode panel */}
          <div className="card border-cyber-accent border-opacity-20">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-cyber-accent animate-pulse" />
              <p className="text-sm font-semibold text-cyber-text">Demo Mode</p>
            </div>
            <p className="text-xs text-cyber-muted mb-4 leading-relaxed">
              Simulate real-world scenarios with pre-loaded demo data. All events are labeled{' '}
              <span className="font-medium text-cyber-muted">[DEMO]</span> and isolated from real files.
            </p>
            <div className="space-y-2">
              <button onClick={runDemoScan} disabled={scanning}
                className="btn-primary text-xs py-2 px-3 w-full justify-center">
                {scanning
                  ? <><span className="w-3 h-3 border border-cyber-bg border-t-transparent rounded-full animate-spin" /> Scanning...</>
                  : <><ShieldCheck className="w-3.5 h-3.5" /> Run Demo Scan</>}
              </button>
              <button onClick={simulateModification} disabled={simulating}
                className="btn-secondary text-xs py-2 px-3 w-full justify-center">
                {simulating
                  ? <><span className="w-3 h-3 border border-cyber-muted border-t-transparent rounded-full animate-spin" /> Simulating...</>
                  : <><AlertTriangle className="w-3.5 h-3.5 text-cyber-red" /> Simulate Modification</>}
              </button>
              <button onClick={resetDemo} disabled={resetting}
                className="btn-ghost text-xs py-2 px-3 w-full justify-center">
                {resetting
                  ? <><span className="w-3 h-3 border border-cyber-muted border-t-transparent rounded-full animate-spin" /> Resetting...</>
                  : <><RotateCcw className="w-3.5 h-3.5" /> Reset Demo Data</>}
              </button>
            </div>
          </div>

          {/* ── Quick Actions (Change 5: removed duplicate Upload & Check File) ── */}
          <div className="card">
            <p className="text-sm font-semibold text-cyber-text mb-3">Quick Actions</p>
            <div className="space-y-1">
              {[
                { label: 'View Monitored Files',  path: '/monitored-files',  Icon: Eye         },
                { label: 'Compare a Hash',        path: '/hash-comparison',  Icon: Activity    },
                { label: 'Security Alerts',       path: '/alerts',           Icon: Bell        },
                { label: 'Generate Report',       path: '/reports',          Icon: TrendingUp  },
              ].map(({ label, path, Icon }) => (
                <button key={path} onClick={() => navigate(path)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-cyber-muted
                    hover:text-cyber-text hover:bg-cyber-border hover:bg-opacity-40 transition-colors text-left">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Recommended Actions (based on real stats) ── */}
          <div className="card border-cyber-accent border-opacity-10">
            <p className="text-sm font-semibold text-cyber-text mb-3">Recommended Actions</p>
            <div className="space-y-2">
              {(() => {
                const s = stats || {}
                const actions = []

                if ((s.modified || 0) > 0)
                  actions.push({
                    icon: AlertTriangle,
                    color: 'text-cyber-red',
                    bg:    'bg-red-900 bg-opacity-20',
                    text:  `Review ${s.modified} modified file${s.modified > 1 ? 's' : ''}`,
                    path:  '/monitored-files',
                  })

                if ((s.unread_alerts || 0) > 0)
                  actions.push({
                    icon: Bell,
                    color: 'text-cyber-yellow',
                    bg:    'bg-yellow-900 bg-opacity-20',
                    text:  `Review ${s.unread_alerts} unread alert${s.unread_alerts > 1 ? 's' : ''}`,
                    path:  '/alerts',
                  })

                const unprotected = (s.total_files || 0) - (s.active_monitoring || 0)
                if (unprotected > 0)
                  actions.push({
                    icon: Lock,
                    color: 'text-cyber-blue',
                    bg:    'bg-blue-900 bg-opacity-20',
                    text:  `Enable monitoring on ${unprotected} unprotected file${unprotected > 1 ? 's' : ''}`,
                    path:  '/monitored-files',
                  })

                if (actions.length === 0)
                  actions.push({
                    icon: ShieldCheck,
                    color: 'text-cyber-green',
                    bg:    'bg-green-900 bg-opacity-20',
                    text:  'All monitored files are currently healthy',
                    path:  null,
                  })

                return actions.map(({ icon: Icon, color, bg, text, path }) => (
                  <div key={text}
                    onClick={path ? () => navigate(path) : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${bg}
                      ${path ? 'cursor-pointer hover:brightness-110 transition-all' : ''}`}
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                    <span className={`text-xs font-medium ${color}`}>{text}</span>
                    {path && <span className={`ml-auto text-xs ${color} opacity-60`}>→</span>}
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 px-1">
            <Info className="w-3.5 h-3.5 text-cyber-muted flex-shrink-0 mt-0.5" />
            <p className="text-xs text-cyber-muted leading-relaxed">
              This is a file integrity monitoring system — not antivirus software.
              Hash mismatch indicates content change but does not identify the cause or attacker.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
