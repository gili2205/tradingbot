'use client'

import { useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import {
  BotConfig,
  DEFAULT_CONFIG,
  subscribeToBotConfig,
  saveBotConfig,
} from '@/lib/firestore'

interface ToastState {
  message: string
  type: 'success' | 'error'
}

type TickerStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'duplicate'

function NumberInput({
  label,
  value,
  onChange,
  description,
  min,
  max,
  step = 'any',
  prefix,
  suffix,
}: {
  label: string
  value: number
  onChange: (val: number) => void
  description?: string
  min?: number
  max?: number
  step?: number | string
  prefix?: string
  suffix?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-[#f1f5f9]">{label}</label>
      {description && <p className="text-[#94a3b8] text-xs">{description}</p>}
      <div className="relative mt-1">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full bg-[#0f172a] border border-[#334155] rounded-lg py-2 text-[#f1f5f9] text-sm focus:outline-none focus:border-[#3b82f6] transition-colors ${
            prefix ? 'pl-7 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'
          }`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-5">
      <h2 className="text-[#f1f5f9] font-semibold text-base mb-4 pb-3 border-b border-[#334155]">
        {title}
      </h2>
      {children}
    </div>
  )
}

async function validateTicker(symbol: string): Promise<{ valid: boolean; name?: string; error?: string; warning?: string }> {
  const res = await fetch(`/api/validate-ticker?symbol=${encodeURIComponent(symbol)}`)
  return res.json()
}

export default function ConfigPage() {
  const router = useRouter()
  const [form, setForm] = useState<BotConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [newSymbol, setNewSymbol] = useState('')
  const [tickerStatus, setTickerStatus] = useState<TickerStatus>('idle')
  const [tickerError, setTickerError] = useState('')
  const [tickerName, setTickerName] = useState('')

  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      setAuthReady(true)
    })
    return unsub
  }, [router])

  useEffect(() => {
    if (!authReady) return
    const unsub = subscribeToBotConfig((config) => {
      setForm(config)
      setLoading(false)
    })
    return unsub
  }, [authReady])

  // Reset ticker validation state when input changes
  useEffect(() => {
    setTickerStatus('idle')
    setTickerError('')
    setTickerName('')
  }, [newSymbol])

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  function set<K extends keyof BotConfig>(key: K, value: BotConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleReset() {
    setForm(DEFAULT_CONFIG)
    showToast('Form reset to defaults. Click Save to apply.', 'success')
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveBotConfig(form)
      showToast('Configuration saved successfully.', 'success')
    } catch (err) {
      console.error(err)
      showToast('Failed to save configuration. Check console for details.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddSymbol() {
    const sym = newSymbol.trim().toUpperCase()
    if (!sym) return

    if (form.watchlist.includes(sym)) {
      setTickerStatus('duplicate')
      setTickerError(`${sym} is already in the watchlist`)
      return
    }

    setTickerStatus('checking')
    setTickerError('')
    setTickerName('')

    try {
      const result = await validateTicker(sym)
      if (result.valid) {
        setTickerStatus('valid')
        setTickerName(result.name ?? sym)
        set('watchlist', [...form.watchlist, sym])
        setNewSymbol('')
        // Reset status after brief success flash
        setTimeout(() => setTickerStatus('idle'), 1500)
      } else {
        setTickerStatus('invalid')
        setTickerError(result.error ?? `${sym} is not a valid tradeable symbol`)
      }
    } catch {
      // Network error — add the ticker anyway, don't block the user
      set('watchlist', [...form.watchlist, sym])
      setNewSymbol('')
      setTickerStatus('idle')
    }
  }

  function removeSymbol(sym: string) {
    set('watchlist', form.watchlist.filter((s) => s !== sym))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[#94a3b8] text-sm">Loading configuration...</div>
      </div>
    )
  }

  const inputBorderClass =
    tickerStatus === 'invalid' || tickerStatus === 'duplicate'
      ? 'border-red-500 focus:border-red-400'
      : tickerStatus === 'valid'
      ? 'border-green-500 focus:border-green-400'
      : 'border-[#334155] focus:border-[#3b82f6]'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-[#f1f5f9]">Bot Configuration</h1>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-[#94a3b8] hover:text-[#f1f5f9] bg-[#1e293b] border border-[#334155] rounded-lg transition-colors hover:bg-[#334155]"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold text-white bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-900/40 border border-green-700 text-green-300'
              : 'bg-red-900/40 border border-red-700 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      <SectionCard title="Risk Parameters">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberInput
            label="Max Risk Per Trade"
            value={form.max_risk_per_trade}
            onChange={(v) => set('max_risk_per_trade', v)}
            description="Maximum dollar risk on a single trade"
            min={0}
            prefix="$"
          />
          <NumberInput
            label="Max Concurrent Positions"
            value={form.max_concurrent_positions}
            onChange={(v) => set('max_concurrent_positions', Math.round(v))}
            description="Maximum number of open positions at once"
            min={1}
            max={20}
            step={1}
          />
          <NumberInput
            label="Max Daily Capital"
            value={form.max_daily_capital}
            onChange={(v) => set('max_daily_capital', v)}
            description="Maximum capital deployed per day"
            min={0}
            prefix="$"
          />
          <NumberInput
            label="Account Size"
            value={form.account_size}
            onChange={(v) => set('account_size', v)}
            description="Total account equity"
            min={0}
            prefix="$"
          />
          <NumberInput
            label="Daily Drawdown Limit"
            value={form.daily_drawdown_limit}
            onChange={(v) => set('daily_drawdown_limit', v)}
            description="Maximum daily loss before bot pauses"
            min={0}
            prefix="$"
          />
          <NumberInput
            label="Min Signal Confidence"
            value={form.min_signal_confidence}
            onChange={(v) => set('min_signal_confidence', Math.round(v))}
            description="Minimum confidence score to enter a trade (1–10)"
            min={1}
            max={10}
            step={1}
          />
          <NumberInput
            label="Min Reward-to-Risk Ratio"
            value={form.min_reward_to_risk}
            onChange={(v) => set('min_reward_to_risk', v)}
            description="Minimum required R:R ratio for entry"
            min={0.1}
            step={0.1}
            suffix="R"
          />
          <NumberInput
            label="Max Spread %"
            value={form.max_spread_pct}
            onChange={(v) => set('max_spread_pct', v)}
            description="Maximum bid-ask spread as a fraction"
            min={0}
            step={0.001}
          />
        </div>
      </SectionCard>

      <SectionCard title={`Watchlist (${form.watchlist.length} symbols)`}>
        <div className="space-y-4">
          {/* Ticker chips */}
          <div className="flex flex-wrap gap-2">
            {form.watchlist.map((sym) => (
              <span
                key={sym}
                className="inline-flex items-center gap-1.5 bg-[#334155] rounded px-2.5 py-1 text-sm font-mono text-[#f1f5f9]"
              >
                {sym}
                <button
                  type="button"
                  onClick={() => removeSymbol(sym)}
                  className="text-[#94a3b8] hover:text-red-400 transition-colors leading-none"
                  aria-label={`Remove ${sym}`}
                >
                  ×
                </button>
              </span>
            ))}
            {form.watchlist.length === 0 && (
              <span className="text-[#94a3b8] text-sm">No symbols in watchlist</span>
            )}
          </div>

          {/* Add input */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
                  placeholder="Add symbol (e.g. AAPL)"
                  maxLength={10}
                  className={`w-full bg-[#0f172a] border rounded-lg px-3 py-2 text-[#f1f5f9] text-sm font-mono focus:outline-none transition-colors placeholder-[#475569] ${inputBorderClass} ${
                    tickerStatus === 'checking' ? 'pr-10' : ''
                  }`}
                />
                {/* Spinner while checking */}
                {tickerStatus === 'checking' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin h-4 w-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  </span>
                )}
                {/* Valid checkmark */}
                {tickerStatus === 'valid' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-base">✓</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddSymbol}
                disabled={tickerStatus === 'checking' || !newSymbol.trim()}
                className="px-4 py-2 bg-[#334155] hover:bg-[#475569] text-[#f1f5f9] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tickerStatus === 'checking' ? 'Checking…' : 'Add'}
              </button>
            </div>

            {/* Error message */}
            {(tickerStatus === 'invalid' || tickerStatus === 'duplicate') && tickerError && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <span>✗</span>
                <span>{tickerError}</span>
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end gap-3 pb-6">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-[#94a3b8] hover:text-[#f1f5f9] bg-[#1e293b] border border-[#334155] rounded-lg transition-colors hover:bg-[#334155]"
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 text-sm font-semibold text-white bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  )
}
