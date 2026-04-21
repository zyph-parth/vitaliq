'use client'
// app/login/page.tsx — Premium light theme

import { useState, useEffect } from 'react'
import { getProviders, signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const HERO_STATS = [
  { label: 'Readiness', value: '79', unit: '/100' },
  { label: 'Calories', value: '1,840', unit: 'kcal' },
  { label: 'Sleep', value: '8.2', unit: 'hrs' },
  { label: 'Streak', value: '12', unit: 'days' },
]

const FEATURES = [
  { icon: '🧠', text: 'Readiness score — know how hard to push today' },
  { icon: '🥗', text: 'AI nutrition — log meals by voice, photo, or text' },
  { icon: '🏋️', text: 'Smart workouts — home, outdoor, or gym' },
  { icon: '📈', text: 'Long-term progress — trends that reveal the full picture' },
]

export default function LoginPage() {
  const { status } = useSession()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleAvailable, setGoogleAvailable] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    getProviders()
      .then((providers) => setGoogleAvailable(Boolean(providers?.google)))
      .catch(() => setGoogleAvailable(false))
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    }
  }, [status, router])

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) { setError('Incorrect email or password. Try again.'); setLoading(false); return }
    router.push('/dashboard')
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  if (status === 'authenticated') return null

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,#eef6ff_0%,#fafaf7_38%,#effaf3_100%)]">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-8%] h-[36rem] w-[36rem] rounded-full bg-[#d8f3dc]/80 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] h-[30rem] w-[30rem] rounded-full bg-[#dbeafe]/75 blur-3xl" />
        <div className="absolute left-[40%] top-[30%] h-[20rem] w-[20rem] rounded-full bg-[#ede9fe]/50 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[1fr_480px]">

        {/* ── Left: Brand panel ── */}
        <div className={`hidden lg:flex flex-col justify-between px-16 py-14 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: 'linear-gradient(135deg, #2D6A4F, #52b788)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 12h2l3-9 4 18 3-12 2 3h4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-display text-[22px] font-semibold text-[#111827] tracking-tight">
              Vital<span className="text-[#166534]">IQ</span>
            </span>
          </div>

          {/* Headline */}
          <div className="max-w-lg">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6b7280] mb-5">
              Your intelligent health OS
            </div>
            <h1 className="font-display leading-none tracking-tight text-[#111827]"
              style={{ fontSize: 'clamp(2.8rem, 4vw, 3.6rem)', fontWeight: 700 }}>
              Your health data,{' '}
              <span className="text-[#166534]">finally connected.</span>
            </h1>
            <p className="mt-6 text-[15px] leading-8 text-[#475569]">
              VitalIQ connects sleep, nutrition, training, and mental state — then uses AI to surface the insights that actually change how you feel and perform.
            </p>

            {/* Feature list */}
            <div className="mt-10 flex flex-col gap-3.5">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[16px]
                    bg-white/80 border border-white/70 shadow-sm backdrop-blur-sm">
                    {f.icon}
                  </div>
                  <span className="text-[13px] font-medium text-[#475569]">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live stats ticker */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#9ca3af] mb-4">
              Live from a sample dashboard
            </div>
            <div className="grid grid-cols-4 gap-3">
              {HERO_STATS.map((s) => (
                <div key={s.label}
                  className="rounded-2xl border border-white/70 bg-white/75 px-4 py-4 shadow-sm backdrop-blur-xl">
                  <div className="font-display text-[1.8rem] font-bold text-[#111827] leading-none">
                    {s.value}
                    <span className="text-[12px] font-normal ml-1 text-[#9ca3af]">{s.unit}</span>
                  </div>
                  <div className="text-[10px] mt-1.5 font-semibold uppercase tracking-[0.15em] text-[#9ca3af]">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Login form panel ── */}
        <div className="flex items-center justify-center px-6 py-12 lg:px-8 lg:border-l lg:border-[#e5e7eb]/60">
          <div className={`w-full max-w-[400px] transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

            {/* Mobile logo */}
            <div className="flex items-center gap-2 mb-10 lg:hidden">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #2D6A4F, #52b788)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M3 12h2l3-9 4 18 3-12 2 3h4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="font-display text-[20px] font-semibold text-[#111827]">
                Vital<span className="text-[#166534]">IQ</span>
              </span>
            </div>

            {/* Card */}
            <div className="rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-[0_24px_64px_rgba(15,23,42,0.10)] backdrop-blur-xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9ca3af] mb-3">
                Welcome back
              </div>
              <h2 className="font-display text-[2rem] font-semibold tracking-tight text-[#111827]">
                Sign in to your workspace.
              </h2>
              <p className="mt-2.5 text-[13px] leading-6 text-[#6b7280]">
                Your health context and AI insights are waiting.
              </p>

              <form onSubmit={handleLogin} className="mt-7 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-[#e5e7eb] bg-white/80 px-4 py-3 text-[14px] text-[#111827] outline-none transition-all placeholder:text-[#9ca3af]"
                    onFocus={e => { e.target.style.borderColor = '#2D6A4F'; e.target.style.boxShadow = '0 0 0 3px rgba(45,106,79,0.08)' }}
                    onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-[#6b7280]">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-[#e5e7eb] bg-white/80 px-4 py-3 text-[14px] text-[#111827] outline-none transition-all placeholder:text-[#9ca3af]"
                    onFocus={e => { e.target.style.borderColor = '#2D6A4F'; e.target.style.boxShadow = '0 0 0 3px rgba(45,106,79,0.08)' }}
                    onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-[#fef2f2] border border-[#fecaca] px-4 py-3 text-[13px] font-medium text-[#dc2626]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 w-full rounded-xl py-3.5 text-[14px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #2D6A4F, #52b788)', boxShadow: '0 4px 16px rgba(45,106,79,0.25)' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Signing in…
                    </span>
                  ) : 'Sign in →'}
                </button>
              </form>

              {googleAvailable && (
                <>
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#f3f4f6]" />
                    <span className="text-[11px] font-medium text-[#9ca3af]">or</span>
                    <div className="h-px flex-1 bg-[#f3f4f6]" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading || googleLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#e5e7eb] bg-white/75 py-3 text-[14px] font-semibold text-[#374151] transition-all hover:border-[#d1d5db] hover:bg-white hover:shadow-sm active:scale-[0.98] disabled:opacity-60"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[13px] font-bold text-[#4285f4]">
                      G
                    </span>
                    {googleLoading ? 'Opening Google...' : 'Continue with Google'}
                  </button>
                </>
              )}

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#f3f4f6]" />
                <span className="text-[11px] font-medium text-[#9ca3af]">New here?</span>
                <div className="h-px flex-1 bg-[#f3f4f6]" />
              </div>

              <a
                href="/onboarding"
                className="flex w-full items-center justify-center rounded-xl border border-[#e5e7eb] bg-white/60 py-3 text-[14px] font-semibold text-[#374151] transition-all hover:border-[#d1d5db] hover:bg-white hover:shadow-sm"
              >
                Create your free account
              </a>

              <p className="mt-5 text-center text-[11px] text-[#9ca3af]">
                Powered by Gemini AI · Your data stays yours
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
