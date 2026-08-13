import bcrypt
import re
from database import get_db

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def validate_email(email: str) -> bool:
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Za-z]', password):
        return False, "Password must contain at least one letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    return True, "OK"

def register_user(name: str, email: str, password: str) -> dict:
    """Register a new user."""
    name = name.strip()
    email = email.strip().lower()
    
    if not name or len(name) < 2:
        return {'success': False, 'error': 'Name must be at least 2 characters'}
    
    if not validate_email(email):
        return {'success': False, 'error': 'Invalid email address'}
    
    valid_pw, pw_msg = validate_password(password)
    if not valid_pw:
        return {'success': False, 'error': pw_msg}
    
    conn = get_db()
    try:
        existing = conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        if existing:
            return {'success': False, 'error': 'Email already registered'}
        
        password_hash = hash_password(password)
        cursor = conn.execute(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            (name, email, password_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
        
        # Seed demo data for new user
        _seed_demo_data(conn, user_id)
        conn.commit()
        
        return {'success': True, 'user_id': user_id, 'name': name, 'email': email}
    except Exception as e:
        conn.rollback()
        return {'success': False, 'error': f'Registration failed: {str(e)}'}
    finally:
        conn.close()

def login_user(email: str, password: str) -> dict:
    """Authenticate a user."""
    email = email.strip().lower()
    
    conn = get_db()
    try:
        user = conn.execute(
            'SELECT id, name, email, password_hash FROM users WHERE email = ?',
            (email,)
        ).fetchone()
        
        if not user:
            return {'success': False, 'error': 'Invalid email or password'}
        
        if not verify_password(password, user['password_hash']):
            return {'success': False, 'error': 'Invalid email or password'}
        
        return {
            'success': True,
            'user_id': user['id'],
            'name': user['name'],
            'email': user['email']
        }
    finally:
        conn.close()

def _seed_demo_data(conn, user_id: int):
    """Seed demo data for a new user."""
    import hashlib
    import random
    import string
    from datetime import datetime, timedelta

    demo_files = [
        {
            'file_name': 'report.pdf',
            'file_size': 2457600,
            'file_type': 'application/pdf',
            'algorithm': 'sha256',
            'status': 'verified',
        },
        {
            'file_name': 'config.json',
            'file_size': 18432,
            'file_type': 'application/json',
            'algorithm': 'sha256',
            'status': 'modified',
        },
        {
            'file_name': 'backup.zip',
            'file_size': 15728640,
            'file_type': 'application/zip',
            'algorithm': 'sha512',
            'status': 'verified',
        },
        {
            'file_name': 'database.sql',
            'file_size': 5242880,
            'file_type': 'application/sql',
            'algorithm': 'sha256',
            'status': 'new',
        },
        {
            'file_name': 'system.conf',
            'file_size': 4096,
            'file_type': 'text/plain',
            'algorithm': 'sha256',
            'status': 'verified',
        },
    ]

    def rand_hash(length=64):
        return ''.join(random.choices('abcdef0123456789', k=length))

    for df in demo_files:
        trusted_hash = rand_hash(64 if df['algorithm'] == 'sha256' else 128)
        if df['status'] == 'modified':
            current_hash = rand_hash(64 if df['algorithm'] == 'sha256' else 128)
        elif df['status'] == 'new':
            current_hash = rand_hash(64 if df['algorithm'] == 'sha256' else 128)
            trusted_hash = current_hash
        else:
            current_hash = trusted_hash

        conn.execute('''
            INSERT INTO demo_files
            (user_id, file_name, file_size, file_type, algorithm, trusted_hash, current_hash, status, monitoring_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id, df['file_name'], df['file_size'], df['file_type'],
            df['algorithm'], trusted_hash, current_hash,
            df['status'], 'active'
        ))

        # Also add to monitored files
        m_status = 'verified' if df['status'] == 'verified' else df['status']
        conn.execute('''
            INSERT INTO monitored_files
            (user_id, file_name, original_name, file_size, file_type, algorithm, trusted_hash, monitoring_status, is_demo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        ''', (
            user_id, df['file_name'], df['file_name'],
            df['file_size'], df['file_type'], df['algorithm'], trusted_hash, 'active'
        ))

        # Add scan history entries
        scan_status = df['status'].upper()
        if scan_status == 'MODIFIED':
            scan_status = 'MODIFIED'
        elif scan_status == 'NEW':
            scan_status = 'NEW'
        else:
            scan_status = 'VERIFIED'

        conn.execute('''
            INSERT INTO scan_history
            (user_id, file_name, algorithm, trusted_hash, current_hash, file_size, status, scan_type, is_demo)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'auto', 1)
        ''', (
            user_id, df['file_name'], df['algorithm'],
            trusted_hash, current_hash, df['file_size'], scan_status
        ))

        # Add alert for modified files
        if df['status'] == 'modified':
            conn.execute('''
                INSERT INTO alerts
                (user_id, file_name, alert_type, message, severity, status, is_demo)
                VALUES (?, ?, 'MODIFICATION_DETECTED', ?, 'high', 'unread', 1)
            ''', (
                user_id, df['file_name'],
                f"File modification detected on {df['file_name']}. Hash mismatch found during scheduled verification."
            ))
