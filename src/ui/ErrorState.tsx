import type { ReactNode } from 'react'
import { t } from '@/i18n'

interface ErrorStateProps {
  title: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  children?: ReactNode
  className?: string
}

/** Clear error surface with optional one-click retry. */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  children,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 px-4 py-6 text-center min-h-[6rem] ${className}`}
      role="alert"
    >
      <div className="text-[12px] text-[#f6465d] font-medium">{title}</div>
      {description ? (
        <p className="text-[11px] text-[#848e9c] max-w-sm leading-relaxed">{description}</p>
      ) : null}
      {children}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 px-3 py-1.5 text-[11px] font-semibold rounded bg-[#f0b90b] text-[#0b0e11] hover:bg-[#fcd535]"
        >
          {retryLabel || t('error.retry')}
        </button>
      ) : null}
    </div>
  )
}
