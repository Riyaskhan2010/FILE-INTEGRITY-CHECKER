import React, { useState } from 'react'
import {
  GitCompare, CheckCircle, AlertTriangle, RotateCcw, Info, Hash
} from 'lucide-react'
import api from '../services/api'
import FileDropzone from '../components/ui/FileDropzone'
import HashDisplay from '../components/ui/HashDisplay'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

/* ── algorithm specs (for validation) ───────────────────────── */
const ALGORITHMS = [
  { value: 'sha256',   label: 'SHA-256',           hexLen: 64,  bits: '256-bit',  secure: true  },
  { value: 'sha512',   label: 'SHA-512',           hexLen: 128, bits: '512-bit',  secure: true  },
  { value: 'sha3_256', label: 'SHA-3 256',         hexLen: 64,  bits: '256-bit',  secure: true  },
  { value: 'sha3_512', label: 'SHA-3 512',         hexLen: 128, bits: '512-bit',  secure: true  },
  { value: 'md5',      label: 'MD5 (Legacy Only)', hexLen: 32,  bits: '128-bit',  secure: false },
]

/* ── validate a hex hash string for a given algorithm ─────── */
function validateHash(hash, algo) {
  const spec = ALGORITHMS.find(a => a.value === algo)
  if (!spec) return null
  const cleaned = hash.trim().toLowerCase()
  if (!cleaned) return { valid: false, msg: 'Please enter the expected hash.' }
  if (!/^[0-9a-f]+$/.test(cleaned))
    return { valid: false, msg: 'Hash must contain only hexadecimal characters (0-9, a-f).' }
  if (cleaned.length !== spec.hexLen)
    return {
      valid: false,
      msg: `${spec.label} hash must be exactly ${spec.hexLen} characters (${cleaned.length} entered).`
    }
  return { valid: true, msg: '' }
}

/* ══ Main component ══════════════════════════════════════════ */
export default function HashComparison() {
  const [expectedHash,  setExpectedHash]  = useState('')
  const [file,          setFile]          = useState(null)
  const [algorithm,     setAlgorithm]     = useState('sha256')
  const [result,        setResult]        = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [hashError,     setHashError]     = useState('')

  const currentSpec = ALGORITHMS.find(a => a.value === algorithm)

  /* live hash validation as user types */
  const handleHashChange = val => {
    setExpectedHash(val)
    setResult(null)
    if (!val.trim()) { setHashError(''); return }
    const v = validateHash(val, algorithm)
    setHashError(v?.valid === false ? v.msg : '')
  }

  const handleAlgoChange = algo => {
    setAlgorithm(algo)
    setResult(null)
    if (expectedHash.trim()) {
      const v = validateHash(expectedHash, algo)
      setHashError(v?.valid === false ? v.msg : '')
    }
  }

  const reset = () => {
    setExpectedHash(''); setFile(null); setResult(null); setHashError('')
  }

  const handleCompare = async () => {
    const v = validateHash(expectedHash, algorithm)
    if (!v?.valid) { toast.error(v?.msg || 'Invalid hash'); return }
    if (!file)     { toast.error('Please upload a file'); return }

    setLoading(true); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('expected_hash', expectedHash.trim())
      fd.append('algorithm', algorithm)
      const res = await api.post('/files/compare-hash', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(res.data)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const canCompare = !hashError && expectedHash.trim() && file

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-cyber-text">Hash Comparison Tool</h2>
        <p className="text-sm text-cyber-muted mt-0.5">
          Enter a known hash value and upload a file to verify they match.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* ── Input panel ── */}
        <div className="space-y-4">
          {/* Algorithm selector */}
          <div className="card">
            <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-3">Algorithm</p>
            <div className="grid grid-cols-2 gap-2">
              {ALGORITHMS.map(a => (
                <label key={a.value}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm
                    ${algorithm === a.value
                      ? 'border-cyber-accent text-cyber-text bg-cyber-accent bg-opacity-5'
                      : 'border-cyber-border text-cyber-muted hover:border-cyber-accent hover:border-opacity-40'}`}
                >
                  <input type="radio" name="cmp-algo" value={a.value}
                    checked={algorithm === a.value}
                    onChange={() => handleAlgoChange(a.value)}
                    className="accent-cyber-accent" />
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{a.label}</p>
                    <p className="text-xs text-cyber-muted">{a.bits} · {a.hexLen} chars</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Expected hash input */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wider">Expected Hash</p>
              <span className={`text-xs font-mono ${
                !expectedHash.trim()       ? 'text-cyber-muted' :
                hashError                  ? 'text-cyber-red'   :
                                             'text-cyber-green'
              }`}>
                {expectedHash.trim()
                  ? `${expectedHash.trim().replace(/\s/g,'').length} / ${currentSpec?.hexLen} chars`
                  : `${currentSpec?.hexLen} chars expected`
                }
              </span>
            </div>
            <textarea
              value={expectedHash}
              onChange={e => handleHashChange(e.target.value)}
              className={`input-field font-mono text-xs h-24 resize-none transition-colors ${
                hashError ? 'border-cyber-red focus:border-cyber-red focus:ring-cyber-red' : ''
              }`}
              placeholder={`Paste the expected ${currentSpec?.label} hash here…\nExpected length: ${currentSpec?.hexLen} hexadecimal characters`}
              spellCheck={false}
            />
            {hashError ? (
              <p className="text-cyber-red text-xs mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {hashError}
              </p>
            ) : expectedHash.trim() && !hashError ? (
              <p className="text-cyber-green text-xs mt-1.5 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Valid {currentSpec?.label} hash format
              </p>
            ) : (
              <p className="text-cyber-muted text-xs mt-1.5">
                The reference hash — what this file <em>should</em> produce.
              </p>
            )}
          </div>

          {/* File upload */}
          <div className="card">
            <p className="section-title">Upload File to Verify</p>
            <FileDropzone
              file={file}
              onFile={f => { setFile(f); setResult(null) }}
              onClear={() => { setFile(null); setResult(null) }}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCompare}
              disabled={loading || !canCompare}
              className="btn-primary flex-1 justify-center py-3"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-cyber-bg border-t-transparent rounded-full animate-spin" /> Comparing…</>
                : <><GitCompare className="w-4 h-4" /> Compare Hash</>
              }
            </button>
            <button onClick={reset} className="btn-ghost py-3 px-4" title="Reset">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Result panel ── */}
        <div className="space-y-4">
          {loading && <LoadingSpinner text="Calculating and comparing hash…" />}

          {result && !loading && (
            <div className={`card animate-scale-in space-y-4
              ${result.match
                ? 'border-green-700 border-opacity-50 verified-glow'
                : 'border-red-800 border-opacity-50 danger-glow'}`}
            >
              {/* Big result */}
              <div className={`flex items-center gap-4 p-5 rounded-xl
                ${result.match ? 'bg-green-900 bg-opacity-20' : 'bg-red-900 bg-opacity-20'}`}
              >
                {result.match
                  ? <CheckCircle className="w-10 h-10 text-cyber-green flex-shrink-0" />
                  : <AlertTriangle className="w-10 h-10 text-cyber-red flex-shrink-0" />
                }
                <div>
                  <p className={`font-black text-xl ${result.match ? 'text-cyber-green' : 'text-cyber-red'}`}>
                    {result.match ? 'HASH MATCH' : 'HASH MISMATCH'}
                  </p>
                  <p className={`text-sm mt-0.5 ${result.match ? 'text-green-400' : 'text-red-400'}`}>
                    {result.match
                      ? 'File Integrity Verified'
                      : 'Possible File Modification Detected'
                    }
                  </p>
                </div>
              </div>

              {/* Hash comparison */}
              <HashDisplay label="Expected Hash (Reference)" hash={result.expected_hash}
                algorithm={result.algorithm} highlight="green" />
              <HashDisplay label="Calculated Hash (File)"   hash={result.current_hash}
                algorithm={result.algorithm} highlight={result.match ? 'green' : 'red'} />

              {/* Meta */}
              <div className="bg-cyber-surface rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-cyber-muted">File</span>
                  <span className="text-cyber-text font-medium">{result.file_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cyber-muted">Algorithm</span>
                  <span className="text-cyber-accent font-mono font-semibold uppercase">{result.algorithm}</span>
                </div>
              </div>

              {/* Accuracy note for mismatch */}
              {!result.match && (
                <div className="rounded-lg p-3 bg-red-900 bg-opacity-10 border border-red-800 border-opacity-30 text-xs text-cyber-muted leading-relaxed">
                  <span className="text-cyber-red font-medium">Hash mismatch.</span>{' '}
                  The file's byte content does not match the expected hash. This confirms the content differs —
                  it does not identify the cause of the change.
                </div>
              )}
            </div>
          )}

          {!result && !loading && (
            <>
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-cyber-border bg-opacity-50 flex items-center justify-center mb-4">
                  <GitCompare className="w-8 h-8 text-cyber-muted" />
                </div>
                <p className="text-cyber-text font-semibold mb-2">Ready to Compare</p>
                <p className="text-cyber-muted text-sm max-w-xs">
                  Enter the expected hash, select the matching algorithm, upload the file, then click Compare.
                </p>
              </div>

              {/* Use cases */}
              <div className="card border-cyber-accent border-opacity-10">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-cyber-accent" />
                  <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wider">Common Use Cases</p>
                </div>
                <ul className="space-y-2 text-xs text-cyber-muted">
                  {[
                    'Verify a downloaded file matches the publisher\'s official SHA-256 checksum',
                    'Confirm a file transferred over the network was not corrupted in transit',
                    'Validate a backup against a previously recorded hash',
                    'Check an installer against the vendor\'s published hash before running it',
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-cyber-accent mt-0.5 flex-shrink-0">·</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
