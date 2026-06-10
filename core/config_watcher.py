"""Polls Firestore /config/bot every 60 s and exposes runtime overrides."""

import threading
import time

_instance = None
_lock = threading.Lock()


def get_config_watcher():
    global _instance
    if _instance is None:
        with _lock:
            if _instance is None:
                _instance = ConfigWatcher()
    return _instance


class ConfigWatcher:
    POLL_INTERVAL = 60  # seconds

    def __init__(self):
        self._cache: dict = {}
        self._rlock = threading.RLock()
        self._prev_paused: bool = False
        self._pause_just_activated: bool = False
        self._load()
        t = threading.Thread(target=self._loop, daemon=True, name="config-watcher")
        t.start()

    def _load(self):
        try:
            from core.firestore_client import get_db
            db = get_db()
            if not db:
                return
            doc = db.collection("config").document("bot").get()
            if doc.exists:
                new_cache = doc.to_dict() or {}
                with self._rlock:
                    new_paused = bool(new_cache.get("paused", False))
                    if new_paused and not self._prev_paused:
                        self._pause_just_activated = True
                    self._prev_paused = new_paused
                    self._cache = new_cache
        except Exception:
            pass  # stale cache is acceptable

    def _loop(self):
        while True:
            time.sleep(self.POLL_INTERVAL)
            self._load()

    def consume_pause_activation(self) -> bool:
        """Returns True once when pause transitions False→True, then resets."""
        with self._rlock:
            if self._pause_just_activated:
                self._pause_just_activated = False
                return True
            return False

    def consume_force_scan(self) -> bool:
        """Returns True once if force_scan flag is set in Firestore, then clears it."""
        if not self.get("force_scan"):
            return False
        try:
            from core.firestore_client import get_db
            db = get_db()
            if db:
                db.collection("config").document("bot").update({"force_scan": False})
        except Exception:
            pass
        with self._rlock:
            if isinstance(self._cache, dict):
                self._cache["force_scan"] = False
        return True

    # ── Public accessors ──────────────────────────────────────────────────────

    def get(self, key, default=None):
        with self._rlock:
            return self._cache.get(key, default)

    def is_paused(self) -> bool:
        return bool(self.get("paused", False))

    def watchlist_override(self) -> list[str] | None:
        """Returns override watchlist from UI, or None to use config.py default."""
        v = self.get("watchlist")
        return list(v) if isinstance(v, list) and v else None

    def override(self, key, default):
        """Return Firestore value if present and same type, else default."""
        v = self.get(key)
        if v is None:
            return default
        try:
            return type(default)(v)
        except (TypeError, ValueError):
            return default
