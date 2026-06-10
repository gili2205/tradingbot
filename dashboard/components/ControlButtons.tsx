'use client'

import { useEffect, useState } from 'react'
import { BotConfig, subscribeToBotConfig, togglePaused, toggleDryRun } from '@/lib/firestore'

export default function ControlButtons() {
  const [config, setConfig] = useState<BotConfig | null>(null)
  const [loadingPause, setLoadingPause] = useState(false)
  const [loadingDryRun, setLoadingDryRun] = useState(false)

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

  async function handleDryRunToggle() {
    if (!config) return
    const confirmed = config.dry_run
      ? window.confirm(
          'Enable active trading?\n\nThe bot will start placing real orders on your Alpaca account. ' +
          'Since you configured the paper-trading endpoint, no real money is at risk — ' +
          'but orders will actually be submitted to Alpaca.'
        )
      : window.confirm('Switch bot to dry-run (simulation) mode?\n\nNo orders will be placed until you re-enable trading.')
    if (!confirmed) return

    setLoadingDryRun(true)
    try {
      await toggleDryRun(config.dry_run)
    } catch (err) {
      console.error('Failed to toggle dry run:', err)
    } finally {
      setLoadingDryRun(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
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

      <button
        onClick={handleDryRunToggle}
        disabled={loadingDryRun || !config}
        className={`
          px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${config?.dry_run
            ? 'bg-yellow-600 hover:bg-yellow-500 text-gray-900'
            : 'bg-[#334155] hover:bg-[#475569] text-[#f1f5f9]'
          }
        `}
      >
        {loadingDryRun
          ? 'Updating...'
          : config?.dry_run
          ? 'Dry Run: ON'
          : 'Dry Run: OFF'}
      </button>
    </div>
  )
}
