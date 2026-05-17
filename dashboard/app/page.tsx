'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import {
  BotStatus,
  BotConfig,
  DailySummary,
  subscribeToBotStatus,
  subscribeToBotConfig,
  subscribeToDailySummaries,
} from '@/lib/firestore'
import BotStatusBar from '@/components/BotStatusBar'
import ControlButtons from '@/components/ControlButtons'
import PositionsTable from '@/components/PositionsTable'
import DecisionsFeed from '@/components/DecisionsFeed'
import PnLChart from '@/components/PnLChart'

function SummaryCard({
  label,
  value,
  sub,
  valueClass = '',
  subClass = '',
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
  subClass?: string
}) {
  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-5">
      <p className="text-[#94a3b8] text-xs uppercase tracking-wide font-medium mb-2">{label}</p>
      <p className={`text-2xl font-bold font-mono ${valueClass || 'text-[#f1f5f9]'}`}>{value}</p>
      {sub && <p className={`text-sm font-mono mt-1 ${subClass || 'text-[#64748b]'}`}>{sub}</p>}
    </div>
  )
}

function Section({ title }: { title: string }) {
  return (
    <p className="text-xs uppercase tracking-widest text-[#475569] font-semibold pt-2">{title}</p>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [config, setConfig] = useState<BotConfig | null>(null)
  const [summaries, setSummaries] = useState<DailySummary[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      const authorizedEmail = process.env.NEXT_PUBLIC_AUTHORIZED_EMAIL
      if (authorizedEmail && user.email !== authorizedEmail) {
        signOut(auth)
        router.push('/login?error=unauthorized')
        return
      }
      setUserEmail(user.email)
      setAuthReady(true)
    })
    return unsubAuth
  }, [router])

  useEffect(() => {
    if (!authReady) return
    const u1 = subscribeToBotStatus((s) => setStatus(s))
    const u2 = subscribeToBotConfig((c) => setConfig(c))
    const u3 = subscribeToDailySummaries(365, (s) => setSummaries(s))
    return () => { u1(); u2(); u3() }
  }, [authReady])

  const accountSize = config?.account_size ?? 10000

  // ── Daily stats ──────────────────────────────────────────────────────────────
  const dailyPnl = status?.daily_pnl ?? 0
  const dailyPct = accountSize > 0 ? (dailyPnl / accountSize) * 100 : 0
  const dailySign = dailyPnl >= 0 ? '+' : ''
  const dailyPnlColor = dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'

  // ── All-time stats ───────────────────────────────────────────────────────────
  const totalNetPnl = summaries.reduce((s, d) => s + (d.net_pnl ?? 0), 0)
  const totalTrades = summaries.reduce((s, d) => s + (d.trades ?? 0), 0)
  const totalWins   = summaries.reduce((s, d) => s + (d.wins ?? 0), 0)
  const totalDays   = summaries.length
  const winRate     = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0
  const profitDays  = summaries.filter((d) => d.net_pnl > 0).length
  const totalPct    = accountSize > 0 ? (totalNetPnl / accountSize) * 100 : 0
  const totalSign   = totalNetPnl >= 0 ? '+' : ''
  const totalPnlColor = totalNetPnl >= 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#f1f5f9]">Overview</h1>
        <div className="flex items-center gap-4">
          <ControlButtons />
          {userEmail && (
            <button
              onClick={() => {
                signOut(auth).then(() => {
                  document.cookie = 'session=; Max-Age=0; path=/'
                  router.push('/login')
                })
              }}
              className="text-xs text-[#94a3b8] hover:text-[#f1f5f9] transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      {authReady && <BotStatusBar />}

      <Section title="Today" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Daily P&L"
          value={`${dailySign}$${dailyPnl.toFixed(2)}`}
          sub={`${dailySign}${dailyPct.toFixed(2)}%`}
          valueClass={dailyPnlColor}
          subClass={dailyPnlColor}
        />
        <SummaryCard
          label="Deployed Today"
          value={`$${(status?.deployed_today ?? 0).toFixed(2)}`}
        />
        <SummaryCard
          label="Trades Today"
          value={String(status?.trades_today ?? 0)}
        />
        <SummaryCard
          label="Open Positions"
          value={String(status?.open_positions_count ?? 0)}
        />
      </div>

      <Section title="All Time" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total P&L"
          value={`${totalSign}$${totalNetPnl.toFixed(2)}`}
          sub={`${totalSign}${totalPct.toFixed(2)}%`}
          valueClass={totalPnlColor}
          subClass={totalPnlColor}
        />
        <SummaryCard
          label="Total Trades"
          value={String(totalTrades)}
        />
        <SummaryCard
          label="Win Rate"
          value={totalTrades > 0 ? `${winRate.toFixed(1)}%` : '—'}
          sub={totalTrades > 0 ? `${totalWins}W / ${totalTrades - totalWins}L` : undefined}
        />
        <SummaryCard
          label="Profit Days"
          value={totalDays > 0 ? `${profitDays} / ${totalDays}` : '—'}
          sub={totalDays > 0 ? `${((profitDays / totalDays) * 100).toFixed(0)}% green days` : undefined}
        />
      </div>

      {authReady && <PositionsTable />}

      {authReady && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <DecisionsFeed limit={20} />
          </div>
          <div>
            <PnLChart />
          </div>
        </div>
      )}
    </div>
  )
}
