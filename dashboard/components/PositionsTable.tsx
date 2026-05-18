'use client'

import { useEffect, useState } from 'react'
import { Position, subscribeToPositions } from '@/lib/firestore'

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals)
}

function fmtUSD(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

function fmtPct(entry: number, current: number): string {
  if (entry === 0) return '0.00%'
  const pct = ((current - entry) / entry) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

export default function PositionsTable() {
  const [positions, setPositions] = useState<Position[]>([])

  useEffect(() => {
    const unsub = subscribeToPositions((p) => setPositions(p))
    return unsub
  }, [])

  if (positions.length === 0) {
    return (
      <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-6">
        <h2 className="text-[#f1f5f9] font-semibold text-base mb-4">Open Positions</h2>
        <p className="text-[#94a3b8] text-sm text-center py-6">No open positions</p>
      </div>
    )
  }

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-[#334155]">
        <h2 className="text-[#f1f5f9] font-semibold text-base">
          Open Positions{' '}
          <span className="text-[#94a3b8] font-normal text-sm">({positions.length})</span>
        </h2>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden divide-y divide-[#334155]">
        {positions.map((pos) => {
          const pnlPositive = pos.unrealized_pnl >= 0
          const pnlColor = pnlPositive ? 'text-green-400' : 'text-red-400'
          const pctColor = (pos.current_price - pos.entry_price) >= 0 ? 'text-green-400' : 'text-red-400'
          return (
            <div key={pos.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[#f1f5f9] text-base">{pos.symbol}</span>
                <span className={`font-mono font-semibold text-sm ${pnlColor}`}>
                  {fmtUSD(pos.unrealized_pnl)}{' '}
                  <span className={`text-xs ${pctColor}`}>({fmtPct(pos.entry_price, pos.current_price)})</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                <div><p className="text-[#64748b] uppercase tracking-wide mb-0.5">Entry</p><p className="font-mono text-[#f1f5f9]">${fmt(pos.entry_price)}</p></div>
                <div><p className="text-[#64748b] uppercase tracking-wide mb-0.5">Current</p><p className="font-mono text-[#f1f5f9]">${fmt(pos.current_price)}</p></div>
                <div><p className="text-[#64748b] uppercase tracking-wide mb-0.5">Qty</p><p className="text-[#f1f5f9]">{pos.qty}</p></div>
                <div><p className="text-[#64748b] uppercase tracking-wide mb-0.5">Stop</p><p className="font-mono text-red-400">${fmt(pos.stop_loss)}</p></div>
                <div><p className="text-[#64748b] uppercase tracking-wide mb-0.5">Target</p><p className="font-mono text-green-400">${fmt(pos.take_profit)}</p></div>
                <div><p className="text-[#64748b] uppercase tracking-wide mb-0.5">Setup</p><p className="text-[#94a3b8]">{pos.setup_type}</p></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#334155] text-[#94a3b8] text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Entry</th>
              <th className="px-4 py-3 text-right">Current</th>
              <th className="px-4 py-3 text-right">Unrealized P&L</th>
              <th className="px-4 py-3 text-right">P&L %</th>
              <th className="px-4 py-3 text-right">Stop Loss</th>
              <th className="px-4 py-3 text-right">Take Profit</th>
              <th className="px-4 py-3 text-left">Setup</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]">
            {positions.map((pos) => {
              const pnlPositive = pos.unrealized_pnl >= 0
              const pnlColor = pnlPositive ? 'text-green-400' : 'text-red-400'
              const pctColor = (pos.current_price - pos.entry_price) >= 0 ? 'text-green-400' : 'text-red-400'
              return (
                <tr key={pos.id} className="hover:bg-[#334155]/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-[#f1f5f9]">{pos.symbol}</td>
                  <td className="px-4 py-3 text-right text-[#f1f5f9]">{pos.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#f1f5f9]">${fmt(pos.entry_price)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#f1f5f9]">${fmt(pos.current_price)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${pnlColor}`}>{fmtUSD(pos.unrealized_pnl)}</td>
                  <td className={`px-4 py-3 text-right font-mono text-xs ${pctColor}`}>{fmtPct(pos.entry_price, pos.current_price)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-400">${fmt(pos.stop_loss)}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-400">${fmt(pos.take_profit)}</td>
                  <td className="px-4 py-3 text-left">
                    <span className="inline-block px-2 py-0.5 bg-[#334155] rounded text-xs text-[#94a3b8]">{pos.setup_type}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
