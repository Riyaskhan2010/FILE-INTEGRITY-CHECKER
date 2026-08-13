import React from 'react'

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-cyber-border bg-opacity-50 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-cyber-muted" />
        </div>
      )}
      <h3 className="text-base font-semibold text-cyber-text mb-2">{title}</h3>
      {description && <p className="text-sm text-cyber-muted mb-5 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
