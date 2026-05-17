import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QuerySnapshot,
} from 'firebase/firestore'
import { db } from './firebase'

// ---- Types ----

export interface BotConfig {
  paused: boolean
  dry_run: boolean
  max_risk_per_trade: number
  max_concurrent_positions: number
  max_daily_capital: number
  account_size: number
  daily_drawdown_limit: number
  min_signal_confidence: number
  min_reward_to_risk: number
  max_spread_pct: number
  watchlist: string[]
  updated_at?: Timestamp
}

export interface BotStatus {
  running: boolean
  last_heartbeat: Timestamp | null
  pid: number
  mode: 'live' | 'dry_run' | 'paused'
  deployed_today: number
  daily_pnl: number
  trades_today: number
  open_positions_count: number
  session_date: string
}

export interface Decision {
  id: string
  symbol: string
  action: 'BUY' | 'SELL' | 'PARTIAL_SELL'
  price: number
  qty: number
  stop_loss: number
  take_profit: number
  pnl: number | null
  reasoning: string
  setup_type: string
  confidence: number
  signal_score: number
  ts: Timestamp
  date: string
}

export interface Position {
  id: string
  symbol: string
  qty: number
  entry_price: number
  current_price: number
  unrealized_pnl: number
  stop_loss: number
  take_profit: number
  entry_ts: string
  setup_type: string
}

export interface DailySummary {
  id: string
  date: string
  trades: number
  wins: number
  losses: number
  gross_pnl: number
  net_pnl: number
  notes: string
}

// ---- Default Config ----

export const DEFAULT_CONFIG: BotConfig = {
  paused: false,
  dry_run: false,
  max_risk_per_trade: 100.0,
  max_concurrent_positions: 4,
  max_daily_capital: 4000.0,
  account_size: 10000.0,
  daily_drawdown_limit: 200.0,
  min_signal_confidence: 6,
  min_reward_to_risk: 2.0,
  max_spread_pct: 0.02,
  watchlist: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META', 'SPY'],
}

// ---- Snapshot Listeners ----

export function subscribeToBotConfig(callback: (config: BotConfig) => void): () => void {
  const ref = doc(db, 'config', 'bot')
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_CONFIG, ...snap.data() } as BotConfig)
    } else {
      callback(DEFAULT_CONFIG)
    }
  })
}

export function subscribeToBotStatus(callback: (status: BotStatus) => void): () => void {
  const ref = doc(db, 'status', 'bot')
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as BotStatus)
    }
  })
}

export function subscribeToPositions(callback: (positions: Position[]) => void): () => void {
  const ref = collection(db, 'positions')
  return onSnapshot(ref, (snap: QuerySnapshot<DocumentData>) => {
    const positions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Position))
    callback(positions)
  })
}

export function subscribeToDecisions(
  count: number,
  callback: (decisions: Decision[]) => void
): () => void {
  const ref = query(collection(db, 'decisions'), orderBy('ts', 'desc'), limit(count))
  return onSnapshot(ref, (snap: QuerySnapshot<DocumentData>) => {
    const decisions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Decision))
    callback(decisions)
  })
}

export function subscribeToDailySummaries(
  days: number,
  callback: (summaries: DailySummary[]) => void
): () => void {
  const ref = query(collection(db, 'daily_summary'), orderBy('date', 'desc'), limit(days))
  return onSnapshot(ref, (snap: QuerySnapshot<DocumentData>) => {
    const summaries = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailySummary))
    callback(summaries.reverse())
  })
}

// ---- Write Functions ----

export async function updateBotConfig(updates: Partial<BotConfig>): Promise<void> {
  const ref = doc(db, 'config', 'bot')
  await setDoc(ref, { ...updates, updated_at: Timestamp.now() }, { merge: true })
}

export async function saveBotConfig(config: BotConfig): Promise<void> {
  const ref = doc(db, 'config', 'bot')
  await setDoc(ref, { ...config, updated_at: Timestamp.now() })
}

export async function togglePaused(currentPaused: boolean): Promise<void> {
  await updateBotConfig({ paused: !currentPaused })
}

export async function toggleDryRun(currentDryRun: boolean): Promise<void> {
  await updateBotConfig({ dry_run: !currentDryRun })
}
