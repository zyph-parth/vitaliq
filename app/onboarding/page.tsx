'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { computeAllMetrics, getBMICategory, type ActivityLevel, type Goal, type Sex } from '@/lib/calculations'
import { useStore } from '@/lib/store'
import { Button, Input, Select } from '@/components/ui'
import { clsx } from 'clsx'

type Step = 1 | 2 | 'bmi' | 3

const GOALS = [
  { id: 'lose', title: 'Lose fat', desc: 'Calorie deficit and strong habits', code: 'LF' },
  { id: 'muscle', title: 'Build muscle', desc: 'Progressive overload and recovery', code: 'BM' },
  { id: 'maintain', title: 'Stay fit', desc: 'Balanced training and health', code: 'SF' },
  { id: 'longevity', title: 'Longevity', desc: 'Healthspan and vitality', code: 'LG' },
]

const ACTIVITY_OPTIONS = [
  { value: 'sedentary',  label: 'Sedentary — mostly sitting, desk job' },
  { value: 'light',     label: 'Light — daily walks, occasional exercise' },
  { value: 'moderate',  label: 'Moderate — active 3–5 days/week' },
  { value: 'active',    label: 'Very active — intense training most days' },
  { value: 'athlete',   label: 'Athlete — twice daily or elite training' },
]

const STEP_COPY: Record<number, { label: string; title: string; description: string }> = {
  1: {
    label: 'Account',
    title: 'Create your workspace.',
    description: 'Start with your basic account so we can save the full health profile behind it.',
  },
  2: {
    label: 'Baseline',
    title: 'Map the starting point.',
    description: 'These body metrics personalize nutrition targets, readiness, and progress tracking.',
  },
  3: {
    label: 'Focus',
    title: 'Choose what matters most.',
    description: 'Your primary goal shapes how VitalIQ prioritizes the experience from day one.',
  },
}

export default function OnboardingPage() {
  const router = useRouter()
  const { setUser } = useStore()

  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    age: '',
    sex: 'male',
    heightCm: '',
    weightKg: '',
    activityLevel: 'moderate',
    goal: 'lose',
  })
  const [metrics, setMetrics] = useState<ReturnType<typeof computeAllMetrics> | null>(null)

  const progressStep = step === 1 ? 1 : step === 2 || step === 'bmi' ? 2 : 3
  const activeCopy = STEP_COPY[progressStep]

  const update = (field: string, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  const handleStep1 = () => {
    if (!form.name || !form.email || !form.password) {
      setError('Please fill in all fields.')
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setError('')
    setStep(2)
  }

  const handleStep2 = () => {
    if (!form.age || !form.heightCm || !form.weightKg) {
      setError('Please fill in all body metrics.')
      return
    }

    setError('')
    const computed = computeAllMetrics(
      parseFloat(form.weightKg),
      parseFloat(form.heightCm),
      parseInt(form.age, 10),
      form.sex as Sex,
      form.activityLevel as ActivityLevel,
      form.goal as Goal
    )
    setMetrics(computed)
    setStep('bmi')
  }

  const handleRegister = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          age: parseInt(form.age, 10),
          heightCm: parseFloat(form.heightCm),
          weightKg: parseFloat(form.weightKg),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.')
      }

      await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      })

      setUser(data.user)
      router.push('/dashboard')
    } catch (registrationError: any) {
      setError(registrationError.message)
    } finally {
      setLoading(false)
    }
  }

  const bmiInfo = metrics ? getBMICategory(metrics.bmi) : null
  const firstName = form.name.split(' ')[0] || 'You'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,#eef6ff_0%,#fafaf7_38%,#effaf3_100%)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-8%] h-[30rem] w-[30rem] rounded-full bg-[#d8f3dc]/80 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] h-[28rem] w-[28rem] rounded-full bg-[#dbeafe]/75 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1550px] gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1.1fr)_520px] lg:px-10 lg:py-8">
        <div className="hidden lg:flex lg:flex-col lg:justify-between">
          <div className="max-w-2xl pt-10">
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-[#6b7280]">VitalIQ</div>
            <h1 className="mt-5 font-display text-[4rem] font-semibold leading-none tracking-tight text-[#111827]">
              Build a health OS that fits your real routine.
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-8 text-[#475569]">
              Whether you train at home, outdoors, or the gym — VitalIQ adapts to your routine, not the other way around.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[30px] border border-white/70 bg-white/[0.78] p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">Current step</div>
              <div className="mt-3 font-display text-[2rem] font-semibold leading-tight text-[#111827]">{activeCopy.title}</div>
              <p className="mt-3 text-sm leading-7 text-[#475569]">{activeCopy.description}</p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[28px] border border-white/70 bg-[#111827] p-6 text-white shadow-[0_16px_48px_rgba(15,23,42,0.12)]">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/[0.45]">Progress</div>
                <div className="mt-3 font-display text-[3rem] font-semibold leading-none">0{progressStep}</div>
                <div className="mt-2 text-sm text-white/[0.65]">of 03 setup stages</div>
              </div>
              <div className="rounded-[28px] border border-white/70 bg-white/[0.78] p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#6b7280]">Selected goal</div>
                <div className="mt-3 font-display text-[2rem] font-semibold text-[#111827]">
                  {GOALS.find((g) => g.id === form.goal)?.title || 'Lose fat'}
                </div>
                <div className="mt-2 text-sm text-[#475569]">{GOALS.find((g) => g.id === form.goal)?.desc}</div>
              </div>
            </div>

            {metrics && bmiInfo && (
              <div className="rounded-[30px] border border-white/70 bg-white/[0.78] p-6 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7280] mb-4">Snapshot for {firstName}</div>
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-2xl p-4" style={{ background: bmiInfo.color }}>
                    <div className="text-xs uppercase tracking-[0.18em] text-[#4b5563]">BMI</div>
                    <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">{metrics.bmi}</div>
                    <div className="mt-1 text-sm text-[#475569]">{metrics.bmiCategory}</div>
                  </div>
                  <div className="rounded-2xl bg-[#f8fafc] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#64748b]">BMR</div>
                    <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">{metrics.bmr.toLocaleString()}</div>
                    <div className="mt-1 text-sm text-[#475569]">kcal</div>
                  </div>
                  <div className="rounded-2xl bg-[#f8fafc] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#64748b]">TDEE</div>
                    <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">{metrics.tdee.toLocaleString()}</div>
                    <div className="mt-1 text-sm text-[#475569]">kcal</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-full max-w-[520px] rounded-[34px] border border-white/70 bg-white/[0.82] p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-10">
            <div>
              <div className="font-display text-[2rem] font-semibold tracking-tight text-[#111827]">
                Vital<span className="text-[#166534]">IQ</span>
              </div>
              <div className="mt-6 flex items-center gap-2">
                {[1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={clsx(
                      'h-1.5 flex-1 rounded-full transition-all duration-300',
                      progressStep >= index ? 'bg-[#166534]' : 'bg-[#e5e7eb]'
                    )}
                  />
                ))}
              </div>
              <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
                Step {progressStep} of 3 · {activeCopy.label}
              </div>
            </div>

            {step === 1 && (
              <div className="mt-8 animate-fade-up">
                <h2 className="font-display text-[2.1rem] font-semibold leading-none text-[#111827]">
                  Create your account.
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#6b7280]">
                  We will use this as the anchor for your entire health profile.
                </p>

                <div className="mt-8 flex flex-col gap-4">
                  <Input
                    label="Full name"
                    placeholder="Your name"
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                  />
                  <Input
                    label="Email"
                    type="email"
                    placeholder="you@email.com"
                    value={form.email}
                    onChange={(event) => update('email', event.target.value)}
                  />
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={form.password}
                    onChange={(event) => update('password', event.target.value)}
                    hint="We keep all health data private and account-scoped."
                  />
                </div>

                {error && <p className="mt-4 text-sm text-[#dc2626]">{error}</p>}

                <div className="mt-6">
                  <Button fullWidth onClick={handleStep1}>
                    Continue
                  </Button>
                </div>

                <p className="mt-5 text-center text-sm text-[#6b7280]">
                  Already have an account?{' '}
                  <a href="/login" className="font-semibold text-[#166534] hover:underline">
                    Sign in
                  </a>
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="mt-8 animate-fade-up">
                <h2 className="font-display text-[2.1rem] font-semibold leading-none text-[#111827]">
                  Set your baseline.
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#6b7280]">
                  These inputs personalize your calorie targets and training guidance.
                </p>

                <div className="mt-8 flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Age"
                      type="number"
                      placeholder="25"
                      value={form.age}
                      onChange={(event) => update('age', event.target.value)}
                    />
                    <Select
                      label="Sex"
                      value={form.sex}
                      onChange={(event) => update('sex', event.target.value)}
                      options={[
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                      ]}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Height (cm)"
                      type="number"
                      placeholder="175"
                      value={form.heightCm}
                      onChange={(event) => update('heightCm', event.target.value)}
                    />
                    <Input
                      label="Weight (kg)"
                      type="number"
                      placeholder="70"
                      value={form.weightKg}
                      onChange={(event) => update('weightKg', event.target.value)}
                    />
                  </div>

                  <Select
                    label="Activity level"
                    value={form.activityLevel}
                    onChange={(event) => update('activityLevel', event.target.value)}
                    options={ACTIVITY_OPTIONS}
                  />
                </div>

                {error && <p className="mt-4 text-sm text-[#dc2626]">{error}</p>}

                <div className="mt-6">
                  <Button fullWidth onClick={handleStep2}>
                    Calculate my metrics
                  </Button>
                </div>
              </div>
            )}

            {step === 'bmi' && metrics && bmiInfo && (
              <div className="mt-8 animate-scale-in">
                <h2 className="font-display text-[2.1rem] font-semibold leading-none text-[#111827]">
                  Here is your starting point, {firstName}.
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#6b7280]">
                  This gives VitalIQ enough context to tailor the initial experience.
                </p>

                <div className="mt-8 rounded-[28px] p-6 text-center" style={{ background: bmiInfo.color }}>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#4b5563]">BMI result</div>
                  <div className="mt-3 font-display text-[4rem] font-semibold leading-none text-[#111827]">
                    {metrics.bmi}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-[#374151]">{metrics.bmiCategory}</div>

                  <div className="mt-6">
                    <div className="h-2 rounded-full bg-[linear-gradient(90deg,#93C5FD,#86EFAC,#FCD34D,#FCA5A5)]" />
                    <div className="relative mt-3 h-4">
                      <div
                        className="absolute top-0 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white bg-[#111827] shadow-md"
                        style={{ left: `${metrics.bmiPercentile}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] text-[#6b7280]">
                      <span>Under</span>
                      <span>Normal</span>
                      <span>Over</span>
                      <span>High</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 text-center">
                    <div className="font-display text-[1.5rem] font-semibold text-[#111827]">
                      {metrics.bmr.toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-[#6b7280]">BMR kcal</div>
                  </div>
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 text-center">
                    <div className="font-display text-[1.5rem] font-semibold text-[#111827]">
                      {metrics.tdee.toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-[#6b7280]">TDEE kcal</div>
                  </div>
                  <div className="rounded-2xl border border-[#e5e7eb] bg-white p-4 text-center">
                    <div className="font-display text-[1.5rem] font-semibold text-[#111827]">
                      {metrics.estimatedBodyFat}%
                    </div>
                    <div className="mt-1 text-xs text-[#6b7280]">Estimated body fat</div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-[#d8f3dc] bg-[#f0fdf4] px-4 py-4 text-sm leading-7 text-[#166534]">
                  {bmiInfo.message}
                </div>

                <div className="mt-6">
                  <Button fullWidth onClick={() => setStep(3)}>
                    Choose my goal
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-8 animate-fade-up">
                <h2 className="font-display text-[2.1rem] font-semibold leading-none text-[#111827]">
                  Choose your primary goal.
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#6b7280]">
                  You can change this later, but this gives the first version of the workspace a direction.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {GOALS.map((goal) => (
                    <button
                      key={goal.id}
                      onClick={() => update('goal', goal.id)}
                      className={clsx(
                        'rounded-[24px] border-[1.5px] p-4 text-left transition-all',
                        form.goal === goal.id
                          ? 'border-[#166534] bg-[#D8F3DC]'
                          : 'border-[#e5e7eb] bg-white hover:border-[#166534]'
                      )}
                    >
                      <div className="inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#111827]">
                        {goal.code}
                      </div>
                      <div className="mt-4 text-[15px] font-semibold text-[#111827]">{goal.title}</div>
                      <div className="mt-2 text-sm leading-6 text-[#6b7280]">{goal.desc}</div>
                    </button>
                  ))}
                </div>

                {error && <p className="mt-4 text-sm text-[#dc2626]">{error}</p>}

                <div className="mt-6">
                  <Button fullWidth loading={loading} onClick={handleRegister}>
                    Launch VitalIQ
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
