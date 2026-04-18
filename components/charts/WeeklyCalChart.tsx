'use client'
// components/charts/WeeklyCalChart.tsx

import {
  BarChart,
  Bar,
  CartesianGrid,
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
  const highestValue = Math.max(target, ...data.map((entry) => entry.calories), 600)
  const chartMax = Math.ceil((highestValue * 1.1) / 100) * 100

  return (
    <div style={{ height: 178 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 6, left: 6, bottom: 0 }}
          barCategoryGap="26%"
        >
          <CartesianGrid vertical={false} stroke="#EEF2F7" strokeDasharray="4 6" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: '#8A8A85', fontFamily: 'Manrope, sans-serif' }}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis hide domain={[0, chartMax]} />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <ReferenceLine
            y={target}
            stroke="#CBD5E1"
            strokeDasharray="4 4"
            strokeWidth={1}
            ifOverflow="extendDomain"
            label={{
              value: 'Target',
              position: 'insideTopRight',
              fill: '#94A3B8',
              fontSize: 10,
            }}
          />
          <Bar
            dataKey="calories"
            radius={[10, 10, 0, 0]}
            barSize={44}
            background={{ fill: 'rgba(15,23,42,0.045)' }}
          >
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={
                  entry.day === today?.day
                    ? '#2D6A4F'
                    : entry.calories >= target
                    ? '#95D5B2'
                    : '#CFE9D8'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
