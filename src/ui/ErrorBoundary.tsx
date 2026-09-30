import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureException } from '@/lib/telemetry'

interface Props {
  children: ReactNode
  name?: string
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, {
      tags: { boundary: this.props.name ?? 'root' },
      extra: { componentStack: info.componentStack },
      level: 'error',
    })
  }

  private reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div
        className="flex flex-col items-center justify-center gap-3 p-6 m-2 rounded border border-[#f6465d]/40 bg-[#1a0b0d] text-center min-h-[8rem]"
        role="alert"
      >
        <div className="text-[#f6465d] text-sm font-medium">Something went wrong</div>
        <p className="text-[11px] text-[#848e9c] max-w-md break-words">
          {error.message || 'Unexpected UI error'}
        </p>
        {this.props.name ? (
          <span className="text-[10px] text-[#5e6673]">panel: {this.props.name}</span>
        ) : null}
        <button
          type="button"
          onClick={this.reset}
          className="text-[11px] px-3 py-1 rounded border border-[#2b3139] text-[#eaecef] hover:border-[#f0b90b] hover:text-[#f0b90b]"
        >
          Try again
        </button>
      </div>
    )
  }
}
