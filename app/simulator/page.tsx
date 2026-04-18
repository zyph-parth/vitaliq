'use client'
// app/simulator/page.tsx — What-If Body Simulator

import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, SectionHeader, Chip } from '@/components/ui'
import { useDashboard } from '@/lib/useDashboard'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface SimParams {
  currentWeight: number
  targetWeight: number
  heightCm: number
  age: number
  sex: 'male' | 'female'
  activityLevel: number
  dailyCalories: number
  weeklyCardioMins: number
  weeklyStrengthDays: number
}

// Mifflin BMR
function bmr(w: number, h: number, age: number, sex: 'male' | 'female') {
  return sex === 'male'
    ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * age
    : 447.593 + 9.247 * w + 3.098 * h - 4.330 * age
}

function project(params: SimParams, weeks: number) {
  const { currentWeight, heightCm, age, sex, activityLevel, dailyCalories, weeklyCardioMins, weeklyStrengthDays } = params
  const data = []
  let w = currentWeight

  for (let wk = 0; wk <= weeks; wk++) {
    const tdee = bmr(w, heightCm, age, sex) * activityLevel
      + (weeklyCardioMins / 7) * 5
      + weeklyStrengthDays * 50 / 7

    const weeklyBalance = (dailyCalories - tdee) * 7
    const muscleFactor = weeklyStrengthDays >= 3 ? 0.85 : 0.92
    const weeklyWeightChange = weeklyBalance / 7700 * muscleFactor

    // MEDIUM 4: Remove -3 buffer on target clamp — clamp exactly at targetWeight
    w = Math.min(params.currentWeight + 15, Math.max(params.targetWeight, w + weeklyWeightChange))
    const bmiVal = w / ((heightCm / 100) ** 2)

    data.push({
      week: wk,
      weight: parseFloat(w.toFixed(1)),
      bmi: parseFloat(bmiVal.toFixed(1)),
      label: wk === 0 ? 'Now' : wk % 4 === 0 ? `Wk ${wk}` : '',
      weeklyBalance: Math.round(weeklyBalance / 7),
    })
  }
  return data
}

const ACTIVITY_OPTIONS = [
  { label: 'Sedentary', value: 1.2 },
  { label: 'Lightly active', value: 1.375 },
  { label: 'Moderately active', value: 1.55 },
  { label: 'Very active', value: 1.725 },
  { label: 'Athlete', value: 1.9 },
]

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { week: number } }> }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] text-white text-xs px-3 py-2 rounded-xl shadow-lg">
      <div className="font-semibold mb-1">{payload[0]?.payload?.week === 0 ? 'Today' : `Week ${payload[0]?.payload?.week}`}</div>
      <div>{payload[0]?.value} kg</div>
      <div className="opacity-60">BMI {payload[1]?.value}</div>
    </div>
  )
}

export default function SimulatorPage() {
  const { dashboard } = useDashboard()
  const [params, setParams] = useState<SimParams>({
    currentWeight: 80, targetWeight: 72, heightCm: 170, age: 25, sex: 'male',
    activityLevel: 1.55, dailyCalories: 2000, weeklyCardioMins: 150, weeklyStrengthDays: 3,
  })
  const [weeks, setWeeks] = useState(24)

  // Pre-fill with real user data from shared dashboard cache
  useEffect(() => {
    if (!dashboard?.user) return
    const u = dashboard.user
    setParams(p => ({
      ...p,
      currentWeight: u.weightKg ?? p.currentWeight,
      heightCm: u.heightCm ?? p.heightCm,
      age: u.age ?? p.age,
      sex: (u.sex as 'male' | 'female') ?? p.sex,
      activityLevel: 1.55,
      dailyCalories: u.tdee ? Math.round(u.tdee * 0.85) : p.dailyCalories,
      targetWeight: u.weightKg ? Math.round(u.weightKg * 0.9) : p.targetWeight,
    }))
  }, [dashboard])

  const update = (k: keyof SimParams, v: number | string) =>
    setParams(p => ({ ...p, [k]: typeof v === 'string' ? parseFloat(v) || 0 : v }))

  const data = useMemo(() => project(params, weeks), [params, weeks])

  const startWeight = data[0]?.weight
  const endWeight = data[data.length - 1]?.weight
  // UX 7: fix sign — positive means weight dropped (loss), negative means gained
  const netChange = parseFloat((startWeight - endWeight).toFixed(1))
  const weeksToTarget = data.findIndex(d => d.weight <= params.targetWeight)
  const reachesTarget = weeksToTarget > -1

  const dailyDeficit = useMemo(() => {
    const tdee = bmr(params.currentWeight, params.heightCm, params.age, params.sex) * params.activityLevel
    return Math.round(tdee - params.dailyCalories)
  }, [params])

  const weeklyChangeRate = weeks > 0 ? Math.abs(netChange) / weeks : 0

  return (
    <AppShell>
      {/* Premium Hero Header */}
      <section className="px-4 pb-6 pt-2 lg:px-0 lg:pt-2">
        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(140deg,#fef9ec_0%,#fafaf7_46%,#ede9fe_100%)] px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#6b7280]">
                What-If Simulator
              </div>
              <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-none tracking-tight text-[#111827] sm:text-[3rem]">
                Project your body. 🔮
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#4b5563] sm:text-[15px]">
                Adjust calories, cardio, and training — see exactly how your weight and body composition change over time. No guessing.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[440px]">
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">Projecting</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">{weeks}w</div>
                <div className="text-xs text-[#6b7280]">time horizon</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#6b7280]">End weight</div>
                <div className="mt-2 font-display text-[2rem] font-semibold text-[#111827]">{endWeight}</div>
                <div className="text-xs text-[#6b7280]">kg projected</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-[#111827] p-4 text-white">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">Change</div>
                {/* UX 7: positive netChange = loss (green), negative = gain (red) */}
                <div className={`mt-2 font-display text-[1.5rem] font-semibold ${netChange > 0 ? 'text-[#95D5B2]' : netChange < 0 ? 'text-[#FCA5A5]' : 'text-white'}`}>
                  {netChange > 0 ? '-' : netChange < 0 ? '+' : ''}{Math.abs(netChange).toFixed(1)}kg
                </div>
                <div className="text-xs text-white/60">{netChange > 0 ? 'projected loss' : netChange < 0 ? 'projected gain' : 'stable'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deficit / rate summary */}
      <div className="mx-4 mb-4 flex flex-wrap gap-2">
        <Chip variant={dailyDeficit > 0 ? 'green' : 'coral'}>
          {dailyDeficit > 0 ? `${dailyDeficit} kcal deficit/day` : `${Math.abs(dailyDeficit)} kcal surplus/day`}
        </Chip>
        <Chip variant="amber">~{(weeklyChangeRate * 1000).toFixed(0)}g / week</Chip>
        {reachesTarget && <Chip variant="blue">🎯 Goal in {weeksToTarget} weeks</Chip>}
      </div>

      {/* Weight projection chart */}
      <div className="mx-4 mb-4">
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[14px] font-semibold">Weight projection</div>
            <div className="flex gap-1">
              {[12, 24, 36, 52].map(w => (
                <button key={w} onClick={() => setWeeks(w)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${weeks === w ? 'bg-[#1A1A1A] text-white' : 'bg-[#F1F1EC] text-[#8A8A85] hover:bg-[#E8E8E3]'}`}>
                  {w}w
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2D6A4F" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#2D6A4F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#8A8A85' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide domain={['dataMin - 2', 'dataMax + 1']} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={params.targetWeight} stroke="#FCD34D" strokeDasharray="4 4" strokeWidth={1.5}
                  label={{ value: 'Target', position: 'right', fontSize: 10, fill: '#B45309' }} />
                <Area type="monotone" dataKey="weight" stroke="#2D6A4F" strokeWidth={2} fill="url(#simGrad)" dot={false}
                  activeDot={{ r: 4, fill: '#2D6A4F', stroke: 'white', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Controls */}
      <SectionHeader title="Adjust your scenario" />
      <div className="px-4 flex flex-col gap-4 mb-6">
        {/* Body stats */}
        <Card padding="md">
          <div className="text-[13px] font-semibold mb-3">Body stats</div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: 'Current weight (kg)', key: 'currentWeight', min: 40, max: 200, step: 0.5 },
              { label: 'Target weight (kg)',  key: 'targetWeight',  min: 40, max: 200, step: 0.5 },
              { label: 'Height (cm)',         key: 'heightCm',      min: 140, max: 220, step: 1 },
              { label: 'Age',                 key: 'age',           min: 16, max: 80,  step: 1 },
            ] as const).map(({ label, key, min, max, step }) => (
              <div key={key}>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A85] mb-1.5">{label}</div>
                <div className="flex items-center gap-2">
                  <input type="range" min={min} max={max} step={step} value={params[key]}
                    onChange={e => update(key, parseFloat(e.target.value))}
                    className="flex-1 accent-[#2D6A4F]" />
                  <span className="text-[13px] font-semibold w-10 text-right">{params[key]}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A85] mb-1.5">Biological sex</div>
            <div className="flex gap-2">
              {(['male', 'female'] as const).map(s => (
                <button key={s} onClick={() => setParams(p => ({ ...p, sex: s }))}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-semibold capitalize transition-all ${params.sex === s ? 'bg-[#1A1A1A] text-white' : 'bg-[#F1F1EC] text-[#8A8A85]'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Nutrition & activity */}
        <Card padding="md">
          <div className="text-[13px] font-semibold mb-3">Nutrition &amp; activity</div>
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A85]">Daily calories</div>
                <Chip variant={dailyDeficit > 0 ? 'green' : 'coral'}>
                  {dailyDeficit > 0 ? '-' : '+'}{Math.abs(dailyDeficit)} kcal {dailyDeficit > 0 ? 'deficit' : 'surplus'}
                </Chip>
              </div>
              <div className="flex items-center gap-3">
                <input type="range" min={1000} max={4000} step={50} value={params.dailyCalories}
                  onChange={e => update('dailyCalories', parseInt(e.target.value))} className="flex-1 accent-[#2D6A4F]" />
                <span className="text-[13px] font-semibold w-16 text-right">{params.dailyCalories} kcal</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A85] mb-2">Activity level</div>
              <div className="flex gap-1.5 flex-wrap">
                {ACTIVITY_OPTIONS.map(a => (
                  <button key={a.value} onClick={() => update('activityLevel', a.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${params.activityLevel === a.value ? 'bg-[#1A1A1A] text-white' : 'bg-[#F1F1EC] text-[#8A8A85] hover:bg-[#E8E8E3]'}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Exercise */}
        <Card padding="md">
          <div className="text-[13px] font-semibold mb-3">Exercise habits</div>
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex justify-between mb-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A85]">Weekly cardio</div>
                <span className="text-[12px] font-semibold">{params.weeklyCardioMins} min</span>
              </div>
              <input type="range" min={0} max={600} step={15} value={params.weeklyCardioMins}
                onChange={e => update('weeklyCardioMins', parseInt(e.target.value))} className="w-full accent-[#2D6A4F]" />
              <div className="flex justify-between mt-1 text-[10px] text-[#8A8A85]">
                <span>None</span><span>WHO rec. (150min)</span><span>High (600min)</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A85]">Strength days/week</div>
                <span className="text-[12px] font-semibold">{params.weeklyStrengthDays}x</span>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map(d => (
                  <button key={d} onClick={() => update('weeklyStrengthDays', d)}
                    className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all ${params.weeklyStrengthDays === d ? 'bg-[#1A1A1A] text-white' : 'bg-[#F1F1EC] text-[#8A8A85]'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Scenario comparison */}
        <Card padding="md">
          <div className="text-[13px] font-semibold mb-1">Scenario comparison</div>
          <div className="text-[12px] text-[#8A8A85] mb-3">Your current plan vs. alternatives</div>
          {[
            { label: 'Your plan',      cals: params.dailyCalories, cardio: params.weeklyCardioMins, strength: params.weeklyStrengthDays },
            { label: 'Aggressive cut', cals: params.dailyCalories - 300, cardio: params.weeklyCardioMins + 90, strength: params.weeklyStrengthDays },
            { label: 'Lean bulk',      cals: params.dailyCalories + 200, cardio: params.weeklyCardioMins - 60, strength: Math.min(6, params.weeklyStrengthDays + 1) },
          ].map(scenario => {
            const scenarioData = project({ ...params, dailyCalories: scenario.cals, weeklyCardioMins: Math.max(0, scenario.cardio), weeklyStrengthDays: scenario.strength }, weeks)
            const scenarioEnd = scenarioData[scenarioData.length - 1]?.weight
            const loss = params.currentWeight - scenarioEnd
            return (
              <div key={scenario.label} className="flex items-center justify-between py-2.5 border-b border-[#F1F1EC] last:border-0">
                <div>
                  <div className="text-[13px] font-semibold">{scenario.label}</div>
                  <div className="text-[11px] text-[#8A8A85] mt-0.5">{scenario.cals} kcal · {Math.max(0, scenario.cardio)}min cardio</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-[16px] font-bold">{scenarioEnd.toFixed(1)}kg</div>
                  <Chip variant={loss > 0 ? 'green' : 'amber'} className="text-[10px] mt-0.5">
                    {loss > 0 ? '-' : '+'}{Math.abs(loss).toFixed(1)}kg
                  </Chip>
                </div>
              </div>
            )
          })}
        </Card>

        {/* Insight */}
        <div className="p-4 rounded-2xl" style={{ background: '#FEF3C7', borderLeft: '4px solid #FCD34D' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#B45309] mb-1.5">⚡ Simulator insight</div>
          <div className="text-[13px] leading-relaxed text-[#3D3D3A]">
            {dailyDeficit > 750
              ? `A ${dailyDeficit} kcal daily deficit is aggressive. You may lose muscle mass and experience energy crashes. Consider a more moderate approach.`
              : dailyDeficit > 300
              ? `Your ${dailyDeficit} kcal deficit is sustainable. Combined with ${params.weeklyStrengthDays} strength days, you'll preserve muscle while losing fat.`
              : dailyDeficit > 0
              ? `A ${dailyDeficit} kcal deficit is conservative — ideal for slow, sustainable fat loss with minimal muscle sacrifice.`
              : `You're in a calorie surplus. Combined with ${params.weeklyStrengthDays} strength days, this supports muscle building.`}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
