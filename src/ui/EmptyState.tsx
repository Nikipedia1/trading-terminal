import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 px-4 py-8 text-center min-h-[6rem] ${className}`}
      role="status"
    >
      {icon ? <div className="text-[#5e6673] text-2xl opacity-80">{icon}</div> : null}
      <div className="text-[12px] text-[#eaecef] font-medium">{title}</div>
      {description ? (
        <p className="text-[11px] text-[#848e9c] max-w-xs leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
