import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function HashDisplay({ label, hash, algorithm, highlight }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true)
      toast.success('Hash copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!hash) return null

  return (
    <div className={`rounded-lg p-3 border ${
      highlight === 'green' ? 'bg-green-900 bg-opacity-10 border-green-800 border-opacity-30' :
      highlight === 'red'   ? 'bg-red-900 bg-opacity-10 border-red-800 border-opacity-30' :
      'bg-cyber-surface border-cyber-border'
    }`}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-cyber-muted uppercase tracking-wider">{label}</span>
          {algorithm && (
            <span className="text-xs text-cyber-accent bg-cyber-accent bg-opacity-10 px-2 py-0.5 rounded font-mono">
              {algorithm.toUpperCase()}
            </span>
          )}
        </div>
      )}
      <div className="flex items-start gap-2">
        <p className="hash-text flex-1 leading-relaxed">{hash}</p>
        <button
          onClick={copy}
          className="flex-shrink-0 p-1 rounded text-cyber-muted hover:text-cyber-accent transition-colors"
          title="Copy hash"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-cyber-green" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  )
}
