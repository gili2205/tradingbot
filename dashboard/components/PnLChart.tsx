'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { DailySummary, subscribeToDailySummaries } from '@/lib/firestore'

interface ChartData {
  date: string
  pnl: number
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${month}/${day}`
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const val = payload[0].value
  const color = val >= 0 ? '#4ade80' : '#f87171'
  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded px-3 py-2 text-sm shadow-lg">
      <p className="text-[#94a3b8] mb-1">{label}</p>
      <p className="font-semibold" style={{ color }}>
        {val >= 0 ? '+' : ''}${val.toFixed(2)}
      </p>
    </div>
  )
}

export default function PnLChart() {
  const [data, setData] = useState<ChartData[]>([])

  useEffect(() => {
    const unsub = subscribeToDailySummaries(7, (summaries: DailySummary[]) => {
      setData(
        summaries.map((s) => ({
          date: formatDate(s.date),
          pnl: s.gross_pnl,
        }))
      )
    })
    return unsub
  }, [])

  const totalPnl = data.reduce((sum, d) => sum + d.pnl, 0)
  const totalColor = totalPnl >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[#f1f5f9] font-semibold text-base">7-Day P&L</h2>
        <span className={`font-mono font-semibold text-sm ${totalColor}`}>
          {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} total
        </span>
      </div>

      {data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-[#94a3b8] text-sm">
          No data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
