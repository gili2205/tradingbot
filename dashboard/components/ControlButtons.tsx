'use client'

import { useEffect, useState } from 'react'
import { BotConfig, subscribeToBotConfig, togglePaused } from '@/lib/firestore'

export default function ControlButtons() {
  const [config, setConfig] = useState<BotConfig | null>(null)
  const [loadingPause, setLoadingPause] = useState(false)

  useEffect(() => {
    const unsub = subscribeToBotConfig((c) => setConfig(c))
    return unsub
  }, [])

  async function handlePauseToggle() {
    if (!config) return
    setLoadingPause(true)
    try {
      await togglePaused(config.paused)
    } catch (err) {
      console.error('Failed to toggle pause:', err)
    } finally {
      setLoadingPause(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* Trading mode badge */}
      <div className="flex items-center gap-1.5">
        <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 text-white">
          Paper Trading
        </span>
        <span
          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#1e293b] border border-[#334155] text-[#475569] cursor-not-allowed"
          title="Real money trading — coming soon"
        >
          Real Trading
        </span>
      </div>

      <button
        onClick={handlePauseToggle}
        disabled={loadingPause || !config}
        className={`
          px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${config?.paused
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-red-600 hover:bg-red-500 text-white'
          }
        `}
      >
        {loadingPause
          ? 'Updating...'
          : config?.paused
          ? 'Resume Bot'
          : 'Pause Bot'}
      </button>
    </div>
  )
}
