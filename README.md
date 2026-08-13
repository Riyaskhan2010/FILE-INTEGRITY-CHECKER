# File Integrity Checker

**Cybersecurity File Monitoring & Tamper Detection System**

> Detect File Changes. Verify Integrity. Protect Critical Data.

A production-quality cybersecurity web application built as an internship project focused on
practical cryptographic file integrity verification, real-time filesystem monitoring, and tamper detection.

---

## Overview

File Integrity Checker generates cryptographic fingerprints (hashes) for files, stores trusted baselines,
and automatically detects when a file's content changes. When a monitored file is modified, the system
immediately creates a security alert and records the event in a tamper-evident audit trail.

---

## Problem Statement

Files can be silently modified, corrupted, or replaced — by malware, unauthorized access, storage
failures, or supply-chain attacks. Without a mechanism to detect these changes, critical configuration
files, binaries, and documents may be compromised without anyone noticing.

---

## Solution

File Integrity Checker solves this by:

1. Calculating a cryptographic hash (SHA-256/SHA-512) for any file
2. Storing the hash as a **trusted baseline**
3. Continuously watching the file via a real-time filesystem watcher
4. Recalculating the hash whenever a change is detected
5. Comparing the new hash against the baseline
6. Creating a security alert and audit trail entry on mismatch

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Cryptographic Hashing** | SHA-256, SHA-512, SHA-3-256, SHA-3-512, MD5 (legacy) |
| **Trusted Baseline** | Save a file's hash as the reference point for future comparisons |
| **Integrity Verification** | Re-upload or re-check any file to detect content changes |
| **Real-Time Monitoring (V2.1)** | Watchdog-based filesystem watcher detects changes automatically |
| **Tamper Detection** | Hash mismatch immediately flags a file as MODIFIED |
| **Security Alerts** | Automatic alerts with severity levels (CRITICAL / HIGH / MEDIUM / LOW) |
| **Scan History** | Complete paginated audit trail with source filtering and detail view |
| **Hash Comparison Tool** | Compare any file against a known hash value |
| **PDF & CSV Reports** | Export integrity reports for documentation |
| **Demo Mode** | Pre-loaded demo data with simulate/reset controls, fully isolated |
| **Dashboard** | Live statistics, charts, security score, recommended actions |

---

## Real-Time File Monitoring

Version 2.1 introduces a genuine Python filesystem watcher using **watchdog**:

```
User saves trusted baseline
        ↓
Enable monitoring (provide full filesystem path)
        ↓
FileMonitorService (singleton, watchdog Observer)
        ↓
File change detected on disk
        ↓
3-second debounce (suppress rapid saves)
        ↓
Recalculate cryptographic hash
        ↓
Compare with trusted baseline
        ↓
Hash mismatch → MODIFIED
        ↓
Security alert created (CRITICAL/HIGH/MEDIUM)
        ↓
Scan history entry (scan_type = realtime_monitor)
        ↓
Dashboard updates
```

**Supported change types:** `MODIFIED` · `DELETED` · `RECREATED_VERIFIED` · `RECREATED_MODIFIED`

> **Note:** Real-time monitoring runs server-side and requires the file to be accessible on the
> machine running the Flask backend. Browser-based applications cannot monitor arbitrary local files
> after the browser is closed.

---

## Cryptographic Hash Verification

```
Original File ──→ SHA-256 Hash ──→ Trusted Baseline
                                          │
Current File  ──→ SHA-256 Hash ──────────→ Compare
                                          │
                              Match: ✓ INTEGRITY VERIFIED
                              Mismatch: ⚠ MODIFICATION DETECTED
```

A hash mismatch confirms that the file's byte content has changed. It does not identify
who changed the file or why — only that a change occurred.

---

## Supported Algorithms

| Algorithm  | Digest Size | Security Status        |
|------------|-------------|------------------------|
| SHA-256    | 256-bit     | ✓ Recommended          |
| SHA-512    | 512-bit     | ✓ Recommended          |
| SHA-3-256  | 256-bit     | ✓ Recommended          |
| SHA-3-512  | 512-bit     | ✓ Recommended          |
| MD5        | 128-bit     | ✗ Legacy only — broken |

> MD5 is included for legacy compatibility and reference purposes only.
> It must not be used for security-sensitive integrity verification.

---

## System Architecture

```
React Frontend (Vite + Tailwind CSS)
        ↓  REST API (JSON)
Flask Backend (Python)
        ↓
┌───────────────────────────────────┐
│  Authentication  (JWT + bcrypt)   │
│  File Processing (werkzeug)       │
│  Hash Engine     (Python hashlib) │
│  Integrity Logic (compare hashes) │
│  Monitoring Svc  (watchdog V2.1)  │
└───────────────────────────────────┘
        ↓
SQLite Database
        ↓
Dashboard · Alerts · Audit Trail · Reports
```

---

## Technology Stack

| Layer             | Technology                              |
|-------------------|-----------------------------------------|
| Frontend          | React 18, Vite, Tailwind CSS, Recharts  |
| Backend           | Python, Flask                           |
| Database          | SQLite (via Python `sqlite3`)           |
| Cryptographic lib | Python `hashlib`                        |
| Filesystem watch  | `watchdog` 6.0                          |
| Authentication    | JWT (`flask-jwt-extended`) + bcrypt     |
| Report generation | ReportLab (PDF), Python `csv` (CSV)     |
| API               | REST (JSON)                             |

---

## Installation

### Prerequisites

- Python 3.10 or later
- Node.js 18 or later
- pip

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend
npm install
```

### Environment Variables (optional)

```bash
# Copy the example file
cp backend/.env.example backend/.env

# Edit backend/.env and set real values
SECRET_KEY=your-long-random-secret
JWT_SECRET_KEY=your-long-random-jwt-secret
```

If `.env` is not provided, the application falls back to development defaults automatically.

---

## Running the Application

### Option A — Batch files (Windows)

Double-click in the project root:

- `start_backend.bat` — starts the Flask API on port 5000
- `start_frontend.bat` — starts the React dev server on port 5173

### Option B — Terminal

**Terminal 1 — Backend:**
```bash
cd backend
python app.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## Usage

### Basic Integrity Check

1. **Sign up** at `/register` and log in
2. Go to **Integrity Check** → upload any file
3. SHA-256, SHA-512, SHA-3, and MD5 hashes are calculated immediately
4. Click **Save as Trusted Baseline** to store the hash
5. Later, re-upload the same file and click **Verify** to compare
6. The result shows **INTEGRITY VERIFIED** or **MODIFICATION DETECTED**

### Real-Time Monitoring

1. Save a trusted baseline for a file (step 1–4 above)
2. Go to **Monitored Files** → expand the file card → click **Enable Monitoring**
3. Enter the **full filesystem path** to the file (e.g. `C:\Users\you\config.json`)
4. The backend now watches that path continuously
5. Edit the file in any editor and save
6. Within ~4 seconds: a security alert is created automatically
7. Check **Security Alerts** and **Scan History** for the detection event

### Hash Comparison

1. Go to **Hash Comparison**
2. Paste any known hash (e.g. from a software publisher)
3. Upload the file you want to verify
4. The result confirms whether the file matches the expected hash

### Demo Mode

Use the **Demo Mode** panel on the Dashboard to:

- **Run Demo Scan** — verify all demo files
- **Simulate Modification** — trigger a fake tampering event on `config.json`
- **Reset Demo Data** — restore demo data to its original state

All demo events are labelled **[DEMO]** and are completely isolated from real user data.

---

## API Reference

### Authentication

| Method | Endpoint               | Description                |
|--------|------------------------|----------------------------|
| POST   | `/api/auth/register`   | Create account             |
| POST   | `/api/auth/login`      | Login, receive JWT token   |
| GET    | `/api/auth/me`         | Get current user profile   |
| POST   | `/api/auth/change-password` | Change password       |

### Files & Hashing

| Method | Endpoint                    | Description                      |
|--------|-----------------------------|----------------------------------|
| POST   | `/api/files/upload`         | Upload file, get all hashes      |
| POST   | `/api/files/hash`           | Re-hash an uploaded temp file    |
| POST   | `/api/files/baseline`       | Save trusted baseline            |
| POST   | `/api/files/verify`         | Verify file against baseline     |
| POST   | `/api/files/compare-hash`   | Compare file to a known hash     |
| GET    | `/api/files`                | List all monitored files         |
| GET    | `/api/files/<id>`           | Get file details + scan history  |
| DELETE | `/api/files/<id>`           | Remove file from monitoring      |

### Real-Time Monitoring (V2.1)

| Method | Endpoint                            | Description                  |
|--------|-------------------------------------|------------------------------|
| GET    | `/api/monitor/status`               | Watcher service status       |
| POST   | `/api/files/<id>/monitor`           | Enable real-time watcher     |
| POST   | `/api/files/<id>/pause-monitoring`  | Pause watcher                |
| POST   | `/api/files/<id>/resume-monitoring` | Resume watcher               |
| POST   | `/api/files/<id>/disable-monitoring`| Disable watcher              |
| GET    | `/api/files/<id>/monitoring-info`   | Per-file watcher details     |

### History, Alerts & Reports

| Method | Endpoint                    | Description                       |
|--------|-----------------------------|-----------------------------------|
| GET    | `/api/history`              | Scan history (paginated + filters)|
| GET    | `/api/history/<id>`         | Full scan detail                  |
| GET    | `/api/alerts`               | Security alerts                   |
| POST   | `/api/alerts/<id>/review`   | Mark alert reviewed               |
| DELETE | `/api/alerts/<id>`          | Delete alert                      |
| DELETE | `/api/alerts/clear-all`     | Clear all alerts                  |
| GET    | `/api/dashboard`            | Dashboard statistics              |
| POST   | `/api/reports/generate`     | Generate PDF or CSV report        |
| GET    | `/api/reports/history-csv`  | Export full scan history as CSV   |

---

## Security Notes

- Passwords are hashed with **bcrypt** (12 rounds) — never stored in plain text
- JWT tokens expire after **24 hours**
- File uploads use `werkzeug.utils.secure_filename` — path traversal is prevented
- Uploaded files are **never executed** by the server
- All database queries use **parameterized statements** — no SQL injection
- Every API endpoint is **scoped to the authenticated user** — users cannot access each other's data
- Real-time monitoring events are never falsely attributed to a specific person or cause

---

## This Is Not Antivirus Software

File Integrity Checker is a **file integrity monitoring system**.

It detects **that** a file's content changed by comparing cryptographic hashes.
It does **not** scan for malware, viruses, or exploits.
It does **not** identify who changed a file or why.

---

## Limitations

- Real-time monitoring requires the file to be on the **same machine** as the Flask server
- The watcher runs inside the Flask dev process; for production, a dedicated worker is recommended
- The SQLite database is suitable for single-user/demo use; PostgreSQL is recommended for multi-user deployment
- File size limit is **50 MB** per upload
- MD5 is provided for legacy reference only and must not be used for security-critical verification

---

## Future Enhancements

- Email / webhook notifications for integrity alerts
- Role-based access control (admin / read-only viewer)
- Scheduled background monitoring with Celery or APScheduler
- PostgreSQL support for multi-user production deployment
- REST API key authentication for CI/CD pipeline integration
- Centralized SIEM / log aggregation integration
- Multi-file batch verification

---

## Developer

**Mohamed Riyaskhan S**
Cyber Security & Ethical Hacking — Internship Project
Rathinam College of Arts and Science

- LinkedIn: [linkedin.com/in/mohamed-riyaskhan-s-9a5247386](https://www.linkedin.com/in/mohamed-riyaskhan-s-9a5247386)
- GitHub: [github.com/Riyaskhan2010](https://github.com/Riyaskhan2010)
- Email: mriyaskhan254@gmail.com

---

*Built with React + Python Flask · Runs locally, no external services required*
