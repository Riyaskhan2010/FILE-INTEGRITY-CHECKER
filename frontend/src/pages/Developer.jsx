import React from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, Fingerprint, Phone, Mail, Linkedin, Github,
  GraduationCap, Briefcase, ArrowLeft, ExternalLink
} from 'lucide-react'

/* ─── Profile photo ────────────────────────────────────────────
   The image is embedded as a public asset served by Vite.
   Place the file at: frontend/public/profile.jpg
   ─────────────────────────────────────────────────────────────*/
const PROFILE_IMG = '/profile.jpg'

const INFO = [
  {
    icon: Briefcase,
    label: 'Internship Role',
    value: 'Cyber Security & Ethical Hacking',
    mono: false,
  },
  {
    icon: Phone,
    label: 'Phone',
    value: '+91 9150900577',
    href: 'tel:+919150900577',
    mono: true,
  },
  {
    icon: Mail,
    label: 'Personal Email',
    value: 'mriyaskhan254@gmail.com',
    href: 'mailto:mriyaskhan254@gmail.com',
    mono: false,
  },
  {
    icon: Mail,
    label: 'College Email',
    value: 'mohamedriyaskhans.bit25@rathinam.in',
    href: 'mailto:mohamedriyaskhans.bit25@rathinam.in',
    mono: false,
  },
  {
    icon: Linkedin,
    label: 'LinkedIn',
    value: 'linkedin.com/in/mohamed-riyaskhan-s-9a5247386',
    href: 'https://www.linkedin.com/in/mohamed-riyaskhan-s-9a5247386',
    mono: false,
    external: true,
  },
  {
    icon: Github,
    label: 'GitHub',
    value: 'github.com/Riyaskhan2010',
    href: 'https://github.com/Riyaskhan2010',
    mono: false,
    external: true,
  },
]

export default function Developer() {
  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-cyber-surface border-b border-cyber-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-30 flex items-center justify-center">
            <Fingerprint className="w-4 h-4 text-cyber-accent" />
          </div>
          <span className="font-bold text-sm tracking-wide text-cyber-text">FILE INTEGRITY CHECKER</span>
        </div>
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-cyber-muted hover:text-cyber-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">

          {/* Section label */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-cyber-border" />
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-20">
              <GraduationCap className="w-4 h-4 text-cyber-accent" />
              <span className="text-cyber-accent text-xs font-semibold tracking-widest uppercase">Developer &amp; Internship</span>
            </div>
            <div className="h-px flex-1 bg-cyber-border" />
          </div>

          {/* Profile card */}
          <div className="card border-cyber-accent border-opacity-20 cyber-glow">
            <div className="flex flex-col md:flex-row gap-8 md:gap-10">

              {/* ── LEFT: Photo ── */}
              <div className="flex flex-col items-center md:items-start gap-4 flex-shrink-0">
                <div className="relative">
                  {/* Accent ring */}
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-cyber-accent via-cyber-blue to-cyber-accent opacity-30 blur-sm" />
                  <div className="relative w-48 h-56 md:w-52 md:h-60 rounded-2xl overflow-hidden border-2 border-cyber-accent border-opacity-40">
                    <img
                      src={PROFILE_IMG}
                      alt="Mohamed Riyaskhan S — Developer"
                      className="w-full h-full object-cover object-top"
                      draggable={false}
                    />
                  </div>
                  {/* Status dot */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-cyber-card bg-opacity-90 px-2 py-1 rounded-full border border-cyber-border">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
                    <span className="text-xs text-cyber-green font-medium">Active</span>
                  </div>
                </div>

                {/* Quick links below photo on mobile */}
                <div className="flex gap-3 md:hidden">
                  <a href="https://www.linkedin.com/in/mohamed-riyaskhan-s-9a5247386"
                     target="_blank" rel="noopener noreferrer"
                     className="p-2.5 rounded-xl bg-blue-900 bg-opacity-20 border border-blue-800 border-opacity-30 text-cyber-blue hover:bg-opacity-40 transition-colors">
                    <Linkedin className="w-4 h-4" />
                  </a>
                  <a href="https://github.com/Riyaskhan2010"
                     target="_blank" rel="noopener noreferrer"
                     className="p-2.5 rounded-xl bg-cyber-border bg-opacity-50 border border-cyber-border text-cyber-text hover:border-cyber-accent hover:text-cyber-accent transition-colors">
                    <Github className="w-4 h-4" />
                  </a>
                  <a href="mailto:mriyaskhan254@gmail.com"
                     className="p-2.5 rounded-xl bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-30 text-cyber-accent hover:bg-opacity-20 transition-colors">
                    <Mail className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* ── RIGHT: Info ── */}
              <div className="flex-1 min-w-0 space-y-5">
                {/* Name + title */}
                <div>
                  <p className="text-xs font-bold text-cyber-accent uppercase tracking-widest mb-1">Developer</p>
                  <h1 className="text-2xl md:text-3xl font-black text-cyber-text leading-tight">
                    Mohamed Riyaskhan S
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-0.5 w-8 bg-cyber-accent rounded-full" />
                    <p className="text-sm text-cyber-muted font-medium">
                      Cyber Security &amp; Ethical Hacking
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-cyber-border" />

                {/* Info grid */}
                <div className="grid sm:grid-cols-2 gap-3">
                  {INFO.map(({ icon: Icon, label, value, href, mono, external }) => (
                    <div
                      key={label}
                      className="bg-cyber-surface rounded-xl p-3.5 border border-cyber-border hover:border-cyber-accent hover:border-opacity-30 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-cyber-accent" />
                        </div>
                        <span className="text-xs font-semibold text-cyber-muted uppercase tracking-wider">
                          {label}
                        </span>
                      </div>

                      {href ? (
                        <a
                          href={href}
                          target={external ? '_blank' : undefined}
                          rel={external ? 'noopener noreferrer' : undefined}
                          className={`text-sm font-medium text-cyber-text hover:text-cyber-accent transition-colors break-all flex items-start gap-1
                            ${mono ? 'font-mono' : ''}`}
                        >
                          <span className="flex-1">{value}</span>
                          {external && (
                            <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                          )}
                        </a>
                      ) : (
                        <p className={`text-sm font-medium text-cyber-text break-all ${mono ? 'font-mono' : ''}`}>
                          {value}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop social buttons */}
                <div className="hidden md:flex items-center gap-3 pt-1">
                  <a href="https://www.linkedin.com/in/mohamed-riyaskhan-s-9a5247386"
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-900 bg-opacity-20 border border-blue-800 border-opacity-30 text-cyber-blue hover:bg-opacity-40 transition-colors text-sm font-medium">
                    <Linkedin className="w-4 h-4" />
                    LinkedIn
                  </a>
                  <a href="https://github.com/Riyaskhan2010"
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyber-border bg-opacity-50 border border-cyber-border text-cyber-text hover:border-cyber-accent hover:text-cyber-accent transition-colors text-sm font-medium">
                    <Github className="w-4 h-4" />
                    GitHub
                  </a>
                  <a href="mailto:mriyaskhan254@gmail.com"
                     className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyber-accent bg-opacity-10 border border-cyber-accent border-opacity-30 text-cyber-accent hover:bg-opacity-20 transition-colors text-sm font-medium">
                    <Mail className="w-4 h-4" />
                    Email
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Project badge */}
          <div className="mt-6 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyber-surface border border-cyber-border text-xs text-cyber-muted">
              <Fingerprint className="w-3.5 h-3.5 text-cyber-accent" />
              <span>File Integrity Checker — Cybersecurity Internship Project</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
