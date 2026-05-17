'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { BotStatus, subscribeToBotStatus } from '@/lib/firestore'
import BotStatusBar from '@/components/BotStatusBar'
import ControlButtons from '@/components/ControlButtons'
import PositionsTable from '@/components/PositionsTable'
import DecisionsFeed from '@/components/DecisionsFeed'
import PnLChart from '@/components/PnLChart'

function SummaryCard({
  label,
  value,
  valueClass = '',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-5">
      <p className="text-[#94a3b8] text-xs uppercase tracking-wide font-medium mb-2">{label}</p>
      <p className={`text-2xl font-bold font-mono ${valueClass || 'text-[#f1f5f9]'}`}>{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login')
        return
      }
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
    const unsub = subscribeToBotStatus((s) => setStatus(s))
    return unsub
  }, [authReady])

  function fmtPnl(val: number): { display: string; cls: string } {
    const sign = val >= 0 ? '+' : ''
    return {
      display: `${sign}$${val.toFixed(2)}`,
      cls: val >= 0 ? 'text-green-400' : 'text-red-400',
    }
  }

  const pnl = fmtPnl(status?.daily_pnl ?? 0)

  return (
    <div className="space-y-5">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Daily P&L"
          value={pnl.display}
          valueClass={pnl.cls}
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
