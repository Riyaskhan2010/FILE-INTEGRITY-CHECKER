"""
V2.1 Migration — adds real-time monitoring columns to monitored_files.
Safe to re-run: skips columns that already exist.
NEVER drops existing data.
"""
import sqlite3, os, sys

DB_PATH = os.path.join(os.path.dirname(__file__), 'integrity_checker.db')

NEW_COLUMNS = [
    # (column_name, column_definition)
    ('abs_file_path',    'TEXT'),                          # full OS path for watcher
    ('last_known_hash',  'TEXT'),                          # last computed hash by watcher
    ('last_known_size',  'INTEGER'),                       # last file size seen
    ('last_modified_at', 'TIMESTAMP'),                     # mtime when last watcher ran
    ('watcher_enabled',  'INTEGER NOT NULL DEFAULT 0'),    # 1 = actively watched
]

def get_existing_columns(conn, table):
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}

def migrate():
    conn = sqlite3.connect(DB_PATH)
    existing = get_existing_columns(conn, 'monitored_files')
    added = []
    skipped = []

    for col_name, col_def in NEW_COLUMNS:
        if col_name in existing:
            skipped.append(col_name)
        else:
            conn.execute(f"ALTER TABLE monitored_files ADD COLUMN {col_name} {col_def}")
            added.append(col_name)

    conn.commit()
    conn.close()

    print("V2.1 Migration complete.")
    print(f"  Added   : {added if added else 'none (all already present)'}")
    print(f"  Skipped : {skipped}")
    print("  No existing data was modified.")

if __name__ == '__main__':
    migrate()
