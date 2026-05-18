'use client'

import { useEffect, useState } from 'react'
import { Decision, subscribeToDecisions } from '@/lib/firestore'
import { Timestamp } from 'firebase/firestore'

function formatTime(ts: Timestamp): string {
  return ts.toDate().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function actionBadge(action: Decision['action']): JSX.Element {
  const styles: Record<Decision['action'], string> = {
    BUY: 'bg-blue-600 text-white',
    SELL: 'bg-orange-500 text-white',
    PARTIAL_SELL: 'bg-yellow-500 text-gray-900',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-bold tracking-wide ${styles[action]}`}
    >
      {action.replace('_', ' ')}
    </span>
  )
}

interface DecisionsFeedProps {
  limit?: number
}

export default function DecisionsFeed({ limit = 20 }: DecisionsFeedProps) {
  const [decisions, setDecisions] = useState<Decision[]>([])

  useEffect(() => {
    const unsub = subscribeToDecisions(limit, (d) => setDecisions(d))
    return unsub
  }, [limit])

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-[#334155]">
        <h2 className="text-[#f1f5f9] font-semibold text-base">Recent Decisions</h2>
      </div>
      {decisions.length === 0 ? (
        <p className="text-[#94a3b8] text-sm text-center py-8">No decisions recorded yet</p>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden divide-y divide-[#334155]">
            {decisions.map((d) => {
              const hasPnl = d.pnl !== null && d.pnl !== undefined
              const pnlColor = hasPnl && d.pnl! >= 0 ? 'text-green-400' : 'text-red-400'
              return (
                <div key={d.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#f1f5f9]">{d.symbol}</span>
                      {actionBadge(d.action)}
                    </div>
                    <span className={`font-mono text-sm font-semibold ${hasPnl ? pnlColor : 'text-[#475569]'}`}>
                      {hasPnl ? `${d.pnl! >= 0 ? '+' : ''}$${d.pnl!.toFixed(2)}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#94a3b8]">
                    <span className="font-mono">{formatTime(d.ts)}</span>
                    <span>${d.price.toFixed(2)}</span>
                    <span>×{d.qty}</span>
                    <span>conf {d.confidence}/10</span>
                  </div>
                  {d.reasoning && (
                    <p className="text-xs text-[#64748b] line-clamp-2">{d.reasoning}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#334155] text-[#94a3b8] text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Symbol</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Conf</th>
                  <th className="px-4 py-3 text-right">P&L</th>
                  <th className="px-4 py-3 text-left">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {decisions.map((d) => {
                  const hasPnl = d.pnl !== null && d.pnl !== undefined
                  const pnlColor = hasPnl && d.pnl! >= 0 ? 'text-green-400' : 'text-red-400'
                  return (
                    <tr key={d.id} className="hover:bg-[#334155]/40 transition-colors">
                      <td className="px-4 py-2.5 text-[#94a3b8] font-mono text-xs whitespace-nowrap">{formatTime(d.ts)}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-[#f1f5f9]">{d.symbol}</td>
                      <td className="px-4 py-2.5">{actionBadge(d.action)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#f1f5f9]">${d.price.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-[#f1f5f9]">{d.qty}</td>
                      <td className="px-4 py-2.5 text-right"><span className="text-[#94a3b8]">{d.confidence}/10</span></td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold ${hasPnl ? pnlColor : 'text-[#475569]'}`}>
                        {hasPnl ? `${d.pnl! >= 0 ? '+' : ''}$${d.pnl!.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[#94a3b8] max-w-xs truncate">{d.reasoning}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
