'use client'

import { useEffect, useState } from 'react'
import { BotStatus, subscribeToBotStatus } from '@/lib/firestore'
import { Timestamp } from 'firebase/firestore'

function isOffline(lastHeartbeat: Timestamp | null): boolean {
  if (!lastHeartbeat) return true
  const now = Date.now()
  const hbMs = lastHeartbeat.toMillis()
  return now - hbMs > 2 * 60 * 1000
}

function formatHeartbeat(ts: Timestamp | null): string {
  if (!ts) return 'Never'
  const date = ts.toDate()
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function getStatusLabel(status: BotStatus | null): string {
  if (!status) return 'Offline'
  if (isOffline(status.last_heartbeat)) return 'Offline'
  if (status.mode === 'paused') return 'Paused'
  if (status.mode === 'dry_run') return 'Dry Run'
  if (status.mode === 'live') return 'Live'
  return 'Unknown'
}

function getStatusColor(status: BotStatus | null): string {
  if (!status || isOffline(status.last_heartbeat)) return 'bg-gray-500 text-gray-100'
  if (status.mode === 'paused') return 'bg-red-500 text-white'
  if (status.mode === 'dry_run') return 'bg-yellow-500 text-gray-900'
  if (status.mode === 'live') return 'bg-green-500 text-white'
  return 'bg-gray-500 text-gray-100'
}

function getDotColor(status: BotStatus | null): string {
  if (!status || isOffline(status.last_heartbeat)) return 'bg-gray-400'
  if (status.mode === 'paused') return 'bg-red-400'
  if (status.mode === 'dry_run') return 'bg-yellow-400'
  if (status.mode === 'live') return 'bg-green-400'
  return 'bg-gray-400'
}

export default function BotStatusBar() {
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const unsub = subscribeToBotStatus((s) => setStatus(s))
    const interval = setInterval(() => forceUpdate((n) => n + 1), 15000)
    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [])

  const label = getStatusLabel(status)
  const pillColor = getStatusColor(status)
  const dotColor = getDotColor(status)
  const offline = !status || isOffline(status.last_heartbeat)

  return (
    <div className="flex items-center justify-between bg-[#1e293b] border border-[#334155] rounded-lg px-5 py-3">
      <div className="flex items-center gap-4">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${pillColor}`}
        >
          <span className={`w-2 h-2 rounded-full ${dotColor} ${!offline && status?.mode === 'live' ? 'animate-pulse' : ''}`} />
          {label}
        </span>
        {status && (
          <span className="text-[#94a3b8] text-sm">
            Mode:{' '}
            <span className="text-[#f1f5f9] font-medium capitalize">
              {status.mode.replace('_', ' ')}
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-6 text-sm text-[#94a3b8]">
        {status?.session_date && (
          <span>
            Session:{' '}
            <span className="text-[#f1f5f9] font-medium">{status.session_date}</span>
          </span>
        )}
        <span>
          Last Heartbeat:{' '}
          <span className={`font-medium ${offline ? 'text-red-400' : 'text-[#f1f5f9]'}`}>
            {formatHeartbeat(status?.last_heartbeat ?? null)}
          </span>
        </span>
        {status?.pid && (
          <span>
            PID: <span className="text-[#f1f5f9] font-mono">{status.pid}</span>
          </span>
        )}
      </div>
    </div>
  )
}
