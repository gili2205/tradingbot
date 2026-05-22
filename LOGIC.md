# Trading Bot — Decision Logic

A complete walkthrough of how the bot thinks, what data it uses, and how every trade decision is made.

---

## Core Philosophy

> **Survive first. Profit second.**

The bot is a systematic, multi-layer risk machine that uses Claude as its final decision-maker. Claude provides judgment on setup quality — but position sizing, risk limits, and execution are all enforced mechanically regardless of what Claude says.

---

## The Full Pipeline (Every 10 Minutes)

```
UNIVERSE BUILDING  →  TECHNICAL SCORING  →  DATA ENRICHMENT
       ↓
MACRO CONTEXT  →  MECHANICAL PRE-FILTERS  →  CLAUDE AI DECISION
       ↓
EXECUTION RISK GATES  →  ORDER PLACEMENT  →  POSITION MANAGEMENT
```

---

## Step 1 — Build the Universe (~150 Stocks)

The bot doesn't just scan the fixed watchlist. Every cycle it builds a 150-stock universe from four sources:

| Source | Count | Logic |
|---|---|---|
| Fixed watchlist | ~75 | Always included — high-liquidity names you've chosen |
| Momentum screen | 50 | All NYSE/NASDAQ stocks scored by `dollar_volume × price_movement`, top 50 |
| Most actives | 30 | Top stocks by share volume — institutional interest signal |
| Gainers | 20 | Top stocks by % change — catalyst/news plays |

**Minimum requirements to enter the universe:**
- Price: $3–$500
- Daily dollar volume: ≥ $5M
- Price movement: ≥ 0.5%

---

## Step 2 — Score Every Stock (39 Technical Indicators)

For each stock, the bot fetches 5-minute and daily price bars and computes a **signal_score (0–10)**:

**Trend factors:**
- Price vs. VWAP (above = bullish bias)
- Price vs. 9 EMA and 20 EMA
- EMA alignment (9 > 20 = trending)
- MACD histogram direction and momentum

**Volume factors:**
- `vol_ratio` = intraday volume vs. time-adjusted average (>1.5 = institutional flow)
- Volume trend over last 5 bars

**Structure factors:**
- Distance from previous day high/low
- Pre-market high/low as support/resistance
- Bollinger Band position
- ATR as % of price (volatility regime)

**Gate:** Only stocks scoring ≥ 5.0 are passed forward. Everything below is discarded before Claude ever sees it.

---

## Step 3 — Read the Macro Environment

Before any trade decision, the bot checks four macro layers:

### VIX Regime (SPY 10-day realized volatility)
| Volatility | Label | Position Size Multiplier |
|---|---|---|
| > 30% | Extreme fear | 0.40× |
| 20–30% | Elevated | 0.70× |
| 13–20% | Normal | 0.90× |
| < 13% | Calm | 1.10× |

### Yield Curve
- 10-year vs. 3-month spread
- Inverted curve → additional size reduction (multiplied with VIX factor)

### Market Structure (SPY vs. Yesterday)
| Posture | Condition | Meaning |
|---|---|---|
| `above_pdh` | SPY > yesterday's high | Bullish momentum — full size |
| `near_pdh` | Within 0.5% of yesterday's high | Approaching resistance — cautious |
| `mid_range` | Neutral | Normal conditions |
| `near_pdl` | Within 0.5% of yesterday's low | Approaching support — reduce exposure |
| `below_pdl` | SPY < yesterday's low | Weakness — stand aside or minimal exposure |

### Intraday Regime (SPY 5-minute analysis)
- **Trending** — directional consistency, ATR expanding → full trading
- **Ranging** — price oscillating in band → mean-reversion setups only
- **Choppy** — conflicting signals, low conviction → no new entries

### Sector Rotation
- Day-over-day % change for all 8 sector ETFs
- Leading sectors get priority; lagging sectors avoided

---

## Step 4 — Enrich with Alternative Data

For the top candidates, 6 data feeds run in parallel (20-second timeout, fail-open):

| Feed | Signal |
|---|---|
| **News headlines** | Is there a catalyst? Earnings surprise, FDA decision, deal? |
| **Options flow** | Unusual call/put buying = smart money positioning |
| **Insider buying** | Executives buying their own stock in last 7 days |
| **Dark pool signals** | Large off-exchange block trades (institutional conviction) |
| **Short interest** | High short % = squeeze potential on momentum |
| **Pre-market data** | Gap size, gap direction, key support/resistance levels |

---

## Step 5 — Mechanical Pre-Filters

These rules reject candidates **before Claude sees them** — no AI judgment involved:

| Filter | Rule | Reason |
|---|---|---|
| **Earnings blackout** | Skip if earnings within 2 calendar days | Binary gap risk |
| **Cooling symbols** | Skip if win rate < 25% in last 10 trades | Negative expectancy |
| **Sector bucket full** | Skip if sector already has an open position | Concentration risk |
| **15-min alignment gate** | For momentum/breakout setups: EMA + VWAP + MACD must all be bullish. Exception: stocks with signal_score ≥ 8.5 only need 2/3 — a near-perfect score shouldn't be blocked by one lagging indicator | Avoids weak breakouts |
| **Setup suppression** | Skip setup type if it has negative expectancy today | Rule 19 enforcement |

After pre-filters, **~20 finalists** reach Claude.

---

## Step 6 — Morning Study (8:30–9:35 AM ET)

Before markets open, Claude runs a separate analysis:
- Reads 4.5 hours of pre-market price action
- Reads macro data (CPI, NFP, FOMC schedule)
- Produces a **daily_plan** with a risk posture:

| Posture | Meaning |
|---|---|
| `aggressive` | Strong tailwinds — standard thresholds, take setups freely |
| `normal` | Neutral day — standard thresholds, trade on signal merit |
| `conservative` | Headwinds (sector risk, weak market, macro uncertainty) — require signal_score ≥ 8.0 AND confidence ≥ 7. **Does not mean zero trades** — a score-9 stock with a clear R:R still gets a BUY. You are being selective, not paralysed. |
| `stand_aside` | Major macro event (FOMC, NFP) — no new BUY entries until the unlock time |

**Important**: `special_warnings` in the daily plan describe conditions at market open (9:35 AM) based on the morning watchlist. They do **not** retroactively veto afternoon candidates from different sectors.

**Macro unlock rules** (loosen the posture as the day progresses):
- FOMC day: `stand_aside` until 2:30 PM ET
- NFP/CPI/GDP: `stand_aside` until 10:30 AM ET (2 hours post-print)
- If SPY gains ≥ 0.5% since open: automatically downgrade `stand_aside` → `conservative`

---

## Step 7 — Claude AI Decision

Claude receives a complete package every scan cycle:

**Account state:**
- Total equity, settled cash, deployed today, available capital
- Daily P&L (realized + unrealized)
- Total exposure %, VIX regime, market posture, intraday regime
- Dynamic confidence bar (raised when recent win rate < 40%)
- Trades used today (max 10)

**Open positions:**
- Symbol, entry price, current price, qty, unrealized P&L
- Stop loss, take profit, time in trade
- Whether partial profit already taken

**Candidates (~20 stocks):**
- Signal score, price, ATR, volume ratio
- Technical indicators: EMA alignment, VWAP, MACD, RSI, Bollinger Bands
- Key levels: support, resistance, previous day high/low, pre-market levels
- Alternative data: news, options flow, insider buying, dark pool, short interest
- Sector and correlation context vs. existing positions

**Recent history (last 20 trades):**
- Symbol, outcome (win/loss), setup type, P&L, confidence score used

### Market Posture (SPY Levels)

Every scan cycle the bot measures SPY relative to the previous day's high/low and sets a `market_posture`:

| Posture | Condition | Claude's behaviour |
|---|---|---|
| `above_pdh` | SPY > prev day high | Bullish tailwind — confidence +1, let winners run |
| `near_pdh` | SPY within 0.5% of prev day high | Approaching resistance — tighten TPs, lean smaller size |
| `mid_range` | SPY between yesterday's levels | Neutral — trade on individual signal |
| `near_pdl` | SPY approaching prev day low | Support test — be more selective |
| `below_pdl` | SPY < prev day low | Broad weakness — reduce confidence by 1, tighten TP, require score ≥ 8.0 to BUY. **Still trades high-quality setups — does not mean auto-SKIP.** |

Posture is a **context multiplier**, not an override. A score-10 stock with 2× volume surge still gets a BUY in `below_pdl` — just with tighter targets.

### Claude's 20 Inviolable Rules

1. Spread must be < 2% (no illiquid entries)
2. Only institutional-grade liquidity
3. Risk ≤ 0.75% of equity per trade ($75 on $10K)
4. Always define hard stop-loss before entry
5. Stops only move in profit direction — never wider
6. Daily loss ≥ 2% ($200) → no new buys for the rest of the day
7. Total portfolio exposure ≤ 40% ($4K on $10K)
8. Entry requires: trend + volume + volatility + price action all aligned
9. Avoid choppy/unclear conditions
10. Volatility-adjusted sizing — high ATR = smaller position
11. Define take-profit, stop-loss, and trailing stop before entry
12. Cut losers quickly if momentum reverses
13. Let winners run while MACD, VWAP, and EMA remain intact
14. Never revenge trade — a loss doesn't justify the next entry
15. Never average down into a losing intraday position
16. Maximum 10 distinct entries per day
17. Log every trade with full reasoning
18. Review recent performance; avoid setups with negative expectancy
19. If a setup type shows repeated losses → avoid it for the rest of the day
20. Ambiguous signal or poor data quality → skip

### Hard Constraints (Override Everything)

These cause Claude to output SKIP regardless of setup quality:
- R:R < 2.0
- Confidence below dynamic bar
- Risk > $100
- Daily P&L ≤ -$200
- Total exposure ≥ 40%
- RSI > 72 on entry (overbought)
- Gap-and-go setup at/after 11:00 AM (window closed)
- Gap direction reversed (price below today's open)

### Claude's Output

Claude returns a JSON array — no prose, no explanation outside the format:

```json
[
  {
    "symbol": "NVDA",
    "action": "BUY",
    "final_decision": "TRADE",
    "setup_type": "momentum",
    "entry_price": 875.50,
    "qty": 8,
    "stop_loss": 869.00,
    "take_profit": 888.50,
    "trailing_stop_pct": 1.2,
    "risk_per_trade_dollars": 52,
    "reward_to_risk": 2.8,
    "signal_confidence": 8,
    "reason_for_entry": "Above VWAP, 9>20 EMA, MACD expanding, vol_ratio 2.1x with options call flow",
    "reason_to_avoid": "Resistance at 880, market midday chop risk"
  }
]
```

---

## Step 8 — 28 More Risk Gates Before Any Order

Even after Claude says BUY, the executor runs additional checks:

**Fundamental gates:**
- Daily drawdown limit hit? → Skip
- Daily plan posture = `stand_aside`? → Skip (conservative only raises the bar, does not skip)
- Symbol on cooling list? → Skip
- Setup type suppressed? → Skip
- Earnings within 2 days? → Skip (double-checked at execution time)
- 2+ consecutive losses? → Raise confidence bar by 1

**Technical gates:**
- ATR/price > 5%? → Skip (too volatile)
- Latest quote spread > 2%? → Skip
- No live quote available? → Skip
- Fresh SEC 8-K filing in last 48 hours? → Skip (material undisclosed info)
- After 3:45 PM ET? → Skip
- After 10:15 AM + score < 7.5 or confidence < 7? → Skip (midday gate — was 9.0/8, lowered 2026-05-22)
- SPY trending down on last 3 bars AND not a gap-and-go? → Skip

**Portfolio gates:**
- Sector bucket already occupied? → Skip
- Correlation with existing position > 0.80? → Skip
- Portfolio heat (total risk across all positions) > 2% of equity? → Skip

**Sizing gates:**
- Computed qty ≤ 0? → Skip
- Adding this position exceeds daily capital cap? → Skip

Only after all 28 gates pass does the bot place a **bracket order** (entry + stop-loss + take-profit legs simultaneously).

---

## Step 9 — Position Sizing Formula

```
qty = conviction_cap ÷ entry_price
    × confidence_scale
    × volatility_factor
    × VIX_factor
    × Kelly_factor
    × PnL_degradation_factor
```

| Component | Range | Effect |
|---|---|---|
| **conviction_cap** | Signal score 8.5+ → $2,400 / 7.5–8.4 → $2,000 / <7.5 → $1,200 | Higher score = larger budget |
| **confidence_scale** | Conf 10 = 1.20× / Conf 9 = 1.00× / Conf 6 = 0.55× | Claude's confidence scales size |
| **volatility_factor** | ATR >4% = 0.35× / ATR <1.5% = 1.00× | High volatility = smaller size |
| **VIX_factor** | Vol >30% = 0.40× / Vol <13% = 1.10× | Market fear shrinks exposure |
| **Kelly_factor** | Based on recent W/L ratio, typically 0.7–1.3× | Recent losses shrink size |
| **PnL_degradation** | Daily loss >1% = 0.70× / >1.5% = 0.40× | Losing day = tighter sizing |

**Hard caps regardless of formula:**
- Max risk per trade: **$100**
- Max daily deployed capital: **$4,000**
- Max concurrent positions: **4**

---

## Step 10 — Automated Position Management (Every 2 Minutes)

Once in a trade, the bot manages exits automatically without waiting for the next Claude scan:

| Rule | Trigger | Action |
|---|---|---|
| **Time stop** | Open > 90 min AND < 25% of TP range reached | Auto-sell — thesis expired |
| **Breakeven stop** | Gain ≥ +0.3% | Move stop to entry price + 1 tick |
| **Trailing stop** | Gain ≥ +0.6% | Activate trailing stop at 0.5% trail |
| **Partial profit** | Price reaches 50% of TP range | Auto-sell 50%, trail remaining |
| **EOD close** | 3:45 PM ET | Force-close all positions — no overnight holds |

---

## Step 11 — Feedback Loop

After every closed trade the bot updates its own performance metrics:

- **Dynamic confidence bar** — if recent win rate < 40%, minimum confidence requirement increases (requires Claude to be more certain)
- **Cooling symbols** — if a symbol has < 25% win rate in last 10 trades, it's blocked for the rest of the day
- **Setup suppression** — if a setup type (e.g. "gap_and_go") has negative expectancy today, it's blocked for remaining scans
- **Revenge-trade guard** — 2+ consecutive losses → confidence bar raised by 1 additional point
- **Kelly factor** — rolling W/L ratio continuously updates position sizing

---

## Fallback: When Claude Is Unavailable

If Claude's API times out or returns unparseable output, the bot switches to rule-based mode:
1. Hold all existing positions (mechanical stops remain active)
2. BUY top 1–4 candidates with score ≥ 7.5, up to position limit
3. Log all decisions as "Rule-based fallback: Claude unavailable"

Trading continues uninterrupted.

---

## Key Numbers at a Glance

| Parameter | Default | Purpose |
|---|---|---|
| Account size | $10,000 | Base equity for % calculations |
| Daily capital cap | $4,000 (40%) | Max deployed in one day |
| Max risk per trade | $100 (1%) | Hard loss ceiling per position |
| Daily drawdown limit | $200 (2%) | Bot stops entering new trades |
| Max portfolio heat | $200 (2%) | Total risk across all open positions |
| Max concurrent positions | 4 | Diversification limit |
| Max trades per day | 10 | Quality over quantity |
| Min R:R ratio | 2.0 | Potential gain must be 2× the risk |
| Min signal score to AI | 5.0 | Quality gate before Claude |
| Min confidence (default) | 6–9 (dynamic) | Raised after losses |
| Max sector exposure | 1 position/sector | Concentration guard |
| Max correlation | 0.80 | Factor concentration guard |
| Max ATR/price | 5.0% | Volatility ceiling |
| Max hold time | 90 minutes | Thesis decay prevention |

---

## Changelog

### 2026-05-22 — Lower midday gate thresholds (commit TBD)

**Problem**: Bot went 4 days without a single trade. Stocks on the watchlist were up significantly.
Root cause: the prime trading window was only **40 minutes** (9:35–10:15 AM). After that, the midday gate required score ≥ 9.0 AND confidence ≥ 8 — an almost impossible bar. On days where the morning study set conservative posture or SPY was below PDL, even that 40-minute window produced no trades.

**Changes:**
- `MIDDAY_ENTRY_MIN_SCORE`: 9.0 → 7.5 (still high conviction, but achievable)
- `MIDDAY_ENTRY_MIN_CONF`: 8 → 7 (still requires strong confidence)
- `session_overrides` midday floor: 6.5 → 5.5 (allows morning study to lower the score filter when conditions warrant)

**Effect**: The bot can now find trades throughout the full trading day, not just a 40-minute window. Score 7.5 + confidence 7 represents a solid setup — not a lottery ticket.

**Rollback**: `git reset --hard cac0e7a`

---

### 2026-05-18 — Loosen over-aggressive filters (commit `ad28273`)

**Problem**: The bot ran all day without a single trade despite multiple stocks scoring 10.0.
Root cause was three stacked filters that together blocked every setup:

**1. 15-min gate too strict**
- **Before**: Momentum/gap setups required 3/3 15-min indicators (EMA + VWAP + MACD all bullish)
- **After**: Stocks with signal_score ≥ 8.5 only need 2/3 — a near-perfect score shouldn't be blocked by one lagging indicator
- **Why**: IGV, AAOI, SHOP, SMCI all scored 10.0 but were vetoed at this gate before Claude ever saw them

**2. `below_pdl` posture too vague**
- **Before**: Prompt said "only the strongest setups" — Claude interpreted this as skip everything
- **After**: Explicit instruction: confidence −1, require score ≥ 8.0, tighter TP, but still BUY if R:R ≥ 2.0
- **Why**: BIDU scored 10.0 with vol_ratio 1.6× and got `conf=6, SKIP, R:R=None` — Claude wasn't even calculating levels

**3. `conservative` posture undefined**
- **Before**: No explanation of what `conservative` means in the system prompt — Claude guessed "skip all"
- **After**: Explicit guide added: conservative = score ≥ 8 AND confidence ≥ 7 required, not zero trades
- **Why**: Morning study set conservative posture due to tech concentration at 9:35 AM. Claude carried that warning into every afternoon scan, SKIPping candidates from completely different sectors

**Rollback**: `git reset --hard a4b16dd`
| EOD close | 3:45 PM ET | No overnight positions |
