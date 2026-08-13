import sqlite3
conn = sqlite3.connect('integrity_checker.db')
conn.row_factory = sqlite3.Row
for row in conn.execute("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"):
    print("TABLE:", row['name'])
    print(row['sql'])
    print()
    # Show column info
    for col in conn.execute(f"PRAGMA table_info({row['name']})"):
        print(f"  col {col['cid']}: {col['name']} {col['type']} {'NOT NULL' if col['notnull'] else 'NULL'} default={col['dflt_value']}")
    print()
conn.close()
