'use client'
// app/page.tsx — Premium animated splash screen
// Auth check happens in parallel; animation plays while NextAuth resolves.
// On exit, a scale+fade reveal transition leads into the destination page.

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const PILLARS = [
  { icon: '💤', label: 'Sleep' },
  { icon: '🥗', label: 'Nutrition' },
  { icon: '🏋️', label: 'Training' },
  { icon: '🧠', label: 'Mental' },
  { icon: '📈', label: 'Longevity' },
]

const MIN_SPLASH_MS = 2200  // Always show splash for at least this long
const EXIT_DURATION = 520   // How long the exit animation plays before route change

export default function SplashPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [exiting, setExiting] = useState(false)
  const [readyToNavigate, setReadyToNavigate] = useState(false)
  const [splashDone, setSplashDone] = useState(false)

  // Minimum splash timer
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), MIN_SPLASH_MS)
    return () => clearTimeout(t)
  }, [])

  // Mark ready to navigate once both auth resolved AND splash timer elapsed
  useEffect(() => {
    if (status !== 'loading' && splashDone) {
      setReadyToNavigate(true)
    }
  }, [status, splashDone])

  // Trigger exit animation then navigate
  useEffect(() => {
    if (!readyToNavigate) return
    setExiting(true)
    const t = setTimeout(() => {
      router.replace(session ? '/dashboard' : '/login')
    }, EXIT_DURATION)
    return () => clearTimeout(t)
  }, [readyToNavigate, session, router])

  return (
    <div
      className={exiting ? 'splash-exit' : ''}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #080c0a 0%, #0e1611 35%, #0b0f1a 100%)',
      }}
    >
      {/* ── Ambient glow blobs ─────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ overflow: 'hidden' }}
      >
        {/* Primary green glow */}
        <div
          style={{
            position: 'absolute',
            top: '-15%',
            left: '-10%',
            width: '55rem',
            height: '55rem',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(45,106,79,0.35) 0%, transparent 68%)',
            filter: 'blur(40px)',
          }}
        />
        {/* Secondary blue glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '-20%',
            right: '-8%',
            width: '42rem',
            height: '42rem',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(29,78,216,0.2) 0%, transparent 68%)',
            filter: 'blur(50px)',
          }}
        />
        {/* Subtle warm center */}
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '30rem',
            height: '30rem',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(82,183,136,0.08) 0%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />
      </div>

      {/* ── Pulsing rings (inspired by health/vitals monitors) ─────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: '32rem',
          height: '32rem',
          borderRadius: '50%',
          border: '1px solid rgba(82,183,136,0.14)',
        }}
      >
        <div
          className="splash-ring-pulse"
          style={{
            position: 'absolute',
            inset: '-2.5rem',
            borderRadius: '50%',
            border: '1px solid rgba(82,183,136,0.1)',
          }}
        />
        <div
          className="splash-ring-pulse-2"
          style={{
            position: 'absolute',
            inset: '-5.5rem',
            borderRadius: '50%',
            border: '1px solid rgba(82,183,136,0.06)',
          }}
        />
      </div>

      {/* ── Main logo block ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center gap-0">

        {/* Icon mark */}
        <div
          className="splash-logo-in splash-heartbeat mb-6"
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #2D6A4F 0%, #52b788 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(82,183,136,0.4), 0 0 80px rgba(82,183,136,0.15)',
          }}
        >
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 12h2l3-9 4 18 3-12 2 3h4"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <div className="splash-logo-in" style={{ animationDelay: '0.1s' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(3rem, 8vw, 4.5rem)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              color: '#ffffff',
            }}
          >
            Vital
            <span style={{ color: '#52b788' }}>IQ</span>
          </span>
        </div>

        {/* Tagline */}
        <div
          className="splash-tagline-in"
          style={{
            marginTop: '12px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
            textAlign: 'center',
          }}
        >
          Your Intelligent Health OS
        </div>

        {/* Pillar chips */}
        <div
          className="splash-pillars-in"
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '32px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {PILLARS.map((p, i) => (
            <div
              key={p.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.45)',
                fontWeight: 500,
                animationDelay: `${0.9 + i * 0.07}s`,
              }}
            >
              <span style={{ fontSize: '13px' }}>{p.icon}</span>
              {p.label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: '48px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120px',
        }}
      >
        <div
          style={{
            height: '2px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            className="splash-progress-fill"
            style={{
              height: '100%',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, #2D6A4F, #52b788)',
              width: '0%',
            }}
          />
        </div>

        {/* Status text */}
        <div
          className="splash-tagline-in"
          style={{
            marginTop: '10px',
            textAlign: 'center',
            fontSize: '10px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.2)',
            fontWeight: 600,
          }}
        >
          {status === 'loading' ? 'Authenticating' : session ? 'Welcome back' : 'Initialising'}
        </div>
      </div>

      {/* ── Powered-by badge ────────────────────────────────────────────── */}
      <div
        className="splash-tagline-in"
        style={{
          position: 'absolute',
          bottom: '16px',
          fontSize: '9px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.15)',
          fontWeight: 600,
          animationDelay: '1.1s',
        }}
      >
        Powered by Gemini AI
      </div>
    </div>
  )
}
