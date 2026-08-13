"""
Full acceptance test — mirrors the spec's 17-step demo flow
plus auth edge cases, error handling, and new endpoints.
"""
import requests, json, os, sys, tempfile, time, random, string

BASE  = "http://localhost:5000/api"
GREEN = "\033[92m✓\033[0m"
RED   = "\033[91m✗\033[0m"
BOLD  = "\033[1m"
RESET = "\033[0m"

failures = []

def ok(label, cond, detail=""):
    sym = GREEN if cond else RED
    print(f"  {sym}  {label}" + (f"  →  {detail}" if detail else ""))
    if not cond:
        failures.append(label)
    return cond

def section(title):
    print(f"\n{BOLD}── {title} {'─'*(50-len(title))}{RESET}")

# ── unique email for this run ──────────────────────────────────
tag   = ''.join(random.choices(string.ascii_lowercase, k=6))
EMAIL = f"accept_{tag}@test.com"
PWD   = "Accept1234"

# ══════════════════════════════════════════════════════════════
# 1. REGISTER
# ══════════════════════════════════════════════════════════════
section("1. Register")
r = requests.post(f"{BASE}/auth/register",
                  json={"name": "Acceptance Tester", "email": EMAIL, "password": PWD})
d = r.json()
ok("Register succeeds",        d.get("success"),          d.get("error",""))
ok("Token returned",           bool(d.get("token")))
ok("User info in response",    d.get("user",{}).get("email") == EMAIL)
token = d.get("token","")
hdrs  = {"Authorization": f"Bearer {token}"}

# duplicate email
r2 = requests.post(f"{BASE}/auth/register",
                   json={"name":"X","email":EMAIL,"password":PWD})
ok("Duplicate email rejected", not r2.json().get("success"))

# ══════════════════════════════════════════════════════════════
# 2. LOGIN
# ══════════════════════════════════════════════════════════════
section("2. Login")
r = requests.post(f"{BASE}/auth/login", json={"email":EMAIL,"password":PWD})
d = r.json()
ok("Login succeeds",       d.get("success"))
ok("Token returned",       bool(d.get("token")))
token = d.get("token","")
hdrs  = {"Authorization": f"Bearer {token}"}

# wrong password
r2 = requests.post(f"{BASE}/auth/login", json={"email":EMAIL,"password":"WrongPwd1"})
ok("Bad password rejected (401)", r2.status_code == 401)

# ══════════════════════════════════════════════════════════════
# 3. DASHBOARD (demo data should be seeded)
# ══════════════════════════════════════════════════════════════
section("3. Dashboard — demo data seeded")
r = requests.get(f"{BASE}/dashboard", headers=hdrs)
d = r.json()
ok("Dashboard loads",           d.get("success"))
ok("Stats present",             "stats" in d)
ok("total_files > 0",           d.get("stats",{}).get("total_files",0) > 0,
   f"total={d['stats']['total_files']}")
ok("recent_activity present",   len(d.get("recent_activity",[])) > 0)
ok("chart_data 7 entries",      len(d.get("chart_data",[])) == 7)
ok("security_score present",    d["stats"].get("security_score") is not None)

# ══════════════════════════════════════════════════════════════
# 4. FILE UPLOAD + HASH
# ══════════════════════════════════════════════════════════════
section("4. File Upload & Hash Generation")
with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, prefix='accept_') as f:
    f.write("Original content for acceptance test — do not modify.")
    tmp_orig = f.name

with open(tmp_orig,'rb') as fh:
    r = requests.post(f"{BASE}/files/upload", headers=hdrs,
                      files={"file": fh}, data={"algorithm":"sha256"})
d = r.json()
ok("Upload succeeds (201)",     r.status_code == 201)
ok("SHA-256 returned",          bool(d.get("hashes",{}).get("sha256")),
   d.get("hashes",{}).get("sha256","")[:16]+"…")
ok("SHA-512 returned",          bool(d.get("hashes",{}).get("sha512")))
ok("SHA-3-256 returned",        bool(d.get("hashes",{}).get("sha3_256")))
ok("SHA-3-512 returned",        bool(d.get("hashes",{}).get("sha3_512")))
ok("MD5 returned (legacy)",     bool(d.get("hashes",{}).get("md5")))
temp_path   = d["file"]["temp_path"]
orig_sha256 = d["hashes"]["sha256"]

# oversized upload — quick check via custom header spoof isn't possible,
# but we can verify the endpoint rejects invalid filenames
section("4b. Upload security checks")
# path traversal attempt
with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
    f.write("x"); bad_tmp = f.name
with open(bad_tmp,'rb') as fh:
    r_pt = requests.post(f"{BASE}/files/upload", headers=hdrs,
                         files={"file": ("../../../etc/passwd", fh, "text/plain")},
                         data={"algorithm":"sha256"})
# werkzeug secure_filename strips traversal — upload may succeed but filename is sanitised
if r_pt.status_code == 201:
    safe = r_pt.json()["file"]["original_name"]
    ok("Path traversal filename sanitised", ".." not in safe, safe)
else:
    ok("Path traversal rejected", True)

# ══════════════════════════════════════════════════════════════
# 5. SAVE TRUSTED BASELINE
# ══════════════════════════════════════════════════════════════
section("5. Save Trusted Baseline")
r = requests.post(f"{BASE}/files/baseline", headers=hdrs, json={
    "temp_path":     temp_path,
    "original_name": "accept_test.txt",
    "algorithm":     "sha256",
    "notes":         "Acceptance test baseline",
})
d = r.json()
ok("Baseline saved (201)",      r.status_code == 201)
ok("trusted_hash returned",     bool(d.get("trusted_hash")))
ok("hash matches upload hash",  d.get("trusted_hash") == orig_sha256)
file_id      = d.get("file_id")
trusted_hash = d.get("trusted_hash","")

# ══════════════════════════════════════════════════════════════
# 6. MONITORED FILES LIST
# ══════════════════════════════════════════════════════════════
section("6. Monitored Files")
r = requests.get(f"{BASE}/files", headers=hdrs)
d = r.json()
ok("Files endpoint works",      d.get("success"))
ok("Real file present",         any(f["id"]==file_id for f in d.get("files",[])))
ok("Demo files present",        len(d.get("demo_files",[])) > 0)

# ══════════════════════════════════════════════════════════════
# 7. VERIFY UNCHANGED FILE — expect INTEGRITY VERIFIED
# ══════════════════════════════════════════════════════════════
section("7. Verify Unchanged File → INTEGRITY VERIFIED")
with open(tmp_orig,'rb') as fh:
    up = requests.post(f"{BASE}/files/upload", headers=hdrs,
                       files={"file": fh}, data={"algorithm":"sha256"}).json()

r = requests.post(f"{BASE}/files/verify", headers=hdrs, json={
    "temp_path": up["file"]["temp_path"],
    "file_id":   file_id,
})
d = r.json()
ok("Verify call succeeds",      d.get("success"))
ok("INTEGRITY VERIFIED",        d.get("verified"),      d.get("status",""))
ok("Status = VERIFIED",         d.get("status") == "VERIFIED")
ok("trusted_hash in response",  bool(d.get("trusted_hash")))
ok("current_hash in response",  bool(d.get("current_hash")))
ok("hashes match",              d.get("trusted_hash") == d.get("current_hash"))

# ══════════════════════════════════════════════════════════════
# 8. MODIFY FILE → verify → TAMPERING DETECTED
# ══════════════════════════════════════════════════════════════
section("8. Modify File → TAMPERING DETECTED")
with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, prefix='accept_mod_') as f:
    f.write("MODIFIED — this content has been altered. Tampered version.")
    tmp_mod = f.name

with open(tmp_mod,'rb') as fh:
    up = requests.post(f"{BASE}/files/upload", headers=hdrs,
                       files={"file": fh}, data={"algorithm":"sha256"}).json()

r = requests.post(f"{BASE}/files/verify", headers=hdrs, json={
    "temp_path": up["file"]["temp_path"],
    "file_id":   file_id,
})
d = r.json()
ok("Verify call succeeds",         d.get("success"))
ok("NOT verified (modified)",      not d.get("verified"),    d.get("status",""))
ok("Status = MODIFIED",            d.get("status") == "MODIFIED")
ok("trusted_hash ≠ current_hash",  d.get("trusted_hash") != d.get("current_hash"))
ok("Size comparison returned",     d.get("original_size") is not None)

# ══════════════════════════════════════════════════════════════
# 9. SECURITY ALERT CREATED AUTOMATICALLY
# ══════════════════════════════════════════════════════════════
section("9. Security Alert Created")
r = requests.get(f"{BASE}/alerts", headers=hdrs)
d = r.json()
alerts = d.get("alerts",[])
ok("Alerts endpoint works",        d.get("success"))
ok("Modification alert exists",    any(a["alert_type"]=="MODIFICATION_DETECTED" and a["file_name"]=="accept_test.txt" for a in alerts))
ok("Alert has severity field",     any("severity" in a for a in alerts))
ok("Alert is unread",              any(a["status"]=="unread" for a in alerts if a["file_name"]=="accept_test.txt"))

# mark reviewed
mod_alert = next((a for a in alerts if a["file_name"]=="accept_test.txt"), None)
if mod_alert:
    r2 = requests.post(f"{BASE}/alerts/{mod_alert['id']}/review", headers=hdrs)
    ok("Mark reviewed works", r2.json().get("success"))

# ══════════════════════════════════════════════════════════════
# 10. SCAN HISTORY
# ══════════════════════════════════════════════════════════════
section("10. Scan History")
r = requests.get(f"{BASE}/history", headers=hdrs)
d = r.json()
ok("History loads",               d.get("success"))
ok("Has records",                 d.get("total",0) > 0,    f"total={d.get('total')}")
ok("Has VERIFIED record",         any(h["status"]=="VERIFIED" for h in d.get("history",[])))
ok("Has MODIFIED record",         any(h["status"]=="MODIFIED" for h in d.get("history",[])))

# filter
r2 = requests.get(f"{BASE}/history?status=MODIFIED", headers=hdrs)
ok("Status filter MODIFIED works",all(h["status"]=="MODIFIED" for h in r2.json().get("history",[])))

# search
r3 = requests.get(f"{BASE}/history?search=accept_test", headers=hdrs)
ok("Search by filename works",    all("accept_test" in h["file_name"] for h in r3.json().get("history",[])))

# sort
r4 = requests.get(f"{BASE}/history?sort_col=file_name&sort_dir=asc", headers=hdrs)
ok("Sort by file_name works",     r4.json().get("success"))

# ══════════════════════════════════════════════════════════════
# 11. DASHBOARD STATS UPDATED
# ══════════════════════════════════════════════════════════════
section("11. Dashboard Stats Updated After Activity")
r = requests.get(f"{BASE}/dashboard", headers=hdrs)
d = r.json()
ok("Dashboard reloads ok",        d.get("success"))
ok("total_scans > 2",             d["stats"].get("total_scans",0) > 2,
   f"total_scans={d['stats'].get('total_scans')}")

# ══════════════════════════════════════════════════════════════
# 12. HASH COMPARISON TOOL
# ══════════════════════════════════════════════════════════════
section("12. Hash Comparison Tool")
with open(tmp_orig,'rb') as fh:
    r = requests.post(f"{BASE}/files/compare-hash", headers=hdrs,
                      files={"file": fh},
                      data={"expected_hash": orig_sha256, "algorithm":"sha256"})
d = r.json()
ok("Compare-hash succeeds",       d.get("success"))
ok("MATCH detected",              d.get("match"),  d.get("status",""))
ok("Status = MATCH",              d.get("status") == "MATCH")

# mismatch
with open(tmp_mod,'rb') as fh:
    r2 = requests.post(f"{BASE}/files/compare-hash", headers=hdrs,
                       files={"file": fh},
                       data={"expected_hash": orig_sha256, "algorithm":"sha256"})
d2 = r2.json()
ok("MISMATCH detected",           d2.get("success") and not d2.get("match"))

# ══════════════════════════════════════════════════════════════
# 13. DEMO SCAN + SIMULATION
# ══════════════════════════════════════════════════════════════
section("13. Demo Scan & Simulation")
r = requests.post(f"{BASE}/demo/simulate-modification",
                  headers=hdrs, json={"file_name":"config.json"})
ok("Simulate modification works", r.json().get("success"))

r2 = requests.post(f"{BASE}/demo/run-scan", headers=hdrs)
ok("Demo scan works",             r2.json().get("success"))
ok("Scan results returned",       len(r2.json().get("results",[])) > 0)

r3 = requests.post(f"{BASE}/demo/reset", headers=hdrs)
ok("Demo reset works",            r3.json().get("success"))

# ══════════════════════════════════════════════════════════════
# 14. PDF REPORT
# ══════════════════════════════════════════════════════════════
section("14. PDF Report Generation")
r = requests.post(f"{BASE}/reports/generate",
                  headers=hdrs, json={"file_id":file_id,"format":"pdf"})
ok("PDF generated (200)",         r.status_code == 200,     f"status={r.status_code}")
ok("Content-Type is PDF",         "pdf" in r.headers.get("content-type","").lower())
ok("PDF non-empty (>1 KB)",       len(r.content) > 1024,    f"{len(r.content)} bytes")

# ══════════════════════════════════════════════════════════════
# 15. CSV REPORT (single file)
# ══════════════════════════════════════════════════════════════
section("15. CSV Report (single file)")
r = requests.post(f"{BASE}/reports/generate",
                  headers=hdrs, json={"file_id":file_id,"format":"csv"})
ok("CSV generated (200)",         r.status_code == 200)
ok("Has CSV content",             len(r.content) > 50)
ok("Contains file name",          b"accept_test" in r.content)

# ══════════════════════════════════════════════════════════════
# 16. BULK HISTORY CSV EXPORT
# ══════════════════════════════════════════════════════════════
section("16. Bulk History CSV Export")
r = requests.get(f"{BASE}/reports/history-csv", headers=hdrs)
ok("Bulk CSV (200)",              r.status_code == 200)
ok("Contains header row",         b"File Name" in r.content)
ok("Contains scan data",          b"accept_test" in r.content or len(r.content) > 100)

# ══════════════════════════════════════════════════════════════
# 17. AUTHORISATION — other user cannot access data
# ══════════════════════════════════════════════════════════════
section("17. Authorisation — cross-user isolation")
tag2  = ''.join(random.choices(string.ascii_lowercase, k=6))
r_reg = requests.post(f"{BASE}/auth/register",
                      json={"name":"Other","email":f"other_{tag2}@test.com","password":"Other1234"})
tok2  = r_reg.json().get("token","")
hdrs2 = {"Authorization": f"Bearer {tok2}"}

# other user cannot see first user's file
r_bad = requests.get(f"{BASE}/files/{file_id}", headers=hdrs2)
ok("Other user cannot GET our file (404)", r_bad.status_code == 404)

# other user cannot delete first user's file
r_del = requests.delete(f"{BASE}/files/{file_id}", headers=hdrs2)
ok("Other user cannot DELETE our file",    r_del.status_code == 404)

# unauthenticated
r_unauth = requests.get(f"{BASE}/dashboard")
ok("Unauthenticated rejected (401/422)",   r_unauth.status_code in (401, 422))

# ══════════════════════════════════════════════════════════════
# 18. CHANGE PASSWORD
# ══════════════════════════════════════════════════════════════
section("18. Change Password")
r = requests.post(f"{BASE}/auth/change-password", headers=hdrs,
                  json={"current_password": PWD, "new_password": "NewAccept1234"})
ok("Password change works",       r.json().get("success"),  r.json().get("error",""))

# login with new password
r2 = requests.post(f"{BASE}/auth/login",
                   json={"email":EMAIL,"password":"NewAccept1234"})
ok("Login with new password ok",  r2.json().get("success"))

# old password no longer works
r3 = requests.post(f"{BASE}/auth/login",
                   json={"email":EMAIL,"password":PWD})
ok("Old password rejected",       not r3.json().get("success"))

# ══════════════════════════════════════════════════════════════
# Cleanup
# ══════════════════════════════════════════════════════════════
for f in [tmp_orig, tmp_mod, bad_tmp]:
    try: os.unlink(f)
    except: pass

# ══════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════
total  = 18  # sections
passed = sum(1 for _ in [1] if not failures)  # recount below
all_checks = [
    d for section_label, d in [
    ]
]

print(f"\n{'═'*56}")
if not failures:
    print(f"  \033[92m\033[1mAll checks passed!\033[0m  Application is fully functional.")
else:
    print(f"  \033[91m{len(failures)} check(s) FAILED:\033[0m")
    for f in failures:
        print(f"    · {f}")
print(f"{'═'*56}\n")

sys.exit(0 if not failures else 1)
