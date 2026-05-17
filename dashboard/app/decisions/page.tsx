'use client'

import { useEffect, useState, useMemo } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { Decision, subscribeToDecisions } from '@/lib/firestore'
import { Timestamp } from 'firebase/firestore'

type ActionFilter = 'ALL' | 'BUY' | 'SELL'
type DateFilter = 'today' | '7days' | 'all'

function formatDateTime(ts: Timestamp): string {
  const d = ts.toDate()
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
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

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function get7DaysAgo(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function DecisionsPage() {
  const router = useRouter()
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL')
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login')
    })
    return unsub
  }, [router])

  useEffect(() => {
    const unsub = subscribeToDecisions(100, (d) => {
      setDecisions(d)
      setLoading(false)
    })
    return unsub
  }, [])

  const filtered = useMemo(() => {
    let list = decisions

    if (actionFilter !== 'ALL') {
      list = list.filter((d) => {
        if (actionFilter === 'SELL') return d.action === 'SELL' || d.action === 'PARTIAL_SELL'
        return d.action === actionFilter
      })
    }

    if (dateFilter === 'today') {
      const today = getTodayStr()
      list = list.filter((d) => d.date === today)
    } else if (dateFilter === '7days') {
      const cutoff = get7DaysAgo()
      list = list.filter((d) => d.ts.toDate() >= cutoff)
    }

    return list
  }, [decisions, actionFilter, dateFilter])

  const totalPnl = useMemo(
    () =>
      filtered.reduce((sum, d) => {
        if (d.pnl !== null && d.pnl !== undefined) return sum + d.pnl
        return sum
      }, 0),
    [filtered]
  )

  const pnlColor = totalPnl >= 0 ? 'text-green-400' : 'text-red-400'

  const filterBtnClass = (active: boolean) =>
    `px-3 py-1.5 rounded text-xs font-medium transition-colors ${
      active
        ? 'bg-[#3b82f6] text-white'
        : 'bg-[#1e293b] text-[#94a3b8] hover:text-[#f1f5f9] border border-[#334155] hover:bg-[#334155]'
    }`

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-[#f1f5f9]">Trade Log</h1>

      <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[#94a3b8] text-xs uppercase tracking-wide">Action</span>
            <div className="flex gap-1">
              {(['ALL', 'BUY', 'SELL'] as ActionFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setActionFilter(f)}
                  className={filterBtnClass(actionFilter === f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#94a3b8] text-xs uppercase tracking-wide">Date</span>
            <div className="flex gap-1">
              <button
                onClick={() => setDateFilter('today')}
                className={filterBtnClass(dateFilter === 'today')}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter('7days')}
                className={filterBtnClass(dateFilter === '7days')}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={filterBtnClass(dateFilter === 'all')}
              >
                All
              </button>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-[#94a3b8]">
              {filtered.length} trade{filtered.length !== 1 ? 's' : ''}
            </span>
            <span>
              <span className="text-[#94a3b8]">Realized P&L: </span>
              <span className={`font-mono font-semibold ${pnlColor}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="bg-[#1e293b] border border-[#334155] rounded-lg overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[#94a3b8] text-sm">Loading decisions...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-[#94a3b8] text-sm">
            No decisions match current filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#334155] text-[#94a3b8] text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left whitespace-nowrap">Date / Time</th>
                  <th className="px-4 py-3 text-left">Symbol</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Conf</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-left">Setup</th>
                  <th className="px-4 py-3 text-right">P&L</th>
                  <th className="px-4 py-3 text-left">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {filtered.map((d) => {
                  const hasPnl = d.pnl !== null && d.pnl !== undefined
                  const pnlColor = hasPnl && d.pnl! >= 0 ? 'text-green-400' : 'text-red-400'

                  return (
                    <tr key={d.id} className="hover:bg-[#334155]/40 transition-colors">
                      <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs whitespace-nowrap">
                        {formatDateTime(d.ts)}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-[#f1f5f9]">
                        {d.symbol}
                      </td>
                      <td className="px-4 py-3">{actionBadge(d.action)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#f1f5f9]">
                        ${d.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#f1f5f9]">{d.qty}</td>
                      <td className="px-4 py-3 text-right text-[#94a3b8]">{d.confidence}/10</td>
                      <td className="px-4 py-3 text-right text-[#94a3b8]">{d.signal_score}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 bg-[#334155] rounded text-xs text-[#94a3b8]">
                          {d.setup_type}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-semibold ${
                          hasPnl ? pnlColor : 'text-[#475569]'
                        }`}
                      >
                        {hasPnl
                          ? `${d.pnl! >= 0 ? '+' : ''}$${d.pnl!.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8] max-w-xs">
                        <span className="line-clamp-2 text-xs">{d.reasoning}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
