"""
File Integrity Checker — V2.1 Real-Time Monitoring Engine
==========================================================
Uses watchdog to watch filesystem paths for changes.
Architecture:
  - One FileMonitorService singleton per process.
  - One watchdog Observer thread (shared).
  - Per-file IntegrityEventHandler instances registered with the observer.
  - 3-second debounce per file to suppress duplicate events from a single save.
  - Duplicate-guard: if file hash unchanged since last check, no alert is raised.
  - Flask reloader guard: only starts in the main process (WERKZEUG_RUN_MAIN check).
  - Thread-safe DB writes via sqlite3 (WAL mode already enabled).
  - Never modifies, executes, or uploads monitored files.
"""

import os
import time
import threading
import logging
from datetime import datetime
from typing import Dict, Optional

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileMovedEvent, FileDeletedEvent

from database import get_db
from hash_engine import calculate_hash

log = logging.getLogger('file_monitor')
log.setLevel(logging.INFO)

# ── Constants ─────────────────────────────────────────────────────────────────
DEBOUNCE_SECONDS   = 3.0   # wait this long after last event before hashing
COOLDOWN_SECONDS   = 5.0   # minimum gap between consecutive alerts for same file
RECREATE_WAIT_MS   = 500   # ms to wait after CREATE event before hashing


# ── Per-file event handler ────────────────────────────────────────────────────
class IntegrityEventHandler(FileSystemEventHandler):
    """
    Handles filesystem events for a single watched file.
    Path comparisons are case-insensitive on Windows.
    """

    def __init__(self, file_id: int, user_id: int, abs_path: str,
                 trusted_hash: str, algorithm: str, service: 'FileMonitorService'):
        super().__init__()
        self.file_id      = file_id
        self.user_id      = user_id
        self.abs_path     = os.path.normpath(abs_path)
        self.trusted_hash = trusted_hash
        self.algorithm    = algorithm
        self.service      = service

        self._debounce_timer: Optional[threading.Timer] = None
        self._lock           = threading.Lock()
        self._last_alert_ts  = 0.0   # epoch seconds of last alert

    # ── watchdog callbacks ────────────────────────────────────────────────────
    def on_modified(self, event):
        if not event.is_directory and self._is_our_file(event.src_path):
            self._schedule_check('MODIFIED')

    def on_created(self, event):
        if not event.is_directory and self._is_our_file(event.src_path):
            self._schedule_check('CREATED', delay=RECREATE_WAIT_MS / 1000)

    def on_deleted(self, event):
        if not event.is_directory and self._is_our_file(event.src_path):
            self._cancel_timer()
            self._handle_deleted()

    def on_moved(self, event):
        # If our file was moved away, treat as deleted
        if not event.is_directory and self._is_our_file(getattr(event, 'src_path', '')):
            self._cancel_timer()
            self._handle_deleted()

    # ── Internal helpers ──────────────────────────────────────────────────────
    def _is_our_file(self, path: str) -> bool:
        return os.path.normpath(path).lower() == self.abs_path.lower()

    def _schedule_check(self, event_hint: str, delay: float = DEBOUNCE_SECONDS):
        """Debounce: cancel any pending timer and restart it."""
        with self._lock:
            if self._debounce_timer:
                self._debounce_timer.cancel()
            self._debounce_timer = threading.Timer(
                delay, self._run_check, args=[event_hint]
            )
            self._debounce_timer.daemon = True
            self._debounce_timer.start()

    def _cancel_timer(self):
        with self._lock:
            if self._debounce_timer:
                self._debounce_timer.cancel()
                self._debounce_timer = None

    def _run_check(self, event_hint: str):
        """Run after debounce delay. Does the real hash comparison."""
        with self._lock:
            self._debounce_timer = None

        # Cooldown guard — don't spam alerts
        now = time.time()
        if now - self._last_alert_ts < COOLDOWN_SECONDS:
            log.debug("Cooldown active for %s — skipping", self.abs_path)
            return

        if not os.path.isfile(self.abs_path):
            # File disappeared between event and check
            self._handle_deleted()
            return

        try:
            current_hash = calculate_hash(self.abs_path, self.algorithm)
            current_size = os.path.getsize(self.abs_path)
            try:
                current_mtime = datetime.fromtimestamp(
                    os.path.getmtime(self.abs_path)
                ).isoformat()
            except OSError:
                current_mtime = datetime.utcnow().isoformat()
        except PermissionError:
            log.warning("Permission denied reading %s — skipping", self.abs_path)
            return
        except OSError as exc:
            log.warning("OS error reading %s: %s", self.abs_path, exc)
            return

        # Duplicate guard: if hash unchanged since last watcher run, do nothing
        prev_hash = self._get_last_known_hash()
        if prev_hash and prev_hash == current_hash:
            log.debug("Hash unchanged for %s — no event", self.abs_path)
            self._update_last_known(current_hash, current_size, current_mtime)
            return

        # Determine change type
        change_type = 'RECREATED_MODIFIED' if event_hint == 'CREATED' else 'MODIFIED'
        if event_hint == 'CREATED' and current_hash == self.trusted_hash:
            change_type = 'RECREATED_VERIFIED'

        verified     = (current_hash == self.trusted_hash)
        scan_status  = 'VERIFIED' if verified else 'MODIFIED'

        log.info("Integrity event: file_id=%d change=%s verified=%s",
                 self.file_id, change_type, verified)

        self._last_alert_ts = now
        self._persist_event(current_hash, current_size, current_mtime,
                            change_type, scan_status, prev_hash)
        self._update_last_known(current_hash, current_size, current_mtime)

    def _handle_deleted(self):
        """File was deleted — create DELETED alert."""
        now = time.time()
        if now - self._last_alert_ts < COOLDOWN_SECONDS:
            return
        self._last_alert_ts = now
        log.info("File deleted: file_id=%d path=%s", self.file_id, self.abs_path)
        self._persist_event(
            current_hash='<deleted>',
            current_size=0,
            current_mtime=datetime.utcnow().isoformat(),
            change_type='DELETED',
            scan_status='DELETED',
            prev_hash=self._get_last_known_hash(),
        )

    def _get_last_known_hash(self) -> Optional[str]:
        conn = get_db()
        try:
            row = conn.execute(
                'SELECT last_known_hash FROM monitored_files WHERE id=?',
                (self.file_id,)
            ).fetchone()
            return row['last_known_hash'] if row else None
        finally:
            conn.close()

    def _update_last_known(self, h: str, size: int, mtime: str):
        conn = get_db()
        try:
            conn.execute('''
                UPDATE monitored_files
                SET last_known_hash=?, last_known_size=?, last_modified_at=?,
                    last_checked=CURRENT_TIMESTAMP
                WHERE id=?
            ''', (h, size, mtime, self.file_id))
            conn.commit()
        finally:
            conn.close()

    def _persist_event(self, current_hash: str, current_size: int,
                       current_mtime: str, change_type: str,
                       scan_status: str, prev_hash: Optional[str]):
        """Write scan_history + alert to the database (existing tables, no new tables)."""
        conn = get_db()
        try:
            # ── Scan history entry ───────────────────────────────────────────
            fname = os.path.basename(self.abs_path)
            conn.execute('''
                INSERT INTO scan_history
                (user_id, file_id, file_name, algorithm, trusted_hash, current_hash,
                 file_size, status, scan_type, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'realtime_monitor', 0)
            ''', (
                self.user_id, self.file_id, fname,
                self.algorithm, self.trusted_hash, current_hash,
                current_size, scan_status,
            ))

            # Update last_checked on the monitored_files row
            conn.execute(
                'UPDATE monitored_files SET last_checked=CURRENT_TIMESTAMP WHERE id=?',
                (self.file_id,)
            )

            # ── Alert (only for non-VERIFIED events) ─────────────────────────
            if scan_status not in ('VERIFIED', 'RECREATED_VERIFIED'):
                severity = self._severity_for(change_type, fname)
                source   = '[REAL-TIME MONITOR]'

                if change_type == 'DELETED':
                    alert_type = 'FILE_DELETED'
                    message = (
                        f"{source} File deleted: {fname}. "
                        f"The file is no longer present at its monitored path."
                    )
                elif 'RECREATED' in change_type:
                    alert_type = 'MODIFICATION_DETECTED'
                    message = (
                        f"{source} File recreated with different content: {fname}. "
                        f"Hash after recreation differs from trusted baseline."
                    )
                else:
                    alert_type = 'MODIFICATION_DETECTED'
                    message = (
                        f"{source} File modification detected: {fname}. "
                        f"Hash mismatch confirms byte content has changed. "
                        f"Previous: {(prev_hash or 'unknown')[:16]}… "
                        f"Current: {current_hash[:16]}…"
                    )

                conn.execute('''
                    INSERT INTO alerts
                    (user_id, file_id, file_name, alert_type, message, severity, status, is_demo)
                    VALUES (?, ?, ?, ?, ?, ?, 'unread', 0)
                ''', (
                    self.user_id, self.file_id, fname,
                    alert_type, message, severity,
                ))

            conn.commit()
        except Exception as exc:
            log.error("DB error persisting event for file_id=%d: %s", self.file_id, exc)
            conn.rollback()
        finally:
            conn.close()

    @staticmethod
    def _severity_for(change_type: str, fname: str) -> str:
        if change_type == 'DELETED':
            return 'critical'
        fname_lower = fname.lower()
        if any(fname_lower.endswith(x) for x in ['.conf','.cfg','.ini','.json','.sql','.env']):
            return 'critical'
        if any(fname_lower.endswith(x) for x in ['.exe','.dll','.bin','.sh','.bat','.py']):
            return 'high'
        if any(fname_lower.endswith(x) for x in ['.pdf','.doc','.docx','.xls','.xlsx']):
            return 'medium'
        return 'high'


# ── Monitoring Service singleton ──────────────────────────────────────────────
class FileMonitorService:
    """
    Singleton service that manages the watchdog Observer and all file handlers.
    Thread-safe. Designed to run inside the Flask process.

    Duplicate-process guard: only the main Werkzeug process (not the reloader
    child) should start the observer. Check WERKZEUG_RUN_MAIN before calling
    start().
    """

    _instance: Optional['FileMonitorService'] = None
    _lock = threading.Lock()

    @classmethod
    def get_instance(cls) -> 'FileMonitorService':
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def __init__(self):
        self._observer: Optional[Observer] = None
        self._handlers: Dict[int, IntegrityEventHandler] = {}  # file_id → handler
        self._watch_refs: Dict[str, object] = {}               # dir → watch object
        self._running = False
        self._service_lock = threading.Lock()

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    def start(self):
        """Start the watchdog Observer and load all active watchers from DB."""
        with self._service_lock:
            if self._running:
                return
            self._observer = Observer()
            self._observer.daemon = True
            self._observer.start()
            self._running = True
            log.info("FileMonitorService started.")
        # Load from DB OUTSIDE the lock to avoid deadlock:
        # _load_from_db -> register() also acquires _service_lock
        try:
            self._load_from_db()
        except Exception as exc:
            log.error("Error loading watchers from DB on startup: %s", exc)

    def stop(self):
        with self._service_lock:
            if not self._running:
                return
            if self._observer:
                self._observer.stop()
                self._observer.join(timeout=5)
                self._observer = None
            self._handlers.clear()
            self._watch_refs.clear()
            self._running = False
            log.info("FileMonitorService stopped.")

    @property
    def is_running(self) -> bool:
        return self._running and self._observer is not None and self._observer.is_alive()

    # ── File registration ─────────────────────────────────────────────────────
    def register(self, file_id: int, user_id: int, abs_path: str,
                 trusted_hash: str, algorithm: str) -> bool:
        """
        Register (or re-register) a file for watching.
        Returns True if successful, False if path is invalid.
        """
        abs_path = os.path.normpath(abs_path)

        # Security: path must be absolute
        if not os.path.isabs(abs_path):
            log.warning("Rejected relative path: %s", abs_path)
            return False

        # File must exist at registration time
        if not os.path.isfile(abs_path):
            log.warning("File not found at registration: %s", abs_path)
            return False

        watch_dir = os.path.dirname(abs_path)

        with self._service_lock:
            # Remove old handler for this file_id if present
            self._remove_handler(file_id)

            handler = IntegrityEventHandler(
                file_id, user_id, abs_path, trusted_hash, algorithm, self
            )
            self._handlers[file_id] = handler

            # Reuse existing directory watch or create new one
            if watch_dir not in self._watch_refs:
                if self._observer:
                    watch = self._observer.schedule(handler, watch_dir, recursive=False)
                    self._watch_refs[watch_dir] = watch
                else:
                    log.warning("Observer not running — handler queued but not watching yet")
            else:
                # Add handler to the existing watch's event handlers
                if self._observer:
                    self._observer.add_handler_for_watch(handler, self._watch_refs[watch_dir])

        # Seed last_known_hash in DB so first debounce has a baseline to compare
        try:
            current_hash = calculate_hash(abs_path, algorithm)
            current_size = os.path.getsize(abs_path)
            try:
                mtime = datetime.fromtimestamp(os.path.getmtime(abs_path)).isoformat()
            except OSError:
                mtime = datetime.utcnow().isoformat()

            conn = get_db()
            try:
                conn.execute('''
                    UPDATE monitored_files
                    SET abs_file_path=?, last_known_hash=?, last_known_size=?,
                        last_modified_at=?, watcher_enabled=1,
                        last_checked=CURRENT_TIMESTAMP
                    WHERE id=?
                ''', (abs_path, current_hash, current_size, mtime, file_id))
                conn.commit()
            finally:
                conn.close()
        except Exception as exc:
            log.error("Error seeding last_known for file_id=%d: %s", file_id, exc)

        log.info("Registered watcher: file_id=%d path=%s", file_id, abs_path)
        return True

    def unregister(self, file_id: int):
        """Remove watcher for this file_id and cancel any pending debounce timer."""
        with self._service_lock:
            if file_id in self._handlers:
                # Cancel the handler's pending debounce timer before removing
                handler = self._handlers[file_id]
                handler._cancel_timer()
            self._remove_handler(file_id)

        conn = get_db()
        try:
            conn.execute(
                'UPDATE monitored_files SET watcher_enabled=0 WHERE id=?', (file_id,)
            )
            conn.commit()
        finally:
            conn.close()
        log.info("Unregistered watcher: file_id=%d", file_id)

    def pause(self, file_id: int):
        """Temporarily remove handler but keep watcher_enabled=0."""
        self.unregister(file_id)

    def resume(self, file_id: int):
        """Re-register a paused file by reloading its info from DB."""
        conn = get_db()
        try:
            row = conn.execute(
                'SELECT * FROM monitored_files WHERE id=? AND is_demo=0', (file_id,)
            ).fetchone()
        finally:
            conn.close()

        if not row or not row['abs_file_path']:
            log.warning("Cannot resume file_id=%d — no abs_file_path stored", file_id)
            return False

        return self.register(
            file_id    = row['id'],
            user_id    = row['user_id'],
            abs_path   = row['abs_file_path'],
            trusted_hash = row['trusted_hash'],
            algorithm  = row['algorithm'],
        )

    def get_status(self) -> dict:
        """Return the current service status summary."""
        return {
            'running':       self.is_running,
            'watched_files': len(self._handlers),
            'watched_dirs':  len(self._watch_refs),
        }

    def active_file_ids(self) -> list:
        with self._service_lock:
            return list(self._handlers.keys())

    # ── Internal ──────────────────────────────────────────────────────────────
    def _remove_handler(self, file_id: int):
        """Must be called with _service_lock held."""
        if file_id not in self._handlers:
            return
        handler = self._handlers.pop(file_id)
        if self._observer:
            for watch in self._watch_refs.values():
                try:
                    self._observer.remove_handler_for_watch(handler, watch)
                except Exception:
                    pass  # already removed or watch gone

    def _load_from_db(self):
        """On startup, register all files where watcher_enabled=1."""
        conn = get_db()
        try:
            rows = conn.execute('''
                SELECT id, user_id, abs_file_path, trusted_hash, algorithm
                FROM monitored_files
                WHERE watcher_enabled=1 AND is_demo=0 AND abs_file_path IS NOT NULL
            ''').fetchall()
        finally:
            conn.close()

        count = 0
        for row in rows:
            if row['abs_file_path'] and os.path.isfile(row['abs_file_path']):
                ok = self.register(
                    file_id=row['id'],
                    user_id=row['user_id'],
                    abs_path=row['abs_file_path'],
                    trusted_hash=row['trusted_hash'],
                    algorithm=row['algorithm'],
                )
                if ok:
                    count += 1
            else:
                log.warning("Startup: skipping missing file for file_id=%d: %s",
                            row['id'], row['abs_file_path'])

        log.info("Startup: loaded %d/%d watcher(s) from database.", count, len(rows))


# ── Module-level convenience accessors ───────────────────────────────────────
def get_monitor() -> FileMonitorService:
    """Return the singleton service instance."""
    return FileMonitorService.get_instance()


def start_monitor():
    """
    Start the monitoring service in a background daemon thread so it never
    blocks Flask from binding to the port.
    Call this from app.py __main__ block.
    """
    import threading

    def _do_start():
        try:
            # Werkzeug dev server spawns a reloader process; WERKZEUG_RUN_MAIN='true'
            # only in the actual serving child. We want ONE monitor, not two.
            in_reloader_child = os.environ.get('WERKZEUG_RUN_MAIN') == 'true'
            is_debug = os.environ.get('FLASK_DEBUG', '0') == '1' or \
                       os.environ.get('FLASK_ENV') == 'development'

            if not is_debug or in_reloader_child:
                svc = get_monitor()
                if not svc.is_running:
                    svc.start()
                    log.info("Monitor started (debug=%s, reloader_child=%s).",
                             is_debug, in_reloader_child)
            else:
                log.info("Monitor deferred to reloader child process.")
        except Exception as exc:
            log.error("Monitor startup error (non-fatal): %s", exc)

    t = threading.Thread(target=_do_start, daemon=True, name="monitor-startup")
    t.start()
