'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

interface ReadinessRingProps {
  score: number
  label: string
  recommendation: string
  pillars?: Record<string, number>
  className?: string
}

export default function ReadinessRing({
  score,
  label,
  recommendation,
  pillars,
  className,
}: ReadinessRingProps) {
  const [animated, setAnimated] = useState(false)
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  useEffect(() => {
    const timeout = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timeout)
  }, [])

  const getScoreColor = () => {
    if (score >= 80) return '#95D5B2'
    if (score >= 65) return '#86EFAC'
    if (score >= 50) return '#FCD34D'
    return '#FCA5A5'
  }

  return (
    <div
      className={clsx('relative flex items-center gap-5 overflow-hidden rounded-3xl p-6', className)}
      style={{ background: '#1A1A1A', color: 'white' }}
    >
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full" style={{ background: 'rgba(255,255,255,0.03)' }} />
      <div className="absolute -bottom-8 -right-2 h-28 w-28 rounded-full" style={{ background: 'rgba(255,255,255,0.02)' }} />

      <div className="relative flex-shrink-0">
        <svg width="96" height="96" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
          <circle
            cx="45"
            cy="45"
            r={radius}
            fill="none"
            stroke={getScoreColor()}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? offset : circumference}
            transform="rotate(-90 45 45)"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[22px] font-bold text-white">{score}</span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest opacity-50">
          Today's readiness
        </div>
        <div className="font-display text-[28px] font-bold leading-tight" style={{ color: getScoreColor() }}>
          {label}
        </div>
        <div className="mt-2 line-clamp-3 text-[13px] leading-relaxed opacity-75">{recommendation}</div>

        {pillars && (
          <div className="mt-3 flex gap-2">
            {Object.entries(pillars).map(([key, value]) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <div className="relative h-8 w-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-1000"
                    style={{
                      height: animated ? `${(value / 35) * 100}%` : '0%',
                      background: getScoreColor(),
                    }}
                  />
                </div>
                <span className="text-[8px] capitalize opacity-40">{key.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
