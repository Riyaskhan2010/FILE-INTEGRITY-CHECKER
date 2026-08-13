import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Upload, Hash, GitCompare, Bell, BarChart2,
  Lock, Eye, FileSearch, Zap, ArrowRight, CheckCircle, AlertTriangle,
  ChevronRight, ChevronDown, Server, Database, Code2, Cpu, Globe,
  ClipboardList, MonitorCheck, Fingerprint
} from 'lucide-react'

const FEATURES = [
  { icon: Upload,     title: 'Drag & Drop Upload',   desc: 'Upload files effortlessly with our intuitive drag-and-drop interface.' },
  { icon: Hash,       title: 'Cryptographic Hashing', desc: 'Generate SHA-256, SHA-512, and MD5 fingerprints for any file.' },
  { icon: ShieldCheck,title: 'Baseline Creation',     desc: 'Save a trusted baseline to establish a ground truth for your files.' },
  { icon: GitCompare, title: 'Hash Comparison',       desc: 'Compare hashes instantly to detect any file modifications.' },
  { icon: Eye,        title: 'File Monitoring',       desc: 'Monitor critical files and get alerted when changes are detected.' },
  { icon: Bell,       title: 'Security Alerts',       desc: 'Receive immediate alerts when file tampering is detected.' },
  { icon: FileSearch, title: 'Scan History',          desc: 'Maintain a complete audit trail of all integrity checks.' },
  { icon: BarChart2,  title: 'Reports & Analytics',   desc: 'Generate PDF/CSV reports for documentation and auditing.' },
]

const ALGORITHMS = [
  {
    name: 'SHA-256',
    bits: '256-bit',
    status: 'Recommended',
    statusClass: 'status-verified',
    desc: 'The gold standard for file integrity verification. Produces a 64-character hex digest. Highly collision-resistant and widely used in security protocols.',
  },
  {
    name: 'SHA-512',
    bits: '512-bit',
    status: 'Recommended',
    statusClass: 'status-verified',
    desc: 'Stronger variant offering a 128-character digest. Ideal for high-security environments and large file verification where maximum assurance is required.',
  },
  {
    name: 'MD5',
    bits: '128-bit',
    status: 'Legacy Only',
    statusClass: 'status-modified',
    desc: 'Included for legacy and reference purposes only. MD5 is cryptographically broken and should NOT be used for security-sensitive integrity verification.',
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Upload File',          desc: 'Upload the file you want to protect using drag & drop or the file browser.' },
  { step: '02', title: 'Generate Hash',         desc: 'The system calculates a cryptographic fingerprint (hash) of your file.' },
  { step: '03', title: 'Save Trusted Baseline', desc: 'Store the hash as your trusted baseline — the reference point for future checks.' },
  { step: '04', title: 'Verify Later',          desc: 'Upload the same file again later to recalculate its hash and compare against the baseline.' },
  { step: '05', title: 'Detect Changes',        desc: 'If hashes match, integrity is verified. If they differ, tampering is detected immediately.' },
]

const SECURITY_HIGHLIGHTS = [
  { emoji: '🔐', title: 'Cryptographic Hashing',  desc: 'Generate reliable cryptographic fingerprints for files using SHA-256 and SHA-512.' },
  { emoji: '🛡️', title: 'Tamper Detection',        desc: 'Detect file content changes by comparing current hashes against trusted baselines.' },
  { emoji: '📋', title: 'Audit Trail',             desc: 'Maintain a complete, timestamped history of every integrity scan.' },
  { emoji: '⚡', title: 'Instant Verification',    desc: 'Quickly compare the current version of any file against its saved baseline.' },
  { emoji: '💻', title: 'Local Processing',        desc: 'Files are processed locally without requiring external services or cloud uploads.' },
]

const TECH_STACK = [
  { icon: Code2,    label: 'React',     color: 'text-cyber-accent',  bg: 'bg-cyber-accent',  desc: 'Frontend UI' },
  { icon: Server,   label: 'Flask',     color: 'text-cyber-green',   bg: 'bg-cyber-green',   desc: 'REST API' },
  { icon: Cpu,      label: 'Python',    color: 'text-cyber-blue',    bg: 'bg-cyber-blue',    desc: 'Backend logic' },
  { icon: Database, label: 'SQLite',    color: 'text-cyber-yellow',  bg: 'bg-cyber-yellow',  desc: 'Database' },
  { icon: Hash,     label: 'Hashlib',   color: 'text-cyber-accent',  bg: 'bg-cyber-accent',  desc: 'Cryptographic hashing' },
  { icon: Globe,    label: 'REST API',  color: 'text-cyber-green',   bg: 'bg-cyber-green',   desc: 'JSON endpoints' },
]

const FAQ_ITEMS = [
  {
    q: 'What does File Integrity Checker detect?',
    a: 'It detects changes in file content by comparing the current cryptographic hash with a trusted baseline. If the hashes differ, the file content has changed.',
  },
  {
    q: 'Is File Integrity Checker an antivirus?',
    a: 'No. File Integrity Checker is an integrity monitoring and tamper detection system. It does not provide antivirus or malware scanning.',
  },
  {
    q: 'Which hashing algorithms are supported?',
    a: 'SHA-256, SHA-512, SHA-3-256, and MD5 for legacy compatibility. SHA-256 and SHA-512 are recommended for security-sensitive integrity verification.',
  },
  {
    q: 'What does a hash mismatch mean?',
    a: "A hash mismatch confirms that the file's byte content differs from the trusted baseline. It does not identify who changed the file or why — only that a change occurred.",
  },
  {
    q: 'Can the system monitor files continuously?',
    a: "Files accessible to the backend can be monitored and verified through the application's monitoring configuration. Browser-based applications cannot continuously access arbitrary files on a user's computer after the browser is closed.",
  },
  {
    q: 'Are uploaded files processed by external services?',
    a: "The application is designed for local processing and does not require external services for cryptographic hash generation. All hashing runs on the local Flask backend using Python's standard hashlib library.",
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-cyber-surface bg-opacity-95 backdrop-blur border-b border-cyber-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-30 flex items-center justify-center">
              <Fingerprint className="w-4.5 h-4.5 text-cyber-accent" style={{ width: '18px', height: '18px' }} />
            </div>
            <span className="font-bold text-sm tracking-wide text-cyber-text">FILE INTEGRITY CHECKER</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/developer')} className="btn-ghost text-sm py-2 px-4">
              Developer
            </button>
            <button onClick={() => navigate('/login')} className="btn-ghost text-sm py-2 px-4">
              Sign In
            </button>
            <button onClick={() => navigate('/register')} className="btn-primary text-sm py-2 px-4">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-6">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(#00d4ff 1px, transparent 1px), linear-gradient(90deg, #00d4ff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyber-accent opacity-5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20 mb-6">
            <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
            <span className="text-cyber-accent text-xs font-semibold tracking-wider uppercase">Cybersecurity Tool</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black mb-5 leading-tight">
            <span className="text-cyber-text">File Integrity</span>
            <br />
            <span className="text-cyber-accent">Checker</span>
          </h1>

          <p className="text-lg md:text-xl text-cyber-muted mb-3 font-medium">
            Detect File Changes. Verify Integrity. Protect Critical Data.
          </p>

          <p className="text-base text-cyber-muted mb-10 max-w-2xl mx-auto leading-relaxed">
            Monitor important files, detect unauthorized modifications, and verify file
            integrity using cryptographic hashing. Built for security professionals,
            developers, and students.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/register')}
              className="btn-primary text-base px-7 py-3 cyber-glow"
            >
              <Fingerprint className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
              Start Integrity Check
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn-secondary text-base px-7 py-3"
            >
              <BarChart2 className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
              View Dashboard
            </button>
          </div>

          {/* Quick stats */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto">
            {[
              { val: 'SHA-256/512',      label: 'Algorithms' },
              { val: '50 MB',            label: 'Max File Size' },
              { val: 'Local Processing', label: 'No External Services' },
            ].map(s => (
              <div key={s.label} className="card py-4 text-center">
                <p className="text-cyber-accent font-bold text-lg">{s.val}</p>
                <p className="text-cyber-muted text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-cyber-surface bg-opacity-40">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">How It Works</h2>
          <p className="text-cyber-muted text-center mb-12 max-w-xl mx-auto">
            A straightforward workflow built around cryptographic file fingerprinting.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="relative">
                <div className="card h-full text-center hover:border-cyber-accent hover:border-opacity-40 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-cyber-accent text-sm font-black font-mono">{step.step}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-cyber-text mb-2">{step.title}</h3>
                  <p className="text-xs text-cyber-muted leading-relaxed">{step.desc}</p>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <ChevronRight className="hidden lg:block absolute top-1/2 -right-2.5 -translate-y-1/2 w-4 h-4 text-cyber-muted z-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Result visual */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Clear Integrity Results</h2>
          <p className="text-cyber-muted text-center mb-12">
            No ambiguity — files are either verified or flagged immediately.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Verified */}
            <div className="card border-green-800 border-opacity-40 verified-glow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-900 bg-opacity-30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-cyber-green" />
                </div>
                <span className="text-cyber-green font-bold text-lg">INTEGRITY VERIFIED</span>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-xs text-cyber-muted mb-1 uppercase tracking-wider">Trusted Hash</p>
                  <p className="hash-text text-xs">a8f3c92b4d1e67f0...</p>
                </div>
                <div>
                  <p className="text-xs text-cyber-muted mb-1 uppercase tracking-wider">Current Hash</p>
                  <p className="hash-text text-xs">a8f3c92b4d1e67f0...</p>
                </div>
                <div className="pt-1 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-cyber-green" />
                  <span className="text-cyber-green text-sm font-medium">Hashes match — file unmodified</span>
                </div>
              </div>
            </div>

            {/* Modified */}
            <div className="card border-red-800 border-opacity-40 danger-glow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-900 bg-opacity-30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-cyber-red" />
                </div>
                <span className="text-cyber-red font-bold text-lg">TAMPERING DETECTED</span>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-xs text-cyber-muted mb-1 uppercase tracking-wider">Trusted Hash</p>
                  <p className="hash-text text-xs">a8f3c92b4d1e67f0...</p>
                </div>
                <div>
                  <p className="text-xs text-cyber-muted mb-1 uppercase tracking-wider">Current Hash</p>
                  <p className="hash-text text-xs text-cyber-red">71d92fa4c830be1c...</p>
                </div>
                <div className="pt-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-cyber-red" />
                  <span className="text-cyber-red text-sm font-medium">Hash mismatch — file content has changed</span>
                </div>
                <p className="text-xs text-cyber-muted mt-2 leading-relaxed">
                  Hash mismatch confirms the byte content differs. It does not identify who changed the file or why.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-cyber-surface bg-opacity-40">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Key Features</h2>
          <p className="text-cyber-muted text-center mb-12 max-w-xl mx-auto">
            Everything you need to monitor, verify, and protect your critical files.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card hover:border-cyber-accent hover:border-opacity-30 transition-all duration-200 group">
                <div className="w-10 h-10 rounded-xl bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20 flex items-center justify-center mb-3 group-hover:bg-opacity-20 transition-colors">
                  <Icon className="w-5 h-5 text-cyber-accent" />
                </div>
                <h3 className="text-sm font-semibold text-cyber-text mb-1.5">{title}</h3>
                <p className="text-xs text-cyber-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hash Algorithms */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Supported Hash Algorithms</h2>
          <p className="text-cyber-muted text-center mb-12">
            Understand the algorithms used for cryptographic file fingerprinting.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {ALGORITHMS.map(algo => (
              <div key={algo.name} className="card hover:border-cyber-accent hover:border-opacity-30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-black text-xl text-cyber-accent font-mono">{algo.name}</span>
                  <span className={`badge ${algo.statusClass} text-xs`}>{algo.status}</span>
                </div>
                <p className="text-cyber-muted text-xs mb-3 font-mono">{algo.bits} digest</p>
                <p className="text-cyber-muted text-xs leading-relaxed">{algo.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-cyber-muted mt-6 max-w-2xl mx-auto">
            Note: MD5 is included for legacy compatibility and reference only. It is cryptographically broken
            and must not be used where security matters. SHA-256 or SHA-512 are recommended for all integrity checks.
          </p>
        </div>
      </section>

      {/* ── SECURITY HIGHLIGHTS ── */}
      <section className="py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-px flex-1 bg-cyber-border" />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20">
              <Fingerprint className="w-3.5 h-3.5 text-cyber-accent" />
              <span className="text-cyber-accent text-xs font-bold tracking-widest uppercase">Security Focused</span>
            </div>
            <div className="h-px flex-1 bg-cyber-border" />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {SECURITY_HIGHLIGHTS.map(({ emoji, title, desc }) => (
              <div key={title}
                className="card py-4 text-center hover:border-cyber-accent hover:border-opacity-30 transition-all duration-200 group">
                <div className="text-2xl mb-3">{emoji}</div>
                <h3 className="text-xs font-bold text-cyber-text mb-1.5 group-hover:text-cyber-accent transition-colors">
                  {title}
                </h3>
                <p className="text-xs text-cyber-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Benefits */}
      <section className="py-20 px-6 bg-cyber-surface bg-opacity-40">        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Security Benefits</h2>
          <p className="text-cyber-muted mb-12">
            Why cryptographic file integrity monitoring matters.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {[
              { icon: Lock,      title: 'Tamper Detection',    desc: 'Instantly identify if any file has been modified, corrupted, or replaced.' },
              { icon: Eye,       title: 'Audit Trails',        desc: 'Maintain a complete, timestamped history of all integrity checks.' },
              { icon: Zap,       title: 'Rapid Response',      desc: 'Get immediate alerts when changes are detected so you can respond fast.' },
              { icon: Lock,      title: 'Trust Verification',  desc: 'Verify that files received over a network match the original source.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-cyber-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-cyber-text mb-1">{title}</h3>
                  <p className="text-xs text-cyber-muted leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECHNOLOGY STACK ── */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl md:text-2xl font-bold text-center mb-2">Built With</h2>
          <p className="text-cyber-muted text-center text-sm mb-10 max-w-xl mx-auto">
            Built as an internship project focused on practical cybersecurity, cryptographic
            file integrity verification, and tamper detection.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {TECH_STACK.map(({ icon: Icon, label, color, bg, desc }) => (
              <div key={label}
                className="card py-4 text-center hover:border-cyber-accent hover:border-opacity-30 transition-all duration-200 group">
                <div className={`w-9 h-9 rounded-xl ${bg} bg-opacity-10 border border-opacity-20 flex items-center justify-center mx-auto mb-2.5 group-hover:bg-opacity-20 transition-colors`}
                  style={{ borderColor: 'currentColor' }}>
                  <Icon className={`w-4.5 h-4.5 ${color}`} style={{ width: '18px', height: '18px' }} />
                </div>
                <p className={`text-xs font-bold ${color} mb-0.5`}>{label}</p>
                <p className="text-xs text-cyber-muted leading-tight">{desc}</p>
              </div>
            ))}
          </div>

          {/* Architecture flow */}
          <div className="card border-cyber-accent border-opacity-10 bg-cyber-accent bg-opacity-5">
            <p className="text-xs font-semibold text-cyber-muted uppercase tracking-wider mb-3 text-center">Architecture</p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              {[
                'React Frontend',
                '→',
                'Flask REST API',
                '→',
                'Python Hashlib',
                '→',
                'SQLite Database',
                '→',
                'Dashboard / Alerts / Reports',
              ].map((item, i) => (
                item === '→'
                  ? <span key={i} className="text-cyber-border font-bold">→</span>
                  : <span key={i} className="px-2.5 py-1 rounded-lg bg-cyber-card border border-cyber-border text-cyber-text font-medium">
                      {item}
                    </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 px-6 bg-cyber-surface bg-opacity-40">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl md:text-2xl font-bold text-center mb-2">Frequently Asked Questions</h2>
          <p className="text-cyber-muted text-center text-sm mb-10">
            Common questions about File Integrity Checker.
          </p>

          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openFaq === i
              return (
                <div key={i}
                  className={`card transition-all duration-200 cursor-pointer
                    ${isOpen
                      ? 'border-cyber-accent border-opacity-30 bg-cyber-accent bg-opacity-5'
                      : 'hover:border-cyber-accent hover:border-opacity-20'}`}
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-black font-mono flex-shrink-0 w-5 text-center
                        ${isOpen ? 'text-cyber-accent' : 'text-cyber-muted'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <p className={`text-sm font-semibold transition-colors
                        ${isOpen ? 'text-cyber-accent' : 'text-cyber-text'}`}>
                        {item.q}
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 flex-shrink-0 transition-transform duration-200
                        ${isOpen ? 'rotate-180 text-cyber-accent' : 'text-cyber-muted'}`}
                    />
                  </div>

                  {isOpen && (
                    <div className="mt-3 pl-8 animate-fade-in">
                      <div className="h-px bg-cyber-border mb-3" />
                      <p className="text-sm text-cyber-muted leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── DEVELOPER PROFILE ── */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-cyber-border" />
            <span className="text-xs font-bold text-cyber-muted uppercase tracking-widest px-3">Developer</span>
            <div className="h-px flex-1 bg-cyber-border" />
          </div>

          <div className="card border-cyber-accent border-opacity-10 hover:border-opacity-25 transition-colors">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Photo */}
              <div className="relative flex-shrink-0">
                <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-cyber-accent to-cyber-blue opacity-25 blur-sm" />
                <img
                  src="/profile.jpg"
                  alt="Mohamed Riyaskhan S"
                  className="relative w-20 h-24 sm:w-24 sm:h-28 rounded-xl object-cover object-top border-2 border-cyber-accent border-opacity-30"
                  draggable={false}
                />
              </div>

              {/* Details */}
              <div className="flex-1 text-center sm:text-left min-w-0">
                <p className="text-xs font-bold text-cyber-accent uppercase tracking-widest mb-1">Internship Project</p>
                <h3 className="text-lg font-black text-cyber-text mb-0.5">Mohamed Riyaskhan S</h3>
                <p className="text-sm text-cyber-muted mb-4">Cyber Security &amp; Ethical Hacking</p>
                <button
                  onClick={() => navigate('/developer')}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  <MonitorCheck className="w-3.5 h-3.5" />
                  View Full Profile
                </button>
              </div>

              {/* Project tag */}
              <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0">
                <div className="px-3 py-1.5 rounded-full bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20">
                  <span className="text-xs text-cyber-accent font-semibold">Internship Project</span>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-cyber-surface border border-cyber-border">
                  <span className="text-xs text-cyber-muted">Rathinam College</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="card border-cyber-accent border-opacity-20 cyber-glow py-12">
            <ShieldCheck className="w-12 h-12 text-cyber-accent mx-auto mb-5" />
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Start Protecting Your Files</h2>
            <p className="text-cyber-muted mb-8 leading-relaxed">
              Create a free account and begin monitoring your critical files today.
              No external services required — runs entirely on your machine.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => navigate('/register')} className="btn-primary text-base px-8 py-3 cyber-glow justify-center">
                <ShieldCheck className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
                Create Account
              </button>
              <button onClick={() => navigate('/login')} className="btn-secondary text-base px-8 py-3 justify-center">
                Sign In
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cyber-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyber-accent" />
            <span className="text-sm text-cyber-muted">File Integrity Checker — Cybersecurity File Monitoring</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/developer')}
              className="text-xs text-cyber-accent hover:underline transition-colors"
            >
              Developer Profile
            </button>
            <p className="text-xs text-cyber-muted">
              Built with React + Flask · Runs locally, no external services required
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
