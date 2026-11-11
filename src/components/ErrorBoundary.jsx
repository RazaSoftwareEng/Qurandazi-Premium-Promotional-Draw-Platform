import { Component } from 'react'

/** Catches render errors so the app shows a recovery screen instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('QURANDAZI render error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory px-4">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-2xl font-extrabold text-navy-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-muted">An unexpected error occurred. Please reload the page.</p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-ivory-100 p-3 text-left font-mono text-xs text-red-700">{String(this.state.error?.message || this.state.error)}</pre>
          )}
          <button className="btn btn-primary mt-6" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    )
  }
}
