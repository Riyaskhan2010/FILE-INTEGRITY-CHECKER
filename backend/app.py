import os
import uuid
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from werkzeug.utils import secure_filename

# Load .env file if present (development convenience)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from config import Config
from database import get_db, init_db
from hash_engine import (
    calculate_hash, calculate_all_hashes, verify_integrity,
    ALGORITHM_LABELS, SUPPORTED_ALGORITHMS
)
from auth import register_user, login_user
from report_generator import generate_pdf_report, generate_csv_report
from file_monitor import get_monitor, start_monitor

# ── App setup ─────────────────────────────────────────────────────────────────

app = Flask(__name__)
app.config.from_object(Config)
app.config['JWT_SECRET_KEY'] = Config.JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = Config.JWT_ACCESS_TOKEN_EXPIRES
app.config['MAX_CONTENT_LENGTH'] = Config.MAX_CONTENT_LENGTH

CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
jwt = JWTManager(app)

os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
os.makedirs(Config.REPORTS_FOLDER, exist_ok=True)
os.makedirs(Config.DEMO_FOLDER, exist_ok=True)

# ── Helpers ───────────────────────────────────────────────────────────────────

def allowed_file(filename: str) -> bool:
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    return ext in Config.ALLOWED_EXTENSIONS

def format_size(size_bytes: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"

def row_to_dict(row):
    return dict(row) if row else None

def err(msg, code=400):
    return jsonify({'success': False, 'error': msg}), code

def ok(data=None, **kwargs):
    resp = {'success': True}
    if data:
        resp.update(data)
    resp.update(kwargs)
    return jsonify(resp)

# ── Auth routes ───────────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not name or not email or not password:
        return err('Name, email, and password are required')

    result = register_user(name, email, password)
    if not result['success']:
        return err(result['error'])

    token = create_access_token(identity=str(result['user_id']))
    return ok({'token': token, 'user': {'id': result['user_id'], 'name': result['name'], 'email': result['email']}}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not email or not password:
        return err('Email and password are required')

    result = login_user(email, password)
    if not result['success']:
        return err(result['error'], 401)

    token = create_access_token(identity=str(result['user_id']))
    return ok({'token': token, 'user': {'id': result['user_id'], 'name': result['name'], 'email': result['email']}})


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        user = conn.execute('SELECT id, name, email, created_at FROM users WHERE id = ?', (user_id,)).fetchone()
        if not user:
            return err('User not found', 404)
        return ok({'user': row_to_dict(user)})
    finally:
        conn.close()


@app.route('/api/auth/change-password', methods=['POST'])
@jwt_required()
def change_password():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    current_pw = data.get('current_password', '')
    new_pw     = data.get('new_password', '')

    if not current_pw or not new_pw:
        return err('Both current and new password are required')
    if len(new_pw) < 8:
        return err('New password must be at least 8 characters')

    from auth import verify_password, hash_password, validate_password
    conn = get_db()
    try:
        user = conn.execute('SELECT password_hash FROM users WHERE id=?', (user_id,)).fetchone()
        if not user or not verify_password(current_pw, user['password_hash']):
            return err('Current password is incorrect', 401)
        valid, msg = validate_password(new_pw)
        if not valid:
            return err(msg)
        new_hash = hash_password(new_pw)
        conn.execute('UPDATE users SET password_hash=? WHERE id=?', (new_hash, user_id))
        conn.commit()
        return ok({'message': 'Password updated successfully'})
    except Exception as e:
        conn.rollback()
        return err(str(e))
    finally:
        conn.close()

# ── Dashboard ─────────────────────────────────────────────────────────────────

@app.route('/api/dashboard', methods=['GET'])
@jwt_required()
def dashboard():
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        # Monitored files stats
        total = conn.execute('SELECT COUNT(*) FROM monitored_files WHERE user_id = ?', (user_id,)).fetchone()[0]
        
        # Verified count: files with verified status from last scan
        verified_count = 0
        modified_count = 0
        new_count = 0
        
        # Get latest scan per file
        files = conn.execute('SELECT id FROM monitored_files WHERE user_id = ?', (user_id,)).fetchall()
        for f in files:
            last_scan = conn.execute('''
                SELECT status FROM scan_history 
                WHERE user_id = ? AND file_id = ? 
                ORDER BY scanned_at DESC LIMIT 1
            ''', (user_id, f['id'])).fetchone()
            if last_scan:
                s = last_scan['status']
                if s == 'VERIFIED':
                    verified_count += 1
                elif s == 'MODIFIED':
                    modified_count += 1
                elif s == 'NEW':
                    new_count += 1

        # Also count demo files
        demo_verified = conn.execute("SELECT COUNT(*) FROM demo_files WHERE user_id=? AND status='verified'", (user_id,)).fetchone()[0]
        demo_modified = conn.execute("SELECT COUNT(*) FROM demo_files WHERE user_id=? AND status='modified'", (user_id,)).fetchone()[0]
        demo_new = conn.execute("SELECT COUNT(*) FROM demo_files WHERE user_id=? AND status='new'", (user_id,)).fetchone()[0]
        demo_total = conn.execute("SELECT COUNT(*) FROM demo_files WHERE user_id=?", (user_id,)).fetchone()[0]

        unread_alerts = conn.execute(
            "SELECT COUNT(*) FROM alerts WHERE user_id=? AND status='unread'", (user_id,)
        ).fetchone()[0]

        total_scans = conn.execute('SELECT COUNT(*) FROM scan_history WHERE user_id=?', (user_id,)).fetchone()[0]
        
        last_scan_row = conn.execute(
            'SELECT scanned_at FROM scan_history WHERE user_id=? ORDER BY scanned_at DESC LIMIT 1', (user_id,)
        ).fetchone()
        last_scan = last_scan_row['scanned_at'] if last_scan_row else None

        # Active monitoring
        active_monitoring = conn.execute(
            "SELECT COUNT(*) FROM monitored_files WHERE user_id=? AND monitoring_status='active'", (user_id,)
        ).fetchone()[0]

        # Security score
        all_files_total = total + demo_total
        all_verified = verified_count + demo_verified
        all_modified = modified_count + demo_modified
        
        if all_files_total > 0:
            base_score = (all_verified / all_files_total) * 70
            alert_penalty = min(unread_alerts * 5, 20)
            modified_penalty = min(all_modified * 5, 15)
            score = max(0, min(100, int(base_score + 25 - alert_penalty - modified_penalty)))
        else:
            score = 85

        # Recent activity (last 10 scans)
        recent = conn.execute('''
            SELECT file_name, status, scanned_at, is_demo, scan_type
            FROM scan_history
            WHERE user_id = ?
            ORDER BY scanned_at DESC LIMIT 10
        ''', (user_id,)).fetchall()

        # Chart data - last 7 days
        chart_data = []
        for i in range(6, -1, -1):
            day_scans = conn.execute('''
                SELECT 
                    SUM(CASE WHEN status='VERIFIED' THEN 1 ELSE 0 END) as verified,
                    SUM(CASE WHEN status='MODIFIED' THEN 1 ELSE 0 END) as modified,
                    SUM(CASE WHEN status='NEW' THEN 1 ELSE 0 END) as new_files
                FROM scan_history
                WHERE user_id=? AND DATE(scanned_at) = DATE('now', ?)
            ''', (user_id, f'-{i} days')).fetchone()
            
            from datetime import date, timedelta
            day = (date.today() - timedelta(days=i)).strftime('%a')
            chart_data.append({
                'day': day,
                'verified': day_scans['verified'] or 0,
                'modified': day_scans['modified'] or 0,
                'new': day_scans['new_files'] or 0,
            })

        return ok({
            'stats': {
                'total_files': total + demo_total,
                'verified': verified_count + demo_verified,
                'modified': modified_count + demo_modified,
                'new_files': new_count + demo_new,
                'active_monitoring': active_monitoring,
                'unread_alerts': unread_alerts,
                'total_scans': total_scans,
                'last_scan': last_scan,
                'security_score': score,
            },
            'recent_activity': [row_to_dict(r) for r in recent],
            'chart_data': chart_data,
        })
    finally:
        conn.close()

# ── File upload & hashing ─────────────────────────────────────────────────────

@app.route('/api/files/upload', methods=['POST'])
@jwt_required()
def upload_file():
    if 'file' not in request.files:
        return err('No file provided')
    
    file = request.files['file']
    if not file.filename:
        return err('No file selected')
    
    if not allowed_file(file.filename):
        return err('File type not allowed')

    safe_name = secure_filename(file.filename)
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"
    file_path = os.path.join(Config.UPLOAD_FOLDER, unique_name)
    
    file.save(file_path)
    file_size = os.path.getsize(file_path)
    
    algorithm = request.form.get('algorithm', 'sha256').lower().replace('-', '_')
    if algorithm not in SUPPORTED_ALGORITHMS:
        algorithm = 'sha256'

    try:
        all_hashes = calculate_all_hashes(file_path)
        selected_hash = calculate_hash(file_path, algorithm)
    except Exception as e:
        os.remove(file_path)
        return err(f'Hash calculation failed: {str(e)}')

    file_type = file.content_type or 'application/octet-stream'

    return ok({
        'file': {
            'temp_path': unique_name,
            'original_name': file.filename,
            'safe_name': safe_name,
            'file_size': file_size,
            'file_size_formatted': format_size(file_size),
            'file_type': file_type,
        },
        'hashes': all_hashes,
        'selected_hash': selected_hash,
        'algorithm': algorithm,
    }), 201


@app.route('/api/files/hash', methods=['POST'])
@jwt_required()
def hash_file():
    """Calculate hash of an already-uploaded temp file."""
    data = request.get_json(silent=True) or {}
    temp_path = data.get('temp_path', '')
    algorithm = data.get('algorithm', 'sha256').lower().replace('-', '_')

    if not temp_path or '/' in temp_path or '\\' in temp_path or '..' in temp_path:
        return err('Invalid file reference')

    file_path = os.path.join(Config.UPLOAD_FOLDER, temp_path)
    if not os.path.isfile(file_path):
        return err('File not found')

    if algorithm not in SUPPORTED_ALGORITHMS:
        return err(f'Unsupported algorithm: {algorithm}')

    try:
        h = calculate_hash(file_path, algorithm)
        return ok({'hash': h, 'algorithm': algorithm})
    except Exception as e:
        return err(str(e))


@app.route('/api/files/baseline', methods=['POST'])
@jwt_required()
def save_baseline():
    """Save uploaded file as trusted baseline."""
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    temp_path = data.get('temp_path', '')
    original_name = data.get('original_name', '')
    algorithm = data.get('algorithm', 'sha256').lower().replace('-', '_')
    notes = data.get('notes', '')

    if not temp_path or '/' in temp_path or '\\' in temp_path or '..' in temp_path:
        return err('Invalid file reference')

    file_path = os.path.join(Config.UPLOAD_FOLDER, temp_path)
    if not os.path.isfile(file_path):
        return err('Uploaded file not found. Please re-upload.')

    if algorithm not in SUPPORTED_ALGORITHMS:
        algorithm = 'sha256'

    try:
        trusted_hash = calculate_hash(file_path, algorithm)
    except Exception as e:
        return err(f'Hash calculation failed: {str(e)}')

    file_size = os.path.getsize(file_path)
    safe_name = secure_filename(original_name) if original_name else os.path.basename(temp_path)

    conn = get_db()
    try:
        # Check for duplicate
        existing = conn.execute(
            'SELECT id FROM monitored_files WHERE user_id=? AND file_name=? AND is_demo=0',
            (user_id, safe_name)
        ).fetchone()
        if existing:
            # Update existing baseline
            conn.execute('''
                UPDATE monitored_files
                SET trusted_hash=?, algorithm=?, file_size=?, file_path=?,
                    monitoring_status='active', last_checked=CURRENT_TIMESTAMP
                WHERE id=?
            ''', (trusted_hash, algorithm, file_size, temp_path, existing['id']))
            file_id = existing['id']
            action = 'updated'
        else:
            cursor = conn.execute('''
                INSERT INTO monitored_files
                (user_id, file_name, original_name, file_size, file_type, algorithm, trusted_hash, file_path, monitoring_status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
            ''', (
                user_id, safe_name, original_name or safe_name,
                file_size, 'application/octet-stream',
                algorithm, trusted_hash, temp_path, notes
            ))
            file_id = cursor.lastrowid
            action = 'created'

        # Log scan
        conn.execute('''
            INSERT INTO scan_history
            (user_id, file_id, file_name, algorithm, trusted_hash, current_hash, file_size, status, scan_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'VERIFIED', 'baseline')
        ''', (user_id, file_id, safe_name, algorithm, trusted_hash, trusted_hash, file_size))

        conn.commit()
        return ok({
            'message': f'Trusted baseline {action} successfully',
            'file_id': file_id,
            'file_name': safe_name,
            'trusted_hash': trusted_hash,
            'algorithm': algorithm,
            'action': action
        }), 201
    except Exception as e:
        conn.rollback()
        return err(f'Database error: {str(e)}')
    finally:
        conn.close()


@app.route('/api/files/verify', methods=['POST'])
@jwt_required()
def verify_file():
    """Verify a file against its trusted baseline."""
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    temp_path = data.get('temp_path', '')
    file_id = data.get('file_id')
    file_name = data.get('file_name', '')

    if not temp_path or '/' in temp_path or '\\' in temp_path or '..' in temp_path:
        return err('Invalid file reference')

    file_path = os.path.join(Config.UPLOAD_FOLDER, temp_path)
    if not os.path.isfile(file_path):
        return err('File not found. Please re-upload.')

    conn = get_db()
    try:
        # Find monitored file
        monitored = None
        if file_id:
            monitored = conn.execute(
                'SELECT * FROM monitored_files WHERE id=? AND user_id=?',
                (file_id, user_id)
            ).fetchone()
        elif file_name:
            monitored = conn.execute(
                'SELECT * FROM monitored_files WHERE user_id=? AND file_name=? AND is_demo=0 ORDER BY created_at DESC LIMIT 1',
                (user_id, file_name)
            ).fetchone()

        if not monitored:
            return err('No trusted baseline found for this file. Please save a baseline first.')

        algorithm = monitored['algorithm']
        trusted_hash = monitored['trusted_hash']

        current_hash = calculate_hash(file_path, algorithm)
        current_size = os.path.getsize(file_path)
        result = verify_integrity(trusted_hash, current_hash)

        status = 'VERIFIED' if result['verified'] else 'MODIFIED'

        # Log scan
        scan_cursor = conn.execute('''
            INSERT INTO scan_history
            (user_id, file_id, file_name, algorithm, trusted_hash, current_hash, file_size, status, scan_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'verification')
        ''', (
            user_id, monitored['id'], monitored['file_name'],
            algorithm, trusted_hash, current_hash, current_size, status
        ))
        scan_id = scan_cursor.lastrowid

        # Update last_checked
        conn.execute(
            'UPDATE monitored_files SET last_checked=CURRENT_TIMESTAMP WHERE id=?',
            (monitored['id'],)
        )

        # Create alert on modification
        if not result['verified']:
            fname = monitored['file_name'].lower()
            if any(fname.endswith(x) for x in ['.conf', '.cfg', '.ini', '.json', '.sql', '.env']):
                severity = 'critical'
            elif any(fname.endswith(x) for x in ['.exe', '.dll', '.bin', '.sh', '.bat', '.py', '.js']):
                severity = 'high'
            elif any(fname.endswith(x) for x in ['.pdf', '.doc', '.docx', '.xls', '.xlsx']):
                severity = 'medium'
            else:
                severity = 'high'

            conn.execute('''
                INSERT INTO alerts
                (user_id, file_id, file_name, alert_type, message, severity, status)
                VALUES (?, ?, ?, 'MODIFICATION_DETECTED', ?, ?, 'unread')
            ''', (
                user_id, monitored['id'], monitored['file_name'],
                f"File modification detected on {monitored['file_name']}. "
                f"Trusted hash does not match current hash. "
                f"Hash mismatch confirms the byte content has changed. Investigate immediately.",
                severity
            ))

        conn.commit()
        return ok({
            'verified': result['verified'],
            'status': status,
            'status_label': result['status_label'],
            'trusted_hash': trusted_hash,
            'current_hash': current_hash,
            'algorithm': algorithm,
            'file_name': monitored['file_name'],
            'file_id': monitored['id'],
            'baseline_created': monitored['created_at'],
            'current_size': current_size,
            'current_size_formatted': format_size(current_size),
            'original_size': monitored['file_size'],
            'original_size_formatted': format_size(monitored['file_size']),
            'scan_id': scan_id,
        })
    except Exception as e:
        conn.rollback()
        return err(str(e))
    finally:
        conn.close()


@app.route('/api/files/compare-hash', methods=['POST'])
@jwt_required()
def compare_hash():
    """Compare a file's hash against a manually entered expected hash."""
    user_id = int(get_jwt_identity())

    if 'file' not in request.files:
        return err('No file provided')

    file = request.files['file']
    expected_hash = request.form.get('expected_hash', '').strip().lower()
    algorithm = request.form.get('algorithm', 'sha256').lower().replace('-', '_')

    if not expected_hash:
        return err('Expected hash is required')
    if not file.filename:
        return err('No file selected')
    if algorithm not in SUPPORTED_ALGORITHMS:
        return err(f'Unsupported algorithm: {algorithm}')

    safe_name = secure_filename(file.filename)
    unique_name = f"cmp_{uuid.uuid4().hex}_{safe_name}"
    file_path = os.path.join(Config.UPLOAD_FOLDER, unique_name)
    file.save(file_path)

    try:
        current_hash = calculate_hash(file_path, algorithm)
        match = current_hash.lower() == expected_hash.lower()

        # Log to history
        conn = get_db()
        try:
            conn.execute('''
                INSERT INTO scan_history
                (user_id, file_name, algorithm, trusted_hash, current_hash,
                 file_size, status, scan_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'comparison')
            ''', (
                user_id, safe_name, algorithm,
                expected_hash, current_hash,
                os.path.getsize(file_path),
                'VERIFIED' if match else 'MODIFIED'
            ))
            conn.commit()
        finally:
            conn.close()

        return ok({
            'match': match,
            'status': 'MATCH' if match else 'MISMATCH',
            'status_label': 'Hashes Match – File Integrity Verified' if match else 'Hashes Do Not Match – Possible File Modification. Hash mismatch confirms byte content differs.',
            'expected_hash': expected_hash,
            'current_hash': current_hash,
            'algorithm': algorithm,
            'file_name': safe_name,
        })
    except Exception as e:
        return err(str(e))
    finally:
        if os.path.isfile(file_path):
            os.remove(file_path)

# ── Monitored files ───────────────────────────────────────────────────────────

@app.route('/api/files', methods=['GET'])
@jwt_required()
def get_files():
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        files = conn.execute('''
            SELECT mf.*,
                   sh.status as last_status,
                   sh.scanned_at as last_scan_at,
                   sh.scan_type as last_scan_type
            FROM monitored_files mf
            LEFT JOIN scan_history sh ON sh.id = (
                SELECT id FROM scan_history
                WHERE file_id = mf.id
                ORDER BY scanned_at DESC LIMIT 1
            )
            WHERE mf.user_id = ?
            ORDER BY mf.created_at DESC
        ''', (user_id,)).fetchall()

        demo_files = conn.execute(
            'SELECT * FROM demo_files WHERE user_id=? ORDER BY created_at DESC',
            (user_id,)
        ).fetchall()

        return ok({
            'files': [row_to_dict(f) for f in files],
            'demo_files': [row_to_dict(f) for f in demo_files],
        })
    finally:
        conn.close()


@app.route('/api/files/<int:file_id>', methods=['GET'])
@jwt_required()
def get_file(file_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        f = conn.execute(
            'SELECT * FROM monitored_files WHERE id=? AND user_id=?',
            (file_id, user_id)
        ).fetchone()
        if not f:
            return err('File not found', 404)

        scans = conn.execute(
            'SELECT * FROM scan_history WHERE file_id=? AND user_id=? ORDER BY scanned_at DESC LIMIT 10',
            (file_id, user_id)
        ).fetchall()

        return ok({
            'file': row_to_dict(f),
            'scan_history': [row_to_dict(s) for s in scans]
        })
    finally:
        conn.close()


@app.route('/api/files/<int:file_id>', methods=['DELETE'])
@jwt_required()
def delete_file_record(file_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        f = conn.execute(
            'SELECT file_path FROM monitored_files WHERE id=? AND user_id=?',
            (file_id, user_id)
        ).fetchone()
        if not f:
            return err('File not found', 404)

        conn.execute('DELETE FROM monitored_files WHERE id=? AND user_id=?', (file_id, user_id))
        conn.commit()
        return ok({'message': 'File removed from monitoring'})
    finally:
        conn.close()


@app.route('/api/monitor/start', methods=['POST'])
@jwt_required()
def start_monitoring():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    file_id = data.get('file_id')

    if not file_id:
        return err('file_id required')

    conn = get_db()
    try:
        conn.execute(
            "UPDATE monitored_files SET monitoring_status='active' WHERE id=? AND user_id=?",
            (file_id, user_id)
        )
        conn.commit()
        return ok({'message': 'Monitoring started'})
    finally:
        conn.close()


@app.route('/api/monitor/stop', methods=['POST'])
@jwt_required()
def stop_monitoring():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    file_id = data.get('file_id')

    if not file_id:
        return err('file_id required')

    conn = get_db()
    try:
        conn.execute(
            "UPDATE monitored_files SET monitoring_status='paused' WHERE id=? AND user_id=?",
            (file_id, user_id)
        )
        conn.commit()
        return ok({'message': 'Monitoring paused'})
    finally:
        conn.close()


@app.route('/api/monitor/verify/<int:file_id>', methods=['POST'])
@jwt_required()
def verify_monitored(file_id):
    """Re-verify a monitored file using its stored file path."""
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        monitored = conn.execute(
            'SELECT * FROM monitored_files WHERE id=? AND user_id=?',
            (file_id, user_id)
        ).fetchone()
        if not monitored:
            return err('File not found', 404)

        if not monitored['file_path']:
            return err('Original file not available for re-verification. Please upload the current version.')

        fp = monitored['file_path']
        # Prevent path traversal
        if '/' in fp or '\\' in fp or '..' in fp:
            return err('Invalid file path')
        
        file_path = os.path.join(Config.UPLOAD_FOLDER, fp)
        if not os.path.isfile(file_path):
            return err('Original file not available on server. Please upload the current version to verify.')

        current_hash = calculate_hash(file_path, monitored['algorithm'])
        trusted_hash = monitored['trusted_hash']
        verified = current_hash == trusted_hash
        status = 'VERIFIED' if verified else 'MODIFIED'

        conn.execute('''
            INSERT INTO scan_history
            (user_id, file_id, file_name, algorithm, trusted_hash, current_hash, file_size, status, scan_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
        ''', (
            user_id, file_id, monitored['file_name'],
            monitored['algorithm'], trusted_hash, current_hash,
            monitored['file_size'], status
        ))
        conn.execute('UPDATE monitored_files SET last_checked=CURRENT_TIMESTAMP WHERE id=?', (file_id,))

        if not verified:
            conn.execute('''
                INSERT INTO alerts (user_id, file_id, file_name, alert_type, message, severity, status)
                VALUES (?, ?, ?, 'MODIFICATION_DETECTED', ?, 'high', 'unread')
            ''', (
                user_id, file_id, monitored['file_name'],
                f"Scheduled check detected modification in {monitored['file_name']}"
            ))

        conn.commit()
        return ok({
            'verified': verified,
            'status': status,
            'trusted_hash': trusted_hash,
            'current_hash': current_hash,
        })
    except Exception as e:
        conn.rollback()
        return err(str(e))
    finally:
        conn.close()

# ── Demo ──────────────────────────────────────────────────────────────────────

@app.route('/api/demo/simulate-modification', methods=['POST'])
@jwt_required()
def simulate_modification():
    """Simulate a file modification in demo data."""
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    file_name = data.get('file_name', 'config.json')

    conn = get_db()
    try:
        demo = conn.execute(
            'SELECT * FROM demo_files WHERE user_id=? AND file_name=?',
            (user_id, file_name)
        ).fetchone()
        if not demo:
            return err('Demo file not found')

        import random
        new_hash = ''.join(random.choices('abcdef0123456789', k=len(demo['trusted_hash'])))
        new_size = demo['file_size'] + random.randint(1000, 5000)

        conn.execute(
            "UPDATE demo_files SET current_hash=?, file_size=?, status='modified', last_checked=CURRENT_TIMESTAMP WHERE id=?",
            (new_hash, new_size, demo['id'])
        )

        conn.execute('''
            INSERT INTO scan_history
            (user_id, file_name, algorithm, trusted_hash, current_hash, file_size, status, scan_type, is_demo)
            VALUES (?, ?, ?, ?, ?, ?, 'MODIFIED', 'simulation', 1)
        ''', (user_id, file_name, demo['algorithm'], demo['trusted_hash'], new_hash, new_size))

        conn.execute('''
            INSERT INTO alerts
            (user_id, file_name, alert_type, message, severity, status, is_demo)
            VALUES (?, ?, 'MODIFICATION_DETECTED', ?, 'high', 'unread', 1)
        ''', (
            user_id, file_name,
            f"[DEMO] File modification simulated on {file_name}. Hash mismatch detected."
        ))

        conn.commit()
        return ok({
            'message': f'Modification simulated for {file_name}',
            'file_name': file_name,
            'new_hash': new_hash,
            'trusted_hash': demo['trusted_hash'],
        })
    except Exception as e:
        conn.rollback()
        return err(str(e))
    finally:
        conn.close()


@app.route('/api/demo/run-scan', methods=['POST'])
@jwt_required()
def run_demo_scan():
    """Run a demo scan across all demo files — verifies each against its trusted hash."""
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    file_id = data.get('file_id')  # optional: monitored_files.id for a demo file

    conn = get_db()
    try:
        if file_id:
            # file_id is a monitored_files.id — look up the file_name, then scan that demo file
            mf = conn.execute(
                'SELECT file_name FROM monitored_files WHERE id=? AND user_id=? AND is_demo=1',
                (file_id, user_id)
            ).fetchone()
            if mf:
                demo_files = conn.execute(
                    'SELECT * FROM demo_files WHERE user_id=? AND file_name=?',
                    (user_id, mf['file_name'])
                ).fetchall()
            else:
                # fallback: try by demo_files.id directly
                demo_files = conn.execute(
                    'SELECT * FROM demo_files WHERE user_id=? AND id=?', (user_id, file_id)
                ).fetchall()
            if not demo_files:
                # scan all if specific one not found
                demo_files = conn.execute('SELECT * FROM demo_files WHERE user_id=?', (user_id,)).fetchall()
        else:
            demo_files = conn.execute(
                'SELECT * FROM demo_files WHERE user_id=?', (user_id,)
            ).fetchall()

        if not demo_files:
            return err('No demo files found')

        results = []
        for df in demo_files:
            verified = df['trusted_hash'] == df['current_hash']
            status = 'VERIFIED' if verified else 'MODIFIED'

            conn.execute('''
                INSERT INTO scan_history
                (user_id, file_name, algorithm, trusted_hash, current_hash, file_size, status, scan_type, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'demo_scan', 1)
            ''', (user_id, df['file_name'], df['algorithm'],
                  df['trusted_hash'], df['current_hash'], df['file_size'], status))

            conn.execute(
                'UPDATE demo_files SET last_checked=CURRENT_TIMESTAMP WHERE id=?', (df['id'],)
            )

            if not verified:
                # Assign severity based on file type heuristic
                fname = df['file_name'].lower()
                if any(fname.endswith(x) for x in ['.conf', '.cfg', '.ini', '.json', '.sql']):
                    severity = 'critical'
                elif any(fname.endswith(x) for x in ['.exe', '.dll', '.bin', '.sh', '.bat']):
                    severity = 'high'
                else:
                    severity = 'medium'

                conn.execute('''
                    INSERT INTO alerts
                    (user_id, file_name, alert_type, message, severity, status, is_demo)
                    VALUES (?, ?, 'MODIFICATION_DETECTED', ?, ?, 'unread', 1)
                ''', (user_id, df['file_name'],
                      f"[DEMO] Scan detected modification in {df['file_name']}. Hash mismatch confirmed.",
                      severity))

            results.append({'file_name': df['file_name'], 'status': status})

        conn.commit()
        return ok({'message': f'Demo scan complete — {len(results)} file(s) checked', 'results': results})
    except Exception as e:
        conn.rollback()
        return err(str(e))
    finally:
        conn.close()


@app.route('/api/demo/reset', methods=['POST'])
@jwt_required()
def reset_demo():
    """Reset demo data for user."""
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        conn.execute('DELETE FROM demo_files WHERE user_id=?', (user_id,))
        conn.execute("DELETE FROM scan_history WHERE user_id=? AND is_demo=1", (user_id,))
        conn.execute("DELETE FROM alerts WHERE user_id=? AND is_demo=1", (user_id,))
        conn.execute("DELETE FROM monitored_files WHERE user_id=? AND is_demo=1", (user_id,))
        conn.commit()

        from auth import _seed_demo_data
        _seed_demo_data(conn, user_id)
        conn.commit()

        return ok({'message': 'Demo data reset successfully'})
    except Exception as e:
        conn.rollback()
        return err(str(e))
    finally:
        conn.close()

# ── History ───────────────────────────────────────────────────────────────────

@app.route('/api/history', methods=['GET'])
@jwt_required()
def get_history():
    user_id = int(get_jwt_identity())
    status_filter = request.args.get('status', 'all').upper()
    search   = request.args.get('search', '').strip()
    source   = request.args.get('source', 'all').lower()   # V2.1 source filter
    page     = max(1, int(request.args.get('page', 1)))
    per_page = min(100, max(1, int(request.args.get('per_page', 20))))
    offset   = (page - 1) * per_page

    # Whitelist sort columns to prevent SQL injection
    allowed_sort_cols = {'file_name', 'status', 'algorithm', 'scanned_at', 'scan_type'}
    sort_col = request.args.get('sort_col', 'scanned_at')
    if sort_col not in allowed_sort_cols:
        sort_col = 'scanned_at'
    sort_dir = 'ASC' if request.args.get('sort_dir', 'desc').lower() == 'asc' else 'DESC'

    conn = get_db()
    try:
        where  = ['user_id = ?']
        params = [user_id]

        if status_filter and status_filter != 'ALL':
            where.append('status = ?')
            params.append(status_filter)

        if search:
            where.append('file_name LIKE ?')
            params.append(f'%{search}%')

        # Source filter maps UI labels to scan_type values
        SOURCE_MAP = {
            'realtime':  ['realtime_monitor'],
            'scheduled': ['scheduled'],
            'manual':    ['manual', 'baseline', 'verification', 'comparison'],
            'demo':      ['simulation', 'demo_scan', 'auto'],
        }
        if source and source != 'all' and source in SOURCE_MAP:
            placeholders = ','.join('?' for _ in SOURCE_MAP[source])
            where.append(f'scan_type IN ({placeholders})')
            params.extend(SOURCE_MAP[source])

        where_clause = ' AND '.join(where)

        total = conn.execute(
            f'SELECT COUNT(*) FROM scan_history WHERE {where_clause}', params
        ).fetchone()[0]

        rows = conn.execute(
            f'SELECT * FROM scan_history WHERE {where_clause} '
            f'ORDER BY {sort_col} {sort_dir} LIMIT ? OFFSET ?',
            params + [per_page, offset]
        ).fetchall()

        return ok({
            'history':     [row_to_dict(r) for r in rows],
            'total':       total,
            'page':        page,
            'per_page':    per_page,
            'total_pages': (total + per_page - 1) // per_page,
        })
    finally:
        conn.close()


@app.route('/api/history/<int:scan_id>', methods=['GET'])
@jwt_required()
def get_scan_detail(scan_id):
    """Return full details for a single scan record including related alert and file info."""
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        scan = conn.execute(
            'SELECT * FROM scan_history WHERE id=? AND user_id=?',
            (scan_id, user_id)
        ).fetchone()
        if not scan:
            return err('Scan record not found', 404)

        scan_dict = row_to_dict(scan)

        # Enrich with monitored file details if available
        file_info = None
        if scan['file_id']:
            f = conn.execute(
                'SELECT id, file_name, file_size, file_type, algorithm, trusted_hash, '
                'monitoring_status, created_at, last_checked, abs_file_path, watcher_enabled '
                'FROM monitored_files WHERE id=? AND user_id=?',
                (scan['file_id'], user_id)
            ).fetchone()
            if f:
                file_info = row_to_dict(f)
                # Do not expose abs_file_path in detail response (privacy)
                file_info.pop('abs_file_path', None)

        # Related alert (most recent for this file/scan combination)
        alert = None
        if scan['file_id']:
            a = conn.execute(
                'SELECT id, alert_type, message, severity, status, created_at '
                'FROM alerts WHERE file_id=? AND user_id=? '
                'ORDER BY created_at DESC LIMIT 1',
                (scan['file_id'], user_id)
            ).fetchone()
            if a:
                alert = row_to_dict(a)
        elif scan['file_name']:
            # fallback: match by filename for scans without file_id
            a = conn.execute(
                'SELECT id, alert_type, message, severity, status, created_at '
                'FROM alerts WHERE file_name=? AND user_id=? '
                'ORDER BY created_at DESC LIMIT 1',
                (scan['file_name'], user_id)
            ).fetchone()
            if a:
                alert = row_to_dict(a)

        # Timeline: find previous VERIFIED scan for the same file
        prev_verified = None
        if scan['file_id']:
            pv = conn.execute(
                'SELECT scanned_at, current_hash, file_size FROM scan_history '
                'WHERE file_id=? AND user_id=? AND status=? AND id<? '
                'ORDER BY scanned_at DESC LIMIT 1',
                (scan['file_id'], user_id, 'VERIFIED', scan_id)
            ).fetchone()
            if pv:
                prev_verified = row_to_dict(pv)

        # Baseline: find the baseline scan for context
        baseline_scan = None
        if scan['file_id']:
            bs = conn.execute(
                'SELECT scanned_at, trusted_hash FROM scan_history '
                'WHERE file_id=? AND user_id=? AND scan_type=? '
                'ORDER BY scanned_at ASC LIMIT 1',
                (scan['file_id'], user_id, 'baseline')
            ).fetchone()
            if bs:
                baseline_scan = row_to_dict(bs)

        # Map scan_type to human-readable source label
        SOURCE_LABELS = {
            'realtime_monitor': 'Real-Time Monitor',
            'scheduled':        'Scheduled Scan',
            'manual':           'Manual Verification',
            'baseline':         'Baseline Creation',
            'verification':     'Manual Verification',
            'comparison':       'Hash Comparison',
            'simulation':       'Demo Simulation',
            'demo_scan':        'Demo Scan',
            'auto':             'Automatic Scan',
        }
        source_label = SOURCE_LABELS.get(scan['scan_type'], scan['scan_type'].replace('_', ' ').title())

        return ok({
            'scan':           scan_dict,
            'source_label':   source_label,
            'file_info':      file_info,
            'related_alert':  alert,
            'prev_verified':  prev_verified,
            'baseline_scan':  baseline_scan,
        })
    finally:
        conn.close()

# ── Alerts ────────────────────────────────────────────────────────────────────

@app.route('/api/alerts', methods=['GET'])
@jwt_required()
def get_alerts():
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        alerts = conn.execute(
            'SELECT * FROM alerts WHERE user_id=? ORDER BY created_at DESC',
            (user_id,)
        ).fetchall()
        return ok({'alerts': [row_to_dict(a) for a in alerts]})
    finally:
        conn.close()


@app.route('/api/alerts/<int:alert_id>/review', methods=['POST'])
@jwt_required()
def review_alert(alert_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        conn.execute(
            "UPDATE alerts SET status='reviewed' WHERE id=? AND user_id=?",
            (alert_id, user_id)
        )
        conn.commit()
        return ok({'message': 'Alert marked as reviewed'})
    finally:
        conn.close()


@app.route('/api/alerts/clear-all', methods=['DELETE'])
@jwt_required()
def clear_all_alerts():
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        conn.execute('DELETE FROM alerts WHERE user_id=?', (user_id,))
        conn.commit()
        return ok({'message': 'All alerts cleared'})
    finally:
        conn.close()


@app.route('/api/alerts/<int:alert_id>', methods=['DELETE'])
@jwt_required()
def delete_alert(alert_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        conn.execute('DELETE FROM alerts WHERE id=? AND user_id=?', (alert_id, user_id))
        conn.commit()
        return ok({'message': 'Alert deleted'})
    finally:
        conn.close()

# ── Reports ───────────────────────────────────────────────────────────────────

@app.route('/api/reports/generate', methods=['POST'])
@jwt_required()
def generate_report():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    file_id = data.get('file_id')
    scan_id = data.get('scan_id')
    report_format = data.get('format', 'pdf').lower()

    if report_format not in ('pdf', 'csv'):
        return err('Format must be pdf or csv')

    conn = get_db()
    try:
        user = conn.execute('SELECT name FROM users WHERE id=?', (user_id,)).fetchone()

        report_data = {}

        if scan_id:
            scan = conn.execute('SELECT * FROM scan_history WHERE id=? AND user_id=?', (scan_id, user_id)).fetchone()
            if not scan:
                return err('Scan not found')
            report_data = {
                'file_name': scan['file_name'],
                'file_size': scan['file_size'] or 0,
                'file_type': 'N/A',
                'algorithm': scan['algorithm'],
                'trusted_hash': scan['trusted_hash'] or 'N/A',
                'current_hash': scan['current_hash'],
                'status': scan['status'],
                'scan_date': scan['scanned_at'],
                'scan_type': scan['scan_type'].title(),
            }
            if file_id:
                f = conn.execute('SELECT * FROM monitored_files WHERE id=? AND user_id=?', (file_id, user_id)).fetchone()
                if f:
                    report_data['file_size'] = f['file_size']
                    report_data['file_type'] = f['file_type']
        elif file_id:
            f = conn.execute('SELECT * FROM monitored_files WHERE id=? AND user_id=?', (file_id, user_id)).fetchone()
            if not f:
                return err('File not found')
            scan = conn.execute(
                'SELECT * FROM scan_history WHERE file_id=? AND user_id=? ORDER BY scanned_at DESC LIMIT 1',
                (file_id, user_id)
            ).fetchone()
            report_data = {
                'file_name': f['file_name'],
                'file_size': f['file_size'],
                'file_type': f['file_type'],
                'algorithm': f['algorithm'],
                'trusted_hash': f['trusted_hash'],
                'current_hash': scan['current_hash'] if scan else f['trusted_hash'],
                'status': scan['status'] if scan else 'VERIFIED',
                'scan_date': scan['scanned_at'] if scan else f['created_at'],
                'scan_type': scan['scan_type'].title() if scan else 'Baseline',
            }
        else:
            return err('file_id or scan_id required')

        report_id = f"RPT-{uuid.uuid4().hex[:8].upper()}"
        report_data['user_name'] = user['name'] if user else 'Unknown'
        report_data['report_id'] = report_id

        if report_format == 'pdf':
            filename = f"integrity_report_{report_id}.pdf"
            output_path = os.path.join(Config.REPORTS_FOLDER, filename)
            generate_pdf_report(report_data, output_path)
            return send_file(
                output_path,
                as_attachment=True,
                download_name=filename,
                mimetype='application/pdf'
            )
        else:
            csv_content = generate_csv_report(report_data)
            filename = f"integrity_report_{report_id}.csv"
            from flask import Response
            return Response(
                csv_content,
                mimetype='text/csv',
                headers={'Content-Disposition': f'attachment; filename={filename}'}
            )
    except Exception as e:
        return err(f'Report generation failed: {str(e)}')
    finally:
        conn.close()


@app.route('/api/reports/history-csv', methods=['GET'])
@jwt_required()
def export_history_csv():
    """Export the full scan history as a CSV file."""
    import csv
    import io
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        rows = conn.execute(
            'SELECT * FROM scan_history WHERE user_id=? ORDER BY scanned_at DESC',
            (user_id,)
        ).fetchall()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'File Name', 'Scan Type', 'Algorithm', 'Status',
                         'Trusted Hash', 'Current Hash', 'File Size (bytes)',
                         'Demo', 'Scanned At'])
        for r in rows:
            writer.writerow([
                r['id'], r['file_name'], r['scan_type'], r['algorithm'],
                r['status'], r['trusted_hash'] or '', r['current_hash'],
                r['file_size'] or '', 'Yes' if r['is_demo'] else 'No',
                r['scanned_at']
            ])

        from flask import Response
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=scan_history.csv'}
        )
    except Exception as e:
        return err(f'Export failed: {str(e)}')
    finally:
        conn.close()


# ── V2.1 Real-Time File Monitoring ───────────────────────────────────────────

@app.route('/api/monitor/status', methods=['GET'])
@jwt_required()
def monitor_status():
    """Return the real-time monitoring service status."""
    svc = get_monitor()
    s   = svc.get_status()
    return ok({
        'service_running':  s['running'],
        'watched_files':    s['watched_files'],
        'watched_dirs':     s['watched_dirs'],
        'active_file_ids':  svc.active_file_ids(),
    })


@app.route('/api/files/<int:file_id>/monitor', methods=['POST'])
@jwt_required()
def enable_realtime_monitor(file_id):
    """
    Register an absolute local filesystem path for real-time monitoring.
    Body: { "abs_path": "/absolute/path/to/file.txt" }
    The file must exist on the server's filesystem.
    """
    user_id = int(get_jwt_identity())
    data    = request.get_json(silent=True) or {}
    abs_path = (data.get('abs_path') or '').strip()

    if not abs_path:
        return err('abs_path is required')

    # Security: must be absolute, no traversal
    abs_path = os.path.normpath(abs_path)
    if not os.path.isabs(abs_path):
        return err('abs_path must be an absolute filesystem path')
    if '..' in abs_path:
        return err('Path traversal not allowed')
    if not os.path.isfile(abs_path):
        return err(f'File not found at path: {abs_path}')

    conn = get_db()
    try:
        mf = conn.execute(
            'SELECT * FROM monitored_files WHERE id=? AND user_id=? AND is_demo=0',
            (file_id, user_id)
        ).fetchone()
        if not mf:
            return err('Monitored file not found', 404)

        # Persist the abs_path + enable watcher flag
        conn.execute('''
            UPDATE monitored_files
            SET abs_file_path=?, watcher_enabled=1, monitoring_status='active'
            WHERE id=?
        ''', (abs_path, file_id))
        conn.commit()
    finally:
        conn.close()

    # Register with the live monitoring service
    svc = get_monitor()
    ok_reg = svc.register(
        file_id      = file_id,
        user_id      = user_id,
        abs_path     = abs_path,
        trusted_hash = mf['trusted_hash'],
        algorithm    = mf['algorithm'],
    )
    if not ok_reg:
        return err('Failed to register watcher — file may not be accessible')

    return ok({
        'message':   'Real-time monitoring enabled',
        'file_id':   file_id,
        'abs_path':  abs_path,
        'algorithm': mf['algorithm'],
    })


@app.route('/api/files/<int:file_id>/pause-monitoring', methods=['POST'])
@jwt_required()
def pause_realtime_monitor(file_id):
    """Pause real-time monitoring (watcher removed, baseline kept)."""
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        mf = conn.execute(
            'SELECT id FROM monitored_files WHERE id=? AND user_id=? AND is_demo=0',
            (file_id, user_id)
        ).fetchone()
        if not mf:
            return err('Monitored file not found', 404)
        conn.execute(
            "UPDATE monitored_files SET watcher_enabled=0, monitoring_status='paused' WHERE id=?",
            (file_id,)
        )
        conn.commit()
    finally:
        conn.close()

    get_monitor().pause(file_id)
    return ok({'message': 'Monitoring paused', 'file_id': file_id})


@app.route('/api/files/<int:file_id>/resume-monitoring', methods=['POST'])
@jwt_required()
def resume_realtime_monitor(file_id):
    """Resume a paused real-time watcher."""
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        mf = conn.execute(
            'SELECT * FROM monitored_files WHERE id=? AND user_id=? AND is_demo=0',
            (file_id, user_id)
        ).fetchone()
        if not mf:
            return err('Monitored file not found', 404)
        if not mf['abs_file_path']:
            return err('No filesystem path registered. Call POST /monitor first.')
        conn.execute(
            "UPDATE monitored_files SET watcher_enabled=1, monitoring_status='active' WHERE id=?",
            (file_id,)
        )
        conn.commit()
    finally:
        conn.close()

    svc = get_monitor()
    ok_res = svc.resume(file_id)
    if not ok_res:
        return err('Could not resume — file may no longer be accessible at stored path')
    return ok({'message': 'Monitoring resumed', 'file_id': file_id})


@app.route('/api/files/<int:file_id>/disable-monitoring', methods=['POST'])
@jwt_required()
def disable_realtime_monitor(file_id):
    """Disable real-time monitoring and clear the stored path."""
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        mf = conn.execute(
            'SELECT id FROM monitored_files WHERE id=? AND user_id=? AND is_demo=0',
            (file_id, user_id)
        ).fetchone()
        if not mf:
            return err('Monitored file not found', 404)
        conn.execute('''
            UPDATE monitored_files
            SET watcher_enabled=0, monitoring_status='paused', abs_file_path=NULL
            WHERE id=?
        ''', (file_id,))
        conn.commit()
    finally:
        conn.close()

    get_monitor().unregister(file_id)
    return ok({'message': 'Real-time monitoring disabled', 'file_id': file_id})


@app.route('/api/files/<int:file_id>/monitoring-info', methods=['GET'])
@jwt_required()
def get_monitoring_info(file_id):
    """Return realtime monitoring details for a single file."""
    user_id = int(get_jwt_identity())
    conn = get_db()
    try:
        mf = conn.execute(
            '''SELECT id, file_name, algorithm, trusted_hash, abs_file_path,
                      watcher_enabled, monitoring_status, last_known_hash,
                      last_known_size, last_modified_at, last_checked
               FROM monitored_files WHERE id=? AND user_id=? AND is_demo=0''',
            (file_id, user_id)
        ).fetchone()
        if not mf:
            return err('File not found', 404)
        d = row_to_dict(mf)
        d['currently_watched'] = file_id in get_monitor().active_file_ids()
        return ok({'file': d})
    finally:
        conn.close()


# ── Error handlers ─────────────────────────────────────────────────────────────

@app.errorhandler(413)
def too_large(e):
    return err('File too large. Maximum size is 50 MB.', 413)

@app.errorhandler(404)
def not_found(e):
    return err('Endpoint not found', 404)

@app.errorhandler(500)
def internal_error(e):
    return err('Internal server error', 500)

@app.errorhandler(405)
def method_not_allowed(e):
    return err('Method not allowed', 405)


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    # Run V2.1 migration (safe to re-run — skips existing columns)
    try:
        from migrate_v2_1 import migrate
        migrate()
    except Exception as _me:
        print(f"Migration warning: {_me}")

    # Start the real-time monitoring service
    # Guard prevents duplicate watchers when Werkzeug reloader is active
    start_monitor()

    print("Starting File Integrity Checker API v2.1...")
    print("API running at http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
