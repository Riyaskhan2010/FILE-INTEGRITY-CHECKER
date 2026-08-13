import React, { useState, useEffect, useCallback } from 'react'
import {
  FileText, Download, Search, RefreshCw, ChevronDown, ChevronUp, Database
} from 'lucide-react'
import api from '../services/api'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import HashDisplay from '../components/ui/HashDisplay'
import toast from 'react-hot-toast'

function fmtSize(bytes) {
  if (!bytes) return '—'
  let b = bytes
  for (const u of ['B','KB','MB','GB']) { if (b < 1024) return `${parseFloat(b.toFixed(1))} ${u}`; b /= 1024 }
  return `${b.toFixed(1)} TB`
}
function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

/* ── File row with expandable details ───────────────────────── */
function FileReportRow({ file, onPDF, onCSV, downloading }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <tr
        className="border-b border-cyber-border border-opacity-40 hover:bg-cyber-surface hover:bg-opacity-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyber-muted flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-cyber-text truncate max-w-[180px]">{file.file_name}</p>
              <p className="text-xs text-cyber-muted">{fmtSize(file.file_size)}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs font-mono text-cyber-accent uppercase">{file.algorithm}</span>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={file.last_status || 'VERIFIED'} />
        </td>
        <td className="px-4 py-3 text-xs text-cyber-muted whitespace-nowrap">
          {fmtDate(file.last_checked || file.created_at)}
        </td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPDF(file.id)}
              disabled={downloading === `pdf-${file.id}`}
              className="btn-primary text-xs py-1.5 px-2.5 gap-1"
              title="Download PDF report"
            >
              {downloading === `pdf-${file.id}`
                ? <span className="w-3 h-3 border border-cyber-bg border-t-transparent rounded-full animate-spin" />
                : <Download className="w-3.5 h-3.5" />
              }
              PDF
            </button>
            <button
              onClick={() => onCSV(file.id)}
              disabled={downloading === `csv-${file.id}`}
              className="btn-secondary text-xs py-1.5 px-2.5 gap-1"
              title="Download CSV report"
            >
              {downloading === `csv-${file.id}`
                ? <span className="w-3 h-3 border border-cyber-muted border-t-transparent rounded-full animate-spin" />
                : <Download className="w-3.5 h-3.5" />
              }
              CSV
            </button>
          </div>
        </td>
        <td className="px-4 py-3 text-cyber-muted">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-cyber-surface bg-opacity-30">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-cyber-card rounded-lg p-2.5">
                  <p className="text-cyber-muted mb-1">File Type</p>
                  <p className="text-cyber-text">{file.file_type || '—'}</p>
                </div>
                <div className="bg-cyber-card rounded-lg p-2.5">
                  <p className="text-cyber-muted mb-1">Added</p>
                  <p className="text-cyber-text">{file.created_at?.slice(0, 10) || '—'}</p>
                </div>
                <div className="bg-cyber-card rounded-lg p-2.5">
                  <p className="text-cyber-muted mb-1">Monitoring</p>
                  <p className="text-cyber-text capitalize">{file.monitoring_status || 'active'}</p>
                </div>
              </div>
              <HashDisplay label="Trusted Baseline Hash" hash={file.trusted_hash} algorithm={file.algorithm} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ── Scan row ────────────────────────────────────────────────── */
function ScanReportRow({ row, onPDF, onCSV, downloading }) {
  return (
    <tr className="border-b border-cyber-border border-opacity-40 hover:bg-cyber-surface hover:bg-opacity-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyber-muted flex-shrink-0" />
          <span className="text-sm font-medium text-cyber-text truncate max-w-[160px]">{row.file_name}</span>
          {row.is_demo === 1 && (
            <span className="text-xs bg-cyber-border text-cyber-muted px-1.5 py-0.5 rounded">DEMO</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-cyber-muted capitalize">{row.scan_type}</td>
      <td className="px-4 py-3 text-xs font-mono text-cyber-accent uppercase">{row.algorithm}</td>
      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
      <td className="px-4 py-3 text-xs text-cyber-muted whitespace-nowrap">{fmtDate(row.scanned_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onPDF(row.id)} disabled={downloading === `scan-pdf-${row.id}`}
            className="btn-primary text-xs py-1.5 px-2.5 gap-1">
            {downloading === `scan-pdf-${row.id}`
              ? <span className="w-3 h-3 border border-cyber-bg border-t-transparent rounded-full animate-spin" />
              : <Download className="w-3 h-3" />
            }
            PDF
          </button>
          <button onClick={() => onCSV(row.id)} disabled={downloading === `scan-csv-${row.id}`}
            className="btn-secondary text-xs py-1.5 px-2.5 gap-1">
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ══ Main page ═══════════════════════════════════════════════════ */
export default function Reports() {
  const [files,         setFiles]         = useState([])
  const [history,       setHistory]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [downloading,   setDownloading]   = useState(null)
  const [bulkExporting, setBulkExporting] = useState(false)
  const [search,        setSearch]        = useState('')
  const [searchInput,   setSearchInput]   = useState('')
  const [tab,           setTab]           = useState('files')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fRes, hRes] = await Promise.all([
        api.get('/files'),
        api.get('/history?per_page=50'),
      ])
      setFiles(fRes.data.files   || [])
      setHistory(hRes.data.history || [])
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ── single file report ── */
  const downloadFileReport = async (fileId, fmt) => {
    const key = `${fmt}-${fileId}`
    setDownloading(key)
    try {
      const res = await api.post('/reports/generate', { file_id: fileId, format: fmt }, { responseType: 'blob' })
      triggerDownload(res.data, fmt === 'pdf' ? 'application/pdf' : 'text/csv', `integrity_report_${fileId}.${fmt}`)
      toast.success(`${fmt.toUpperCase()} report downloaded`)
    } catch { toast.error('Report generation failed') }
    finally { setDownloading(null) }
  }

  /* ── single scan report ── */
  const downloadScanReport = async (scanId, fmt) => {
    const key = `scan-${fmt}-${scanId}`
    setDownloading(key)
    try {
      const res = await api.post('/reports/generate', { scan_id: scanId, format: fmt }, { responseType: 'blob' })
      triggerDownload(res.data, fmt === 'pdf' ? 'application/pdf' : 'text/csv', `scan_report_${scanId}.${fmt}`)
      toast.success('Report downloaded')
    } catch { toast.error('Report generation failed') }
    finally { setDownloading(null) }
  }

  /* ── bulk history CSV ── */
  const exportAllHistory = async () => {
    setBulkExporting(true)
    try {
      const res = await api.get('/reports/history-csv', { responseType: 'blob' })
      triggerDownload(res.data, 'text/csv', 'scan_history_full.csv')
      toast.success('Full scan history exported')
    } catch { toast.error('Export failed') }
    finally { setBulkExporting(false) }
  }

  const triggerDownload = (data, mime, filename) => {
    const url = window.URL.createObjectURL(new Blob([data], { type: mime }))
    const a   = document.createElement('a')
    a.href     = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  const filteredFiles   = files.filter(f => f.file_name.toLowerCase().includes(search.toLowerCase()))
  const filteredHistory = history.filter(h => h.file_name.toLowerCase().includes(search.toLowerCase()))

  const handleSearch = e => { e.preventDefault(); setSearch(searchInput) }

  if (loading) return <LoadingSpinner size="lg" text="Loading reports…" />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-cyber-text">Integrity Reports</h2>
          <p className="text-sm text-cyber-muted">Generate and export PDF/CSV reports for your files and scans.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} className="btn-ghost text-sm py-2 px-3">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={exportAllHistory}
            disabled={bulkExporting || history.length === 0}
            className="btn-secondary text-sm py-2 px-4"
            title="Export all scan history as a single CSV file"
          >
            {bulkExporting
              ? <><span className="w-4 h-4 border border-cyber-muted border-t-transparent rounded-full animate-spin" /> Exporting…</>
              : <><Database className="w-4 h-4" /> Export All History (CSV)</>
            }
          </button>
        </div>
      </div>

      {/* Bulk export explanation */}
      <div className="card border-cyber-accent border-opacity-10 bg-cyber-accent bg-opacity-5 py-3">
        <div className="flex items-start gap-2">
          <Database className="w-4 h-4 text-cyber-accent flex-shrink-0 mt-0.5" />
          <p className="text-xs text-cyber-muted leading-relaxed">
            <span className="text-cyber-accent font-medium">Bulk Export:</span>{' '}
            Use "Export All History (CSV)" to download every scan record as a single spreadsheet.
            Use the per-file/per-scan buttons for individual PDF or CSV reports.
          </p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-muted" />
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Filter by filename…" className="input-field pl-9 text-sm" />
        </div>
        <button type="submit" className="btn-secondary text-sm py-2 px-4">
          <Search className="w-4 h-4" />
        </button>
      </form>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-cyber-surface rounded-xl p-1 w-fit">
        <button onClick={() => setTab('files')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
            ${tab === 'files' ? 'bg-cyber-card text-cyber-accent border border-cyber-accent border-opacity-20' : 'text-cyber-muted hover:text-cyber-text'}`}>
          By File ({files.length})
        </button>
        <button onClick={() => setTab('scans')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
            ${tab === 'scans' ? 'bg-cyber-card text-cyber-accent border border-cyber-accent border-opacity-20' : 'text-cyber-muted hover:text-cyber-text'}`}>
          By Scan ({history.length})
        </button>
      </div>

      {/* ── Files tab ── */}
      {tab === 'files' && (
        filteredFiles.length === 0 ? (
          <EmptyState icon={FileText} title="No monitored files"
            description="Add files to monitoring to generate integrity reports." />
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-cyber-border">
              <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wider">
                {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''} · click a row to see hash details
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyber-border bg-cyber-surface">
                    {['File', 'Algorithm', 'Status', 'Last Checked', 'Export', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-cyber-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map(f => (
                    <FileReportRow key={f.id} file={f}
                      onPDF={id => downloadFileReport(id, 'pdf')}
                      onCSV={id => downloadFileReport(id, 'csv')}
                      downloading={downloading}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Scans tab ── */}
      {tab === 'scans' && (
        filteredHistory.length === 0 ? (
          <EmptyState icon={FileText} title="No scan history"
            description="Run integrity checks to generate scan reports." />
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyber-border bg-cyber-surface">
                    {['File', 'Type', 'Algorithm', 'Status', 'Date', 'Export'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-cyber-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(row => (
                    <ScanReportRow key={row.id} row={row}
                      onPDF={id => downloadScanReport(id, 'pdf')}
                      onCSV={id => downloadScanReport(id, 'csv')}
                      downloading={downloading}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
