'use client'
// components/ErrorBoundary.tsx — React error boundary for graceful error fallback

import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console in development; swap for Sentry/Datadog in production
    console.error('[VitalIQ ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="mb-5 text-5xl">⚠️</div>
          <h2 className="font-display text-[22px] font-semibold text-[#111827]">
            Something went wrong
          </h2>
          <p className="mt-3 max-w-sm text-[14px] leading-7 text-[#8A8A85]">
            {this.state.error?.message || 'An unexpected error occurred. Your data is safe.'}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={this.handleReset}
              className="rounded-2xl bg-[#1A1A1A] px-6 py-3 text-[13px] font-semibold text-white transition-all hover:bg-[#2D6A4F]"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-2xl border border-[#E8E8E3] px-6 py-3 text-[13px] font-semibold text-[#8A8A85] transition-all hover:border-[#1A1A1A] hover:text-[#1A1A1A]"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
