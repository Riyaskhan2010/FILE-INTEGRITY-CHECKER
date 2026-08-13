import React, { useState, useEffect } from 'react'
import {
  ShieldCheck, AlertTriangle, CheckCircle,
  Hash, Save, Info, ArrowRight, Copy, Check
} from 'lucide-react'
import api from '../services/api'
import FileDropzone from '../components/ui/FileDropzone'
import HashDisplay from '../components/ui/HashDisplay'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

/* ── constants ───────────────────────────────────────────────── */
const ALGORITHMS = [
  { value: 'sha256',   label: 'SHA-256',           secure: true,  bits: '256-bit' },
  { value: 'sha512',   label: 'SHA-512',           secure: true,  bits: '512-bit' },
  { value: 'sha3_256', label: 'SHA-3 256',         secure: true,  bits: '256-bit' },
  { value: 'sha3_512', label: 'SHA-3 512',         secure: true,  bits: '512-bit' },
  { value: 'md5',      label: 'MD5 (Legacy Only)', secure: false, bits: '128-bit' },
]

const TABS = [
  { id: 'hash',   label: 'Generate Hash',   icon: Hash       },
  { id: 'save',   label: 'Save Baseline',   icon: Save       },
  { id: 'verify', label: 'Verify File',     icon: ShieldCheck },
]

function formatSize(b) {
  if (!b) return '0 B'
  for (const u of ['B','KB','MB','GB']) { if (b < 1024) return `${b.toFixed(1)} ${u}`; b /= 1024 }
  return `${b.toFixed(1)} TB`
}

/* ── small copy button ───────────────────────────────────────── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true); toast.success('Copied'); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="p-1 rounded text-cyber-muted hover:text-cyber-accent transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-cyber-green" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

/* ── hash result row ─────────────────────────────────────────── */
function HashRow({ label, value, secure = true, legacy = false }) {
  if (!value) return null
  return (
    <div className={`rounded-lg p-3 border ${legacy ? 'border-red-800 border-opacity-30 bg-red-900 bg-opacity-5' : 'border-cyber-border bg-cyber-surface'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-cyber-muted uppercase tracking-wider">{label}</span>
          {legacy && <span className="text-xs text-cyber-red bg-red-900 bg-opacity-20 px-1.5 py-0.5 rounded">Legacy — Not Secure</span>}
          {!legacy && <span className="text-xs text-cyber-green bg-green-900 bg-opacity-20 px-1.5 py-0.5 rounded">Recommended</span>}
        </div>
        <CopyBtn text={value} />
      </div>
      <p className="font-mono text-xs text-cyber-accent break-all leading-relaxed">{value}</p>
    </div>
  )
}

/* ── change analysis panel ───────────────────────────────────── */
function ChangeAnalysis({ result }) {
  if (!result || result.verified) return null
  const sizeChanged = result.original_size !== result.current_size
  return (
    <div className="rounded-xl p-4 bg-red-900 bg-opacity-10 border border-red-800 border-opacity-40 space-y-3">
      <p className="text-xs font-bold text-cyber-red uppercase tracking-wider flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4" /> File Change Analysis
      </p>

      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Trusted side */}
        <div className="space-y-2">
          <p className="text-cyber-muted font-semibold uppercase tracking-wider text-xs">Trusted Version</p>
          <div className="bg-cyber-surface rounded-lg p-2.5">
            <p className="text-cyber-muted mb-0.5">Size</p>
            <p className="text-cyber-green font-medium">{result.original_size_formatted}</p>
          </div>
          <div className="bg-cyber-surface rounded-lg p-2.5">
            <p className="text-cyber-muted mb-1">Hash</p>
            <p className="font-mono text-cyber-green break-all text-xs leading-relaxed">
              {result.trusted_hash?.slice(0, 32)}…
            </p>
          </div>
        </div>
        {/* Current side */}
        <div className="space-y-2">
          <p className="text-cyber-muted font-semibold uppercase tracking-wider text-xs">Current Version</p>
          <div className="bg-cyber-surface rounded-lg p-2.5">
            <p className="text-cyber-muted mb-0.5">Size</p>
            <p className={`font-medium ${sizeChanged ? 'text-cyber-red' : 'text-cyber-text'}`}>
              {result.current_size_formatted}
              {sizeChanged && <span className="text-cyber-muted ml-1">(changed)</span>}
            </p>
          </div>
          <div className="bg-cyber-surface rounded-lg p-2.5">
            <p className="text-cyber-muted mb-1">Hash</p>
            <p className="font-mono text-cyber-red break-all text-xs leading-relaxed">
              {result.current_hash?.slice(0, 32)}…
            </p>
          </div>
        </div>
      </div>

      <div className="pt-1 border-t border-red-800 border-opacity-30">
        <p className="text-xs text-cyber-muted leading-relaxed">
          <span className="text-cyber-red font-medium">Hash mismatch confirmed.</span>{' '}
          The file's byte content has changed since the baseline was created.
          This does not identify who made the change or why — only that the content differs.
        </p>
      </div>
    </div>
  )
}

/* ══ Main page ═══════════════════════════════════════════════════ */
export default function IntegrityCheck() {
  const [tab,          setTab]          = useState('hash')
  const [file,         setFile]         = useState(null)
  const [verifyFile,   setVerifyFile]   = useState(null)
  const [algorithm,    setAlgorithm]    = useState('sha256')
  const [uploading,    setUploading]    = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [verifyResult, setVerifyResult] = useState(null)
  const [monitoredFiles, setMonitoredFiles] = useState([])
  const [selectedFileId, setSelectedFileId] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [notes,     setNotes]     = useState('')
  const [saveOk,    setSaveOk]    = useState(false)

  useEffect(() => {
    api.get('/files').then(r => setMonitoredFiles(r.data.files || [])).catch(() => {})
  }, [])

  /* upload + hash a file object */
  const uploadAndHash = async (f, algo) => {
    setUploading(true)
    setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('algorithm', algo)
      const res = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadResult(res.data)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleFile = async f => { setFile(f); setSaveOk(false); await uploadAndHash(f, algorithm) }

  const handleAlgoChange = async algo => {
    setAlgorithm(algo)
    if (file && uploadResult) {
      setUploading(true)
      try {
        const res = await api.post('/files/hash', { temp_path: uploadResult.file.temp_path, algorithm: algo })
        setUploadResult(prev => ({ ...prev, selected_hash: res.data.hash, algorithm: algo }))
      } catch { toast.error('Hash recalculation failed') }
      finally { setUploading(false) }
    }
  }

  const handleSaveBaseline = async () => {
    if (!uploadResult) { toast.error('Upload a file first'); return }
    setSaving(true)
    try {
      const res = await api.post('/files/baseline', {
        temp_path: uploadResult.file.temp_path,
        original_name: uploadResult.file.original_name,
        algorithm,
        notes,
      })
      toast.success(res.data.message)
      setSaveOk(true)
      // refresh monitored files list
      const r = await api.get('/files')
      setMonitoredFiles(r.data.files || [])
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save baseline')
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async () => {
    if (!verifyFile) { toast.error('Upload the file to verify'); return }
    setVerifying(true)
    setVerifyResult(null)
    try {
      const fd = new FormData()
      fd.append('file', verifyFile)
      fd.append('algorithm', algorithm)
      const upRes = await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })

      const res = await api.post('/files/verify', {
        temp_path: upRes.data.file.temp_path,
        file_id:   selectedFileId ? parseInt(selectedFileId) : undefined,
        file_name: !selectedFileId ? verifyFile.name : undefined,
      })
      setVerifyResult(res.data)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  /* shared clear */
  const clearFile = () => { setFile(null); setUploadResult(null); setSaveOk(false) }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-cyber-surface rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${tab === id
                ? 'bg-cyber-card text-cyber-accent border border-cyber-accent border-opacity-20'
                : 'text-cyber-muted hover:text-cyber-text'}`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </div>

      {/* ════════════ TAB: HASH GENERATOR ════════════ */}
      {tab === 'hash' && (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Left — upload + algo */}
          <div className="space-y-4">
            <div className="card">
              <p className="section-title">Upload File</p>
              <p className="text-xs text-cyber-muted mb-3">
                Max 50 MB · All common file types supported · Files are never executed
              </p>
              <FileDropzone file={file} onFile={handleFile} onClear={clearFile} />
            </div>

            <div className="card">
              <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-3">Select Algorithm</p>
              <div className="space-y-2">
                {ALGORITHMS.map(algo => (
                  <label key={algo.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                      ${algorithm === algo.value
                        ? 'border-cyber-accent bg-cyber-accent bg-opacity-5'
                        : 'border-cyber-border hover:border-cyber-accent hover:border-opacity-40'}`}
                  >
                    <input type="radio" name="algo" value={algo.value}
                      checked={algorithm === algo.value}
                      onChange={() => handleAlgoChange(algo.value)}
                      className="accent-cyber-accent" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-cyber-text">{algo.label}</span>
                      <span className="text-xs text-cyber-muted ml-2">{algo.bits}</span>
                    </div>
                    {algo.secure
                      ? <CheckCircle className="w-4 h-4 text-cyber-green flex-shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-cyber-red flex-shrink-0" />
                    }
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right — results */}
          <div className="space-y-4">
            {uploading && <LoadingSpinner text="Calculating hashes…" />}

            {uploadResult && !uploading && (
              <>
                {/* File info */}
                <div className="card">
                  <p className="section-title">File Information</p>
                  <div className="grid grid-cols-2 gap-2.5 text-sm">
                    {[
                      { l: 'Name',      v: uploadResult.file.original_name },
                      { l: 'Size',      v: uploadResult.file.file_size_formatted },
                      { l: 'Type',      v: uploadResult.file.file_type },
                      { l: 'Scanned',   v: new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) },
                    ].map(({ l, v }) => (
                      <div key={l} className="bg-cyber-surface rounded-lg p-2.5">
                        <p className="text-xs text-cyber-muted mb-0.5">{l}</p>
                        <p className="text-cyber-text font-medium text-xs truncate">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hash values */}
                <div className="card">
                  <p className="section-title">Hash Values</p>
                  <div className="space-y-2.5">
                    <HashRow label="SHA-256"   value={uploadResult.hashes?.sha256} />
                    <HashRow label="SHA-512"   value={uploadResult.hashes?.sha512} />
                    {uploadResult.hashes?.sha3_256 && (
                      <HashRow label="SHA-3 256" value={uploadResult.hashes.sha3_256} />
                    )}
                    {uploadResult.hashes?.sha3_512 && (
                      <HashRow label="SHA-3 512" value={uploadResult.hashes.sha3_512} />
                    )}
                    <HashRow label="MD5" value={uploadResult.hashes?.md5} legacy />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => { setFile(file); setTab('save') }}
                    className="btn-primary flex-1 justify-center text-sm py-2.5">
                    <Save className="w-4 h-4" /> Save as Trusted File
                  </button>
                  <button onClick={() => setTab('verify')}
                    className="btn-secondary flex-1 justify-center text-sm py-2.5">
                    <ShieldCheck className="w-4 h-4" /> Verify File
                  </button>
                </div>
              </>
            )}

            {!uploadResult && !uploading && (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-cyber-border bg-opacity-50 flex items-center justify-center mb-3">
                  <Hash className="w-7 h-7 text-cyber-muted" />
                </div>
                <p className="text-cyber-text font-semibold mb-1">Ready to Hash</p>
                <p className="text-cyber-muted text-sm">Upload a file to generate its cryptographic fingerprint</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════ TAB: SAVE BASELINE ════════════ */}
      {tab === 'save' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="card">
              <p className="section-title">Upload File to Baseline</p>
              <FileDropzone file={file} onFile={handleFile} onClear={clearFile} />
            </div>

            <div className="card">
              <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-2">Algorithm</p>
              <select value={algorithm} onChange={e => handleAlgoChange(e.target.value)} className="input-field text-sm">
                {ALGORITHMS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>

            <div className="card">
              <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-2">
                Notes <span className="font-normal text-cyber-muted">(optional)</span>
              </p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="input-field resize-none h-20 text-sm"
                placeholder="e.g. Production config as of 12-Aug-2026…" />
            </div>

            <button onClick={handleSaveBaseline} disabled={!uploadResult || saving}
              className="btn-primary w-full justify-center py-3">
              {saving
                ? <><span className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save as Trusted Baseline</>
              }
            </button>
          </div>

          {/* Right — preview / success */}
          <div className="space-y-4">
            {saveOk && (
              <div className="card border-green-700 border-opacity-50 verified-glow animate-scale-in">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle className="w-6 h-6 text-cyber-green" />
                  <p className="text-cyber-green font-bold">Trusted Baseline Created</p>
                </div>
                <p className="text-xs text-cyber-muted leading-relaxed">
                  This file can now be verified against its saved fingerprint. Any future version that
                  produces a different hash will be flagged as modified.
                </p>
                <button onClick={() => setTab('verify')} className="btn-primary text-sm mt-3 w-full justify-center">
                  <ArrowRight className="w-4 h-4" /> Verify This File Now
                </button>
              </div>
            )}

            {uploadResult && !saveOk ? (
              <div className="card">
                <p className="section-title">Baseline Preview</p>
                <div className="space-y-3">
                  <div className="bg-cyber-surface rounded-lg p-3">
                    <p className="text-xs text-cyber-muted mb-0.5">File</p>
                    <p className="text-sm text-cyber-text font-medium">{uploadResult.file.original_name}</p>
                    <p className="text-xs text-cyber-muted mt-0.5">{uploadResult.file.file_size_formatted}</p>
                  </div>
                  <HashDisplay
                    label={`Trusted Hash (${algorithm.toUpperCase()})`}
                    hash={uploadResult.selected_hash || uploadResult.hashes?.[algorithm] || uploadResult.hashes?.sha256}
                    algorithm={algorithm}
                    highlight="green"
                  />
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-cyber-accent bg-opacity-5 border border-cyber-accent border-opacity-20">
                    <Info className="w-4 h-4 text-cyber-accent flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-cyber-muted leading-relaxed">
                      The hash above will be stored as the trusted reference. Re-upload this file later
                      to compare — a different hash means the content has changed.
                    </p>
                  </div>
                </div>
              </div>
            ) : !uploadResult && !saveOk && (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <Save className="w-10 h-10 text-cyber-muted mb-3" />
                <p className="text-cyber-muted text-sm">Upload a file to create its trusted baseline</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════ TAB: VERIFY FILE ════════════ */}
      {tab === 'verify' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="card">
              <p className="section-title">Select Trusted Baseline</p>
              <select value={selectedFileId} onChange={e => {
                setSelectedFileId(e.target.value)
                setVerifyResult(null)
                if (e.target.value) {
                  const sel = monitoredFiles.find(f => String(f.id) === e.target.value)
                  if (sel?.algorithm) setAlgorithm(sel.algorithm)
                }
              }} className="input-field text-sm">
                <option value="">— Match by filename automatically —</option>
                {monitoredFiles.filter(f => !f.is_demo).map(f => (
                  <option key={f.id} value={f.id}>
                    {f.file_name} · {f.algorithm?.toUpperCase()}
                  </option>
                ))}
              </select>
              <p className="text-xs text-cyber-muted mt-2">
                Pick the saved baseline to verify against, or leave blank to match by filename.
                The algorithm is set automatically from the baseline.
              </p>
            </div>

            <div className="card">
              <p className="section-title">Upload Current Version</p>
              <p className="text-xs text-cyber-muted mb-3">
                Upload the file as it exists now — the system compares its hash against the trusted baseline.
              </p>
              <FileDropzone
                file={verifyFile}
                onFile={f => { setVerifyFile(f); setVerifyResult(null) }}
                onClear={() => { setVerifyFile(null); setVerifyResult(null) }}
              />
            </div>

            <div className="card py-3 px-4 flex items-center justify-between">
              <span className="text-xs text-cyber-muted">Algorithm (from baseline)</span>
              <span className="text-xs font-mono font-semibold text-cyber-accent uppercase">{algorithm}</span>
            </div>

            <button onClick={handleVerify} disabled={!verifyFile || verifying}
              className="btn-primary w-full justify-center py-3">
              {verifying
                ? <><span className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin" /> Verifying…</>
                : <><ShieldCheck className="w-4 h-4" /> Verify Integrity</>
              }
            </button>
          </div>

          {/* Result panel */}
          <div className="space-y-4">
            {verifyResult ? (
              <div className={`card animate-scale-in space-y-4
                ${verifyResult.verified
                  ? 'border-green-700 border-opacity-50 verified-glow'
                  : 'border-red-800 border-opacity-50 danger-glow'}`}
              >
                {/* Big status */}
                <div className={`flex items-center gap-3 p-4 rounded-xl
                  ${verifyResult.verified ? 'bg-green-900 bg-opacity-20' : 'bg-red-900 bg-opacity-20'}`}>
                  {verifyResult.verified
                    ? <CheckCircle className="w-8 h-8 text-cyber-green flex-shrink-0" />
                    : <AlertTriangle className="w-8 h-8 text-cyber-red flex-shrink-0" />
                  }
                  <div>
                    <p className={`font-black text-lg ${verifyResult.verified ? 'text-cyber-green' : 'text-cyber-red'}`}>
                      {verifyResult.status_label}
                    </p>
                    <p className="text-xs text-cyber-muted">{verifyResult.file_name}</p>
                  </div>
                </div>

                {/* Hash comparison */}
                <HashDisplay label="Trusted Hash"  hash={verifyResult.trusted_hash}  algorithm={verifyResult.algorithm} highlight="green" />
                <HashDisplay label="Current Hash"  hash={verifyResult.current_hash}  algorithm={verifyResult.algorithm} highlight={verifyResult.verified ? 'green' : 'red'} />

                {/* Size comparison */}
                {verifyResult.original_size !== undefined && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-cyber-surface rounded-lg p-3">
                      <p className="text-cyber-muted mb-1">Original Size</p>
                      <p className="text-cyber-text font-medium">{verifyResult.original_size_formatted}</p>
                    </div>
                    <div className="bg-cyber-surface rounded-lg p-3">
                      <p className="text-cyber-muted mb-1">Current Size</p>
                      <p className={`font-medium ${verifyResult.original_size !== verifyResult.current_size ? 'text-cyber-red' : 'text-cyber-text'}`}>
                        {verifyResult.current_size_formatted}
                      </p>
                    </div>
                  </div>
                )}

                {/* Change analysis panel */}
                <ChangeAnalysis result={verifyResult} />

                {verifyResult.verified && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-green-900 bg-opacity-10 border border-green-800 border-opacity-30">
                    <CheckCircle className="w-4 h-4 text-cyber-green flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-cyber-muted leading-relaxed">
                      Hashes match. The file content appears unchanged since the baseline was saved.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <ShieldCheck className="w-10 h-10 text-cyber-muted mb-3" />
                <p className="text-cyber-text font-semibold mb-1">Ready to Verify</p>
                <p className="text-cyber-muted text-sm">Upload a file and click Verify to check its integrity</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
