"""Fire-and-forget Firestore sync. All writes run in daemon threads and never raise."""

import logging
import os
import threading
from datetime import datetime, timezone

log = logging.getLogger(__name__)


def _db():
    from core.firestore_client import get_db
    return get_db()


def _run(fn):
    t = threading.Thread(target=_safe(fn), daemon=True)
    t.start()


def _safe(fn):
    def wrapper():
        try:
            fn()
        except Exception as e:
            log.warning("Firestore write failed: %s", e)
    return wrapper


def sync_decision(symbol, action, price=None, qty=None, stop_loss=None,
                  take_profit=None, pnl=None, reasoning="", setup_type=None,
                  confidence=None, signal_score=None):
    # Only push actionable events to keep Firestore lean
    if action not in ("BUY", "SELL", "PARTIAL_SELL"):
        return

    def _write():
        db = _db()
        if not db:
            return
        now = datetime.now(timezone.utc)
        db.collection("decisions").add({
            "symbol":       symbol,
            "action":       action,
            "price":        price,
            "qty":          qty,
            "stop_loss":    stop_loss,
            "take_profit":  take_profit,
            "pnl":          pnl,
            "reasoning":    reasoning,
            "setup_type":   setup_type,
            "confidence":   confidence,
            "signal_score": signal_score,
            "ts":           now,
            "date":         now.strftime("%Y-%m-%d"),
        })

    _run(_write)


def sync_position(symbol, entry_price, qty, stop_loss, take_profit,
                  entry_ts=None, setup_type=None, current_price=None):
    def _write():
        db = _db()
        if not db:
            return
        db.collection("positions").document(symbol).set({
            "symbol":         symbol,
            "entry_price":    entry_price,
            "qty":            qty,
            "stop_loss":      stop_loss,
            "take_profit":    take_profit,
            "current_price":  current_price or entry_price,
            "unrealized_pnl": round((current_price or entry_price) * qty - entry_price * qty, 2),
            "entry_ts":       entry_ts,
            "setup_type":     setup_type,
            "updated_at":     datetime.now(timezone.utc),
        }, merge=True)

    _run(_write)


def remove_position(symbol):
    def _write():
        db = _db()
        if not db:
            return
        db.collection("positions").document(symbol).delete()

    _run(_write)


def sync_daily_summary(date_str, trades, wins, losses, gross_pnl, net_pnl, notes=""):
    def _write():
        db = _db()
        if not db:
            return
        db.collection("daily_summary").document(date_str).set({
            "date":       date_str,
            "trades":     trades,
            "wins":       wins,
            "losses":     losses,
            "gross_pnl":  gross_pnl,
            "net_pnl":    net_pnl,
            "notes":      notes,
            "updated_at": datetime.now(timezone.utc),
        })

    _run(_write)


def sync_status(mode="live", deployed_today=0.0, daily_pnl=0.0,
                trades_today=0, open_positions_count=0, session_date=""):
    """Synchronous write — heartbeat must land reliably, not in a daemon thread."""
    try:
        db = _db()
        if not db:
            log.warning("sync_status: Firestore client unavailable — heartbeat skipped")
            return
        db.collection("status").document("bot").set({
            "running":              True,
            "last_heartbeat":       datetime.now(timezone.utc),
            "pid":                  os.getpid(),
            "mode":                 mode,
            "deployed_today":       round(deployed_today, 2),
            "daily_pnl":            round(daily_pnl, 2),
            "trades_today":         trades_today,
            "open_positions_count": open_positions_count,
            "session_date":         session_date,
        })
    except Exception as e:
        log.warning("sync_status write failed: %s", e)


def write_offline():
    """Mark the bot as offline (called on shutdown)."""
    def _write():
        db = _db()
        if not db:
            return
        db.collection("status").document("bot").set({
            "running":        False,
            "last_heartbeat": datetime.now(timezone.utc),
        }, merge=True)

    _safe(_write)()  # synchronous on shutdown


def init_default_config(watchlist: list[str]):
    """Write default config to Firestore only if the document doesn't already exist."""
    def _write():
        db = _db()
        if not db:
            return
        ref = db.collection("config").document("bot")
        if ref.get().exists:
            return
        ref.set({
            "paused":                  False,
            "max_risk_per_trade":      100.0,
            "max_concurrent_positions": 4,
            "max_daily_capital":       4000.0,
            "account_size":            10000.0,
            "daily_drawdown_limit":    200.0,
            "min_signal_confidence":   6,
            "min_reward_to_risk":      2.0,
            "max_spread_pct":          0.02,
            "watchlist":               watchlist,
            "updated_at":              datetime.now(timezone.utc),
            "updated_by":              "bot_init",
        })

    _run(_write)
