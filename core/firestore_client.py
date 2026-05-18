"""Firebase Admin SDK singleton — lazy-initialized, never raises on import."""

import json
import os
import threading

_lock = threading.Lock()
_db = None
_initialized = False


def get_db():
    """Return Firestore client, or None if credentials are missing/invalid."""
    global _db, _initialized
    if not _initialized or _db is None:
        with _lock:
            if not _initialized or _db is None:
                _db = _init()
                _initialized = True
    return _db


def _init():
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
        if not sa_json:
            return None

        sa_dict = json.loads(sa_json)

        if firebase_admin._DEFAULT_APP_NAME not in firebase_admin._apps:
            cred = credentials.Certificate(sa_dict)
            firebase_admin.initialize_app(cred)

        return firestore.client()
    except Exception as e:
        print(f"[firestore_client] init failed (Firestore sync disabled): {e}")
        return None
