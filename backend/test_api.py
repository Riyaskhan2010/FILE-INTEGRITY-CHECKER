"""Quick end-to-end API test for File Integrity Checker."""
import requests, json, os, sys, tempfile

BASE = "http://localhost:5000/api"
PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"

def check(label, cond, detail=""):
    status = PASS if cond else FAIL
    print(f"  {status}  {label}" + (f"  →  {detail}" if detail else ""))
    return cond

errors = 0

print("\n── 1. Register ──────────────────────────────────────")
r = requests.post(f"{BASE}/auth/register", json={"name":"Test Runner","email":"runner@test.com","password":"Runner1234"})
d = r.json()
ok = check("Register", d.get("success"), d.get("error",""))
if not ok: errors += 1

print("\n── 2. Login ─────────────────────────────────────────")
r = requests.post(f"{BASE}/auth/login", json={"email":"runner@test.com","password":"Runner1234"})
d = r.json()
ok = check("Login", d.get("success"))
token = d.get("token")
hdrs = {"Authorization": f"Bearer {token}"}
if not ok: errors += 1; sys.exit(1)

print("\n── 3. Dashboard ─────────────────────────────────────")
r = requests.get(f"{BASE}/dashboard", headers=hdrs)
d = r.json()
ok = check("Dashboard loads", d.get("success"))
ok2 = check("Stats present", "stats" in d)
ok3 = check("Demo data seeded", d.get("stats",{}).get("total_files",0) > 0,
            f"total={d.get('stats',{}).get('total_files')}")
if not all([ok, ok2, ok3]): errors += 1

print("\n── 4. File Upload & Hash ────────────────────────────")
with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
    f.write("Original content for integrity test.")
    tmp = f.name

with open(tmp, 'rb') as f:
    r = requests.post(f"{BASE}/files/upload", headers=hdrs, files={"file": f}, data={"algorithm":"sha256"})
d = r.json()
ok = check("Upload succeeds", d.get("success"))
ok2 = check("SHA-256 hash returned", bool(d.get("hashes",{}).get("sha256")),
            d.get("hashes",{}).get("sha256","")[:12]+"…")
ok3 = check("SHA-512 hash returned", bool(d.get("hashes",{}).get("sha512")))
if not all([ok, ok2, ok3]): errors += 1
temp_path = d.get("file",{}).get("temp_path","")

print("\n── 5. Save Baseline ─────────────────────────────────")
r = requests.post(f"{BASE}/files/baseline", headers=hdrs, json={
    "temp_path": temp_path, "original_name": "integrity_test.txt", "algorithm":"sha256"
})
d = r.json()
ok = check("Baseline saved", d.get("success"), d.get("error",""))
file_id = d.get("file_id")
trusted_hash = d.get("trusted_hash","")
ok2 = check("Trusted hash stored", bool(trusted_hash), trusted_hash[:12]+"…")
if not all([ok, ok2]): errors += 1

print("\n── 6. Verify Unchanged File ─────────────────────────")
with open(tmp, 'rb') as f:
    r = requests.post(f"{BASE}/files/upload", headers=hdrs, files={"file": f}, data={"algorithm":"sha256"})
up = r.json()
r = requests.post(f"{BASE}/files/verify", headers=hdrs, json={
    "temp_path": up["file"]["temp_path"], "file_id": file_id
})
d = r.json()
ok = check("Verify call succeeds", d.get("success"))
ok2 = check("INTEGRITY VERIFIED", d.get("verified"), d.get("status",""))
if not all([ok, ok2]): errors += 1

print("\n── 7. Detect Tampered File ──────────────────────────")
with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
    f.write("MODIFIED content — this file has been tampered with!")
    tmp2 = f.name

with open(tmp2, 'rb') as f:
    r = requests.post(f"{BASE}/files/upload", headers=hdrs, files={"file": f}, data={"algorithm":"sha256"})
up = r.json()
r = requests.post(f"{BASE}/files/verify", headers=hdrs, json={
    "temp_path": up["file"]["temp_path"], "file_id": file_id
})
d = r.json()
ok  = check("Verify call succeeds", d.get("success"))
ok2 = check("MODIFICATION DETECTED", not d.get("verified"), d.get("status",""))
if not all([ok, ok2]): errors += 1

print("\n── 8. Alerts Created ────────────────────────────────")
r = requests.get(f"{BASE}/alerts", headers=hdrs)
d = r.json()
alerts = d.get("alerts",[])
ok = check("Alerts endpoint works", d.get("success"))
ok2 = check("Modification alert created", any(a["alert_type"]=="MODIFICATION_DETECTED" for a in alerts),
            f"{len(alerts)} alert(s)")
if not all([ok, ok2]): errors += 1

print("\n── 9. Scan History ──────────────────────────────────")
r = requests.get(f"{BASE}/history", headers=hdrs)
d = r.json()
ok = check("History loads", d.get("success"))
ok2 = check("Has scan records", d.get("total",0) > 0, f"total={d.get('total')}")
ok3 = check("Has VERIFIED record", any(h["status"]=="VERIFIED" for h in d.get("history",[])))
ok4 = check("Has MODIFIED record", any(h["status"]=="MODIFIED" for h in d.get("history",[])))
if not all([ok, ok2, ok3, ok4]): errors += 1

print("\n── 10. Hash Comparison Tool ─────────────────────────")
with open(tmp, 'rb') as f:
    r = requests.post(f"{BASE}/files/compare-hash", headers=hdrs,
                      files={"file": f},
                      data={"expected_hash": trusted_hash, "algorithm":"sha256"})
d = r.json()
ok  = check("Compare-hash succeeds", d.get("success"))
ok2 = check("Match detected", d.get("match"), d.get("status",""))
if not all([ok, ok2]): errors += 1

print("\n── 11. Demo Simulation ──────────────────────────────")
r = requests.post(f"{BASE}/demo/simulate-modification", headers=hdrs, json={"file_name":"config.json"})
d = r.json()
ok = check("Simulation succeeds", d.get("success"), d.get("error",""))
if not ok: errors += 1

print("\n── 12. Reports ──────────────────────────────────────")
r = requests.post(f"{BASE}/reports/generate", headers=hdrs, json={"file_id": file_id, "format":"csv"})
ok = check("CSV report generated", r.status_code == 200, f"status={r.status_code}")
ok2 = check("CSV has content", len(r.content) > 50)
if not all([ok, ok2]): errors += 1

# PDF
r2 = requests.post(f"{BASE}/reports/generate", headers=hdrs, json={"file_id": file_id, "format":"pdf"})
ok3 = check("PDF report generated", r2.status_code == 200, f"status={r2.status_code}, size={len(r2.content)} bytes")
if not ok3: errors += 1

print("\n── 13. Error Handling ───────────────────────────────")
r = requests.post(f"{BASE}/auth/login", json={"email":"bad@bad.com","password":"wrong"})
ok = check("Bad login rejected (401)", r.status_code == 401)
r = requests.get(f"{BASE}/dashboard")  # no token
ok2 = check("Unauthenticated request rejected", r.status_code in (401,422))
if not all([ok, ok2]): errors += 1

# Cleanup
os.unlink(tmp)
os.unlink(tmp2)

print(f"\n{'═'*52}")
if errors == 0:
    print(f"  \033[92mAll tests passed!\033[0m  Application is fully functional.")
else:
    print(f"  \033[91m{errors} test group(s) had failures.\033[0m")
print('═'*52 + "\n")
