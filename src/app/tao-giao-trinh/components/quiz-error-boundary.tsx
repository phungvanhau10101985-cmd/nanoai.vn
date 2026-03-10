'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/** Bắt lỗi trong quiz popup và log chi tiết để debug */
export class QuizErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[QuizErrorBoundary] Lỗi:', error.message, {
      name: error.name,
      stack: error.stack,
      componentStack: info.componentStack,
    })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          <p className="font-medium">Đã xảy ra lỗi</p>
          <p className="mt-1 font-mono text-xs break-all">{this.state.error.message}</p>
          {this.state.error.stack && (
            <pre className="mt-2 text-[10px] overflow-auto max-h-32 opacity-80">{this.state.error.stack}</pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
