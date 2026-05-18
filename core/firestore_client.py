"""Firebase Admin SDK singleton — lazy-initialized, never raises on import."""

import json
import logging
import os
import threading

log = logging.getLogger(__name__)

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
            log.warning("FIREBASE_SERVICE_ACCOUNT not set — Firestore disabled")
            return None

        log.info("firestore_client: parsing service account JSON (len=%d)", len(sa_json))
        sa_dict = json.loads(sa_json)

        if firebase_admin._DEFAULT_APP_NAME not in firebase_admin._apps:
            log.info("firestore_client: initializing firebase_admin app")
            cred = credentials.Certificate(sa_dict)
            firebase_admin.initialize_app(cred)
            log.info("firestore_client: firebase_admin app initialized")
        else:
            log.info("firestore_client: firebase_admin app already initialized")

        log.info("firestore_client: creating Firestore client")
        client = firestore.client()
        log.info("firestore_client: Firestore client ready")
        return client
    except Exception as e:
        log.error("firestore_client: init failed — %s", e, exc_info=True)
        return None
