/** Per-panel connection status badge */

import type { ConnectionStatus } from '@/types'

const STYLES: Record<ConnectionStatus, string> = {
  connecting: 'bg-terminal-yellow/20 text-terminal-yellow border-terminal-yellow/40',
  reconnecting: 'bg-terminal-yellow/20 text-terminal-yellow border-terminal-yellow/40',
  connected: 'bg-terminal-green/20 text-terminal-green border-terminal-green/40',
  disconnected: 'bg-terminal-muted/20 text-terminal-muted border-terminal-border',
  error: 'bg-terminal-red/20 text-terminal-red border-terminal-red/40',
}

const LABELS: Record<ConnectionStatus, string> = {
  connecting: 'CONNECTING',
  reconnecting: 'RECONNECTING',
  connected: 'ONLINE',
  disconnected: 'OFFLINE',
  error: 'ERROR',
}

export function ConnectionBadge({
  status,
  detail,
}: {
  status: ConnectionStatus
  detail?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xxs font-medium border ${STYLES[status]}`}
      title={detail || LABELS[status]}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'connected'
            ? 'bg-terminal-green'
            : status === 'error'
              ? 'bg-terminal-red'
              : status === 'reconnecting' || status === 'connecting'
                ? 'bg-terminal-yellow animate-pulse'
                : 'bg-terminal-muted'
        }`}
      />
      {LABELS[status]}
      {detail && (status === 'connecting' || status === 'reconnecting') && (
        <span className="opacity-70 max-w-[9rem] truncate hidden sm:inline">
          · {detail}
        </span>
      )}
    </span>
  )
}
