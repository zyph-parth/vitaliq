'use client'
// components/charts/WeeklyCalChart.tsx

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'

interface DataPoint {
  day: string
  calories: number
}

interface WeeklyCalChartProps {
  data: DataPoint[]
  target: number
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A1A1A] text-white text-xs px-3 py-2 rounded-xl shadow-lg">
      <div className="font-semibold">{label}</div>
      <div>{payload[0].value.toLocaleString()} kcal</div>
    </div>
  )
}

export default function WeeklyCalChart({ data, target }: WeeklyCalChartProps) {
  const today = data[data.length - 1]

  return (
    <div style={{ height: 130 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: -30, bottom: 0 }} barCategoryGap="30%">
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: '#8A8A85', fontFamily: 'Manrope, sans-serif' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }} />
          <ReferenceLine
            y={target}
            stroke="#E8E8E3"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={
                  entry.day === today?.day
                    ? '#2D6A4F'
                    : entry.calories >= target
                    ? '#95D5B2'
                    : '#D8F3DC'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
