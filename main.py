"""Entry point: builds the trading stack, runs APScheduler jobs for live trading."""

import argparse
import logging
import os
import signal
import sys
import time
from datetime import datetime

from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.schedulers.background import BackgroundScheduler

import config
from bootstrap import build_trading_stack
from core.database import log

# Watchdog: force a systemd restart if no scan completes for this many minutes
# during regular trading hours. Scans run every 10 min; a single hang + recovery
# is ~10 min, so 25 min ≈ two consecutive missed scans = genuinely wedged.
WATCHDOG_STALL_MINUTES = 25


def graceful_exit(sig, frame):
    """Handle SIGINT or SIGTERM by logging and exiting the process.

    Args:
        sig: Signal number from the OS.
        frame: Current stack frame (unused).

    Returns:
        Does not return; calls sys.exit(0).
    """
    log.info("Shutdown signal received — stopping bot")
    try:
        from core.firestore_sync import write_offline
        write_offline()
    except Exception:
        pass
    sys.exit(0)


def main():
    """Parse CLI flags, start the scheduler, and block until interrupt.

    Recognizes optional flag --force from sys.argv.

    Returns:
        None under normal loop exit; may call sys.exit from the signal handler.
    """
    parser = argparse.ArgumentParser(description="Autonomous stock trading bot")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Bypass market-hours gates so the pipeline runs at any time",
    )
    args = parser.parse_args()

    signal.signal(signal.SIGINT, graceful_exit)
    signal.signal(signal.SIGTERM, graceful_exit)

    log.info("=" * 60)
    suffix = "  [FORCE]" if args.force else ""
    log.info("Autonomous Stock Trading Bot — starting up%s", suffix)
    log.info(
        "Account target: $%.0f | Max daily deploy: $%.0f",
        config.ACCOUNT_SIZE,
        config.MAX_DAILY_CAPITAL,
    )
    log.info(
        "Max risk/trade: $%.0f | Max positions: %d",
        config.MAX_RISK_PER_TRADE,
        config.MAX_CONCURRENT_POSITIONS,
    )
    log.info("=" * 60)

    orchestrator, backtester = build_trading_stack()
    if args.force:
        orchestrator.set_force_run(True)

    # 4 workers so a single slow/stuck job (e.g. a 13-min morning study or a hung
    # scan) cannot starve position management, heartbeats, and scanning of threads.
    executors = {"default": ThreadPoolExecutor(max_workers=4)}
    scheduler = BackgroundScheduler(executors=executors, timezone=config.ET)

    scheduler.add_job(
        orchestrator.run_position_management,
        "interval",
        minutes=2,
        id="position_management",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=60,
    )
    scheduler.add_job(
        orchestrator.run_scan_and_trade,
        "interval",
        minutes=10,
        id="scan_and_trade",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=120,
    )
    scheduler.add_job(
        orchestrator.run_position_management,
        "date",
        run_date=datetime.now(config.ET),
        id="immediate_position",
    )
    scheduler.add_job(
        orchestrator.run_scan_and_trade,
        "date",
        run_date=datetime.now(config.ET),
        id="immediate_scan",
    )
    scheduler.add_job(
        backtester.run_backtest,
        "cron",
        day_of_week="sun",
        hour=8,
        minute=0,
        id="weekly_backtest",
        max_instances=1,
    )

    def send_heartbeat():
        from core.firestore_sync import sync_status
        try:
            positions = orchestrator.broker.get_positions()
            pos_count = len(positions)
        except Exception:
            pos_count = orchestrator._open_positions_count if hasattr(orchestrator, '_open_positions_count') else 0
        mode = "paper"
        sync_status(
            mode=mode,
            deployed_today=orchestrator._deployed_today,
            daily_pnl=orchestrator._daily_pnl,
            trades_today=orchestrator._trades_today,
            open_positions_count=pos_count,
            session_date=orchestrator._session_date,
        )

    scheduler.add_job(
        send_heartbeat,
        "interval",
        seconds=30,
        id="heartbeat",
        max_instances=1,
        coalesce=True,
    )

    log.info("Scheduler started — position management every 2 min, scan every 10 min")
    scheduler.start()

    def _scan_pipeline_stalled() -> bool:
        """Return True when scans should be running but the pipeline is wedged.

        Runs in the main thread, independent of the scheduler's worker pool, so a
        hung scan thread (e.g. a network call with no socket timeout) cannot hide
        the stall. Conservative to avoid false-positive restarts: only fires during
        regular trading hours, after the study window, once the study is complete.
        """
        from datetime import datetime as _dt, timedelta as _td
        now_et = _dt.now(config.ET)
        if now_et.weekday() >= 5:
            return False
        # Window: after the first post-study scan should have landed, before close.
        if not (_dt.combine(now_et.date(), _dt.min.time().replace(hour=9, minute=50))
                <= now_et.replace(tzinfo=None)
                <= _dt.combine(now_et.date(), _dt.min.time().replace(hour=15, minute=55))):
            return False
        if not getattr(orchestrator, "_study_complete", False):
            return False
        last = orchestrator._last_scan_complete_ts
        if last is None:
            return True  # study done, in-window, yet no scan ever completed
        return (now_et - last) > _td(minutes=WATCHDOG_STALL_MINUTES)

    _force_scan_tick = 0
    _watchdog_tick   = 0
    try:
        while True:
            time.sleep(1)
            _force_scan_tick += 1
            _watchdog_tick   += 1
            if _force_scan_tick >= 5:
                _force_scan_tick = 0
                try:
                    from core.config_watcher import get_config_watcher
                    if get_config_watcher().consume_force_scan():
                        log.info("Force scan requested from dashboard — triggering immediate scan")
                        from datetime import datetime as _dt
                        scheduler.reschedule_job(
                            "scan_and_trade",
                            trigger="date",
                            run_date=_dt.now(config.ET),
                        )
                except Exception:
                    pass
            if _watchdog_tick >= 60:
                _watchdog_tick = 0
                try:
                    if _scan_pipeline_stalled():
                        last = orchestrator._last_scan_complete_ts
                        log.critical(
                            "WATCHDOG: scan pipeline stalled (last completed scan: %s) — "
                            "forcing process exit so systemd restarts the bot.",
                            last.isoformat() if last else "never",
                        )
                        scheduler.shutdown(wait=False)
                        logging.shutdown()
                        os._exit(1)
                except Exception:
                    pass
    except (KeyboardInterrupt, SystemExit):
        log.info("Bot stopped by user")
    finally:
        scheduler.shutdown(wait=False)


if __name__ == "__main__":
    main()
