"""Final comprehensive test — all features."""
import requests, tempfile, os, sys, time

BASE = "http://localhost:5000/api"
OK   = "\033[92m[OK]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
errs = []

def chk(label, cond, detail=""):
    sym = OK if cond else FAIL
    print(f"  {sym}  {label}" + (f"  ({detail})" if detail else ""))
    if not cond:
        errs.append(label)
    return cond

print("\n\033[1m═══ BACKEND FINAL TEST ═══════════════════════════════\033[0m")

# ── 1. Auth ───────────────────────────────────────────────────────────────────
print("\n── Auth ──")
r = requests.post(BASE+"/auth/login", json={"email":"test@test.com","password":"Test1234"})
if not r.json().get("success"):
    r = requests.post(BASE+"/auth/login", json={"email":"runner@test.com","password":"Runner1234"})
chk("Login", r.json().get("success"))
tok = r.json()["token"]
h   = {"Authorization": "Bearer " + tok}
bad = requests.post(BASE+"/auth/login", json={"email":"x@x.com","password":"wrong"})
chk("Bad login rejected (401)", bad.status_code == 401)
unauth = requests.get(BASE+"/dashboard")
chk("Unauthenticated rejected", unauth.status_code in (401, 422))

# ── 2. Dashboard ──────────────────────────────────────────────────────────────
print("\n── Dashboard ──")
d = requests.get(BASE+"/dashboard", headers=h).json()
chk("Dashboard loads", d.get("success"))
chk("Stats present", "stats" in d)
chk("chart_data present", len(d.get("chart_data", [])) == 7)
chk("recent_activity present", "recent_activity" in d)

# ── 3. Upload + hashing ───────────────────────────────────────────────────────
print("\n── File Upload & Hashing ──")
with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
    f.write("Final integration test content."); tmp_orig = f.name

with open(tmp_orig, "rb") as fh:
    up = requests.post(BASE+"/files/upload", headers=h,
                       files={"file": fh}, data={"algorithm": "sha256"}).json()
chk("Upload", up.get("success"))
chk("SHA-256", bool(up.get("hashes",{}).get("sha256")), (up.get("hashes",{}).get("sha256") or "")[:16])
chk("SHA-512", bool(up.get("hashes",{}).get("sha512")))
chk("SHA-3-256", bool(up.get("hashes",{}).get("sha3_256")))
chk("SHA-3-512", bool(up.get("hashes",{}).get("sha3_512")))
chk("MD5 (legacy)", bool(up.get("hashes",{}).get("md5")))
tp = up["file"]["temp_path"]
sha256 = up["hashes"]["sha256"]

# ── 4. Trusted baseline ───────────────────────────────────────────────────────
print("\n── Trusted Baseline ──")
bl = requests.post(BASE+"/files/baseline", headers=h, json={
    "temp_path": tp, "original_name": "final_test.txt", "algorithm": "sha256"
}).json()
chk("Baseline saved", bl.get("success"), bl.get("error",""))
fid = bl.get("file_id"); trusted = bl.get("trusted_hash","")
chk("Hash matches upload hash", trusted == sha256)

# ── 5. Verify unchanged ───────────────────────────────────────────────────────
print("\n── Verify Unchanged → VERIFIED ──")
with open(tmp_orig, "rb") as fh:
    up2 = requests.post(BASE+"/files/upload", headers=h,
                        files={"file": fh}, data={"algorithm": "sha256"}).json()
v1 = requests.post(BASE+"/files/verify", headers=h,
                   json={"temp_path": up2["file"]["temp_path"], "file_id": fid}).json()
chk("Verify unchanged = VERIFIED", v1.get("verified"), v1.get("status",""))
chk("Change analysis returned", v1.get("original_size") is not None)

# ── 6. Modify + verify ────────────────────────────────────────────────────────
print("\n── Verify Modified → MODIFIED ──")
with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
    f.write("MODIFIED — tampered content!"); tmp_mod = f.name
with open(tmp_mod, "rb") as fh:
    up3 = requests.post(BASE+"/files/upload", headers=h,
                        files={"file": fh}, data={"algorithm": "sha256"}).json()
v2 = requests.post(BASE+"/files/verify", headers=h,
                   json={"temp_path": up3["file"]["temp_path"], "file_id": fid}).json()
chk("Verify modified = MODIFIED", not v2.get("verified"), v2.get("status",""))
chk("Hashes differ", v2.get("trusted_hash") != v2.get("current_hash"))

# ── 7. Security alerts ────────────────────────────────────────────────────────
print("\n── Security Alerts ──")
alerts = requests.get(BASE+"/alerts", headers=h).json()
chk("Alerts endpoint works", alerts.get("success"))
mod_alerts = [a for a in alerts.get("alerts",[]) if a["file_name"]=="final_test.txt"]
chk("Modification alert created", len(mod_alerts) > 0, f"{len(mod_alerts)} alerts")
if mod_alerts:
    chk("Alert has severity", bool(mod_alerts[0].get("severity")))
    chk("Alert is unread", mod_alerts[0].get("status") == "unread")
    chk("Alert is not demo", mod_alerts[0].get("is_demo") == 0)
    # Mark reviewed
    rev = requests.post(BASE+f"/alerts/{mod_alerts[0]['id']}/review", headers=h).json()
    chk("Mark reviewed works", rev.get("success"))

# ── 8. Scan history ───────────────────────────────────────────────────────────
print("\n── Scan History ──")
hist = requests.get(BASE+"/history?search=final_test", headers=h).json()
chk("History loads", hist.get("success"))
chk("VERIFIED entry present", any(hh["status"]=="VERIFIED" for hh in hist.get("history",[])))
chk("MODIFIED entry present", any(hh["status"]=="MODIFIED" for hh in hist.get("history",[])))

# ── 9. NEW: Scan detail endpoint ──────────────────────────────────────────────
print("\n── Scan Detail Endpoint (new) ──")
scan_id = next((hh["id"] for hh in hist.get("history",[]) if hh["status"]=="MODIFIED"), None)
if scan_id:
    det = requests.get(BASE+f"/history/{scan_id}", headers=h).json()
    chk("GET /history/<id> works", det.get("success"))
    chk("source_label returned", bool(det.get("source_label")), det.get("source_label",""))
    chk("file_info returned", det.get("file_info") is not None)
    chk("related_alert returned", det.get("related_alert") is not None)

# ── 10. NEW: Source filter ────────────────────────────────────────────────────
print("\n── Source Filter (new) ──")
sf = requests.get(BASE+"/history?source=manual&per_page=5", headers=h).json()
chk("Source filter 'manual' works", sf.get("success"))
sf2 = requests.get(BASE+"/history?source=demo&per_page=5", headers=h).json()
chk("Source filter 'demo' works", sf2.get("success"))

# ── 11. Hash comparison ───────────────────────────────────────────────────────
print("\n── Hash Comparison ──")
with open(tmp_orig, "rb") as fh:
    cmp_match = requests.post(BASE+"/files/compare-hash", headers=h,
                              files={"file": fh},
                              data={"expected_hash": sha256, "algorithm": "sha256"}).json()
chk("Compare MATCH", cmp_match.get("match"), cmp_match.get("status",""))

with open(tmp_mod, "rb") as fh:
    cmp_miss = requests.post(BASE+"/files/compare-hash", headers=h,
                             files={"file": fh},
                             data={"expected_hash": sha256, "algorithm": "sha256"}).json()
chk("Compare MISMATCH", not cmp_miss.get("match"), cmp_miss.get("status",""))

# ── 12. Reports ───────────────────────────────────────────────────────────────
print("\n── Reports ──")
pdf = requests.post(BASE+"/reports/generate", headers=h,
                    json={"file_id": fid, "format": "pdf"})
chk("PDF report (200)", pdf.status_code==200, f"{len(pdf.content)} bytes")
chk("PDF non-empty (>1KB)", len(pdf.content) > 1000)

csv_r = requests.post(BASE+"/reports/generate", headers=h,
                      json={"file_id": fid, "format": "csv"})
chk("CSV report (200)", csv_r.status_code==200)
chk("CSV contains filename", b"final_test" in csv_r.content)

bulk = requests.get(BASE+"/reports/history-csv", headers=h)
chk("Bulk history CSV export", bulk.status_code==200)

# ── 13. Monitor service ───────────────────────────────────────────────────────
print("\n── Real-Time Monitor Service ──")
ms = requests.get(BASE+"/monitor/status", headers=h).json()
chk("Monitor status endpoint", ms.get("success"))
chk("service_running=True", ms.get("service_running") is True, str(ms.get("service_running")))

# ── 14. Demo mode ─────────────────────────────────────────────────────────────
print("\n── Demo Mode ──")
sim = requests.post(BASE+"/demo/simulate-modification", headers=h,
                    json={"file_name": "config.json"}).json()
chk("Demo simulate", sim.get("success"))

demo_alerts = requests.get(BASE+"/alerts", headers=h).json().get("alerts",[])
chk("Demo alert has is_demo=1", any(a["is_demo"]==1 for a in demo_alerts))
chk("Real alert has is_demo=0", any(a["is_demo"]==0 for a in demo_alerts))

rst = requests.post(BASE+"/demo/reset", headers=h).json()
chk("Demo reset", rst.get("success"))

# ── 15. Monitored files list ──────────────────────────────────────────────────
print("\n── Monitored Files ──")
files = requests.get(BASE+"/files", headers=h).json()
chk("Files endpoint", files.get("success"))
chk("Real file present", any(f["id"]==fid for f in files.get("files",[])))
chk("Demo files present", len(files.get("demo_files",[])) > 0)

# Cleanup
os.unlink(tmp_orig)
os.unlink(tmp_mod)

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'═'*56}")
if not errs:
    print("  \033[92m\033[1mAll backend tests PASSED.\033[0m")
else:
    print(f"  \033[91m{len(errs)} FAILED: {errs}\033[0m")
print("═"*56)
sys.exit(0 if not errs else 1)
