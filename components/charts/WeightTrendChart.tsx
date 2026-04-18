'use client'
// components/charts/WeightTrendChart.tsx

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import type { TooltipProps } from 'recharts'
import { format } from 'date-fns'

interface WeightPoint {
  date: string
  weight: number
}

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="bg-[#1A1A1A] text-white text-xs px-3 py-2 rounded-xl shadow-lg">
      <div className="font-semibold">{entry.value} kg</div>
      <div className="opacity-60">
        {format(new Date((entry.payload as WeightPoint).date), 'MMM d')}
      </div>
    </div>
  )
}

export default function WeightTrendChart({ data }: { data: WeightPoint[] }) {
  const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const chartData = sorted.map((d) => ({
    ...d,
    label: format(new Date(d.date), 'MMM d'),
  }))

  const minW = Math.min(...chartData.map((d) => d.weight)) - 1
  const maxW = Math.max(...chartData.map((d) => d.weight)) + 1

  return (
    <div style={{ height: 100 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -40, bottom: 0 }}>
          <defs>
            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2D6A4F" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#2D6A4F" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: '#8A8A85' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={[minW, maxW]} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="weight"
            stroke="#2D6A4F"
            strokeWidth={2}
            fill="url(#weightGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#2D6A4F', stroke: 'white', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
