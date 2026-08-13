import React from 'react'
import { CheckCircle, AlertTriangle, Plus, AlertCircle, Clock } from 'lucide-react'

const STATUS_CONFIG = {
  VERIFIED:  { label: 'Verified',  className: 'status-verified', Icon: CheckCircle },
  MODIFIED:  { label: 'Modified',  className: 'status-modified', Icon: AlertTriangle },
  NEW:       { label: 'New',       className: 'status-new',      Icon: Plus },
  ERROR:     { label: 'Error',     className: 'status-error',    Icon: AlertCircle },
  PENDING:   { label: 'Pending',   className: 'status-error',    Icon: Clock },
  verified:  { label: 'Verified',  className: 'status-verified', Icon: CheckCircle },
  modified:  { label: 'Modified',  className: 'status-modified', Icon: AlertTriangle },
  new:       { label: 'New',       className: 'status-new',      Icon: Plus },
  active:    { label: 'Active',    className: 'status-verified', Icon: CheckCircle },
  paused:    { label: 'Paused',    className: 'status-error',    Icon: Clock },
}

export default function StatusBadge({ status, showIcon = true, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['ERROR']
  const { label, className, Icon } = config

  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span className={`badge ${className} ${sizeClass} inline-flex items-center gap-1`}>
      {showIcon && <Icon style={{ width: '11px', height: '11px' }} />}
      {label}
    </span>
  )
}
