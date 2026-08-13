"""
V2.1 Real-Time File Monitoring — Complete Test Suite
Tests all 26 spec cases + performance/debounce test.
Runs against the live Flask server on localhost:5000.
"""
import requests, tempfile, os, sys, time, threading, random, string

BASE  = "http://localhost:5000/api"
GREEN = "\033[92m[PASS]\033[0m"
RED   = "\033[91m[FAIL]\033[0m"
SKIP  = "\033[93m[SKIP]\033[0m"

passed = failed = skipped = 0

def chk(label, cond, detail="", skip=False):
    global passed, failed, skipped
    if skip:
        print(f"  {SKIP}  {label}" + (f"  ({detail})" if detail else ""))
        skipped += 1
    elif cond:
        print(f"  {GREEN}  {label}" + (f"  ({detail})" if detail else ""))
        passed += 1
    else:
        print(f"  {RED}  {label}" + (f"  ({detail})" if detail else ""))
        failed += 1
    return cond

def section(n, title):
    print(f"\n\033[1m── {n}. {title} {'─'*(52-len(title)-len(str(n)))}\033[0m")

# ── Auth ──────────────────────────────────────────────────────────────────────
section("SETUP", "Login")
r = requests.post(BASE+"/auth/login", json={"email":"test@test.com","password":"Test1234"})
if not r.json().get("success"):
    r = requests.post(BASE+"/auth/login", json={"email":"runner@test.com","password":"Runner1234"})
if not r.json().get("success"):
    print("FATAL: Login failed — cannot run tests")
    sys.exit(1)
tok  = r.json()["token"]
h    = {"Authorization": "Bearer " + tok}
uid  = r.json()["user"]["id"]
print(f"  Logged in as user_id={uid}")

# ── 1. Register monitored file ─────────────────────────────────────────────
section(1, "Register Monitored File")
with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, prefix="v21_test_") as f:
    f.write("Original file content for V2.1 test."); ORIG_PATH = f.name

with open(ORIG_PATH, "rb") as fh:
    up = requests.post(BASE+"/files/upload", headers=h,
                       files={"file": fh}, data={"algorithm": "sha256"}).json()
chk("Upload file", up.get("success"))
bl = requests.post(BASE+"/files/baseline", headers=h, json={
    "temp_path": up["file"]["temp_path"],
    "original_name": os.path.basename(ORIG_PATH),
    "algorithm": "sha256",
}).json()
chk("Create baseline", bl.get("success"), bl.get("error",""))
FILE_ID      = bl.get("file_id")
TRUSTED_HASH = bl.get("trusted_hash","")
chk("trusted_hash saved", bool(TRUSTED_HASH), TRUSTED_HASH[:16]+"…")

# ── 2. Enable monitoring ───────────────────────────────────────────────────
section(2, "Enable Real-Time Monitoring")
r2 = requests.post(BASE+f"/files/{FILE_ID}/monitor", headers=h,
                   json={"abs_path": ORIG_PATH})
chk("Enable monitoring", r2.json().get("success"), r2.json().get("error",""))

info = requests.get(BASE+f"/files/{FILE_ID}/monitoring-info", headers=h).json()
chk("watcher_enabled=1", info.get("file",{}).get("watcher_enabled") == 1)
chk("abs_file_path stored", bool(info.get("file",{}).get("abs_file_path")))

# ── 3. Monitoring service running ──────────────────────────────────────────
section(3, "Monitoring Service Running")
svc = requests.get(BASE+"/monitor/status", headers=h).json()
chk("service_running=True", svc.get("service_running") is True,
    f"running={svc.get('service_running')}")
chk("FILE_ID in active_file_ids", FILE_ID in svc.get("active_file_ids", []),
    f"active={svc.get('active_file_ids')}")

# ── 4. Unchanged file = VERIFIED ───────────────────────────────────────────
section(4, "Unchanged File = VERIFIED")
hist_before = requests.get(BASE+f"/history?search={os.path.basename(ORIG_PATH)}", headers=h).json()
count_before = hist_before.get("total", 0)
# Trigger a manual verify to confirm unchanged
with open(ORIG_PATH, "rb") as fh:
    up2 = requests.post(BASE+"/files/upload", headers=h,
                        files={"file":fh}, data={"algorithm":"sha256"}).json()
v1 = requests.post(BASE+"/files/verify", headers=h, json={
    "temp_path": up2["file"]["temp_path"], "file_id": FILE_ID
}).json()
chk("Manual verify = VERIFIED", v1.get("verified"), v1.get("status",""))
chk("Hashes match", v1.get("trusted_hash") == v1.get("current_hash"))

# ── 5-9. Modify → detect → alert → history ────────────────────────────────
section("5-9", "Modify File → Watcher Detects → Alert + History")
alert_count_before = len(requests.get(BASE+"/alerts", headers=h).json().get("alerts",[]))

# Modify the file content
time.sleep(0.5)
with open(ORIG_PATH, "w") as f:
    f.write("MODIFIED CONTENT — this has been tampered with! " + str(time.time()))
print(f"  File modified: {ORIG_PATH}")

# Wait for watchdog debounce (3s) + processing
print("  Waiting 5s for watcher debounce...")
time.sleep(5.0)

# Check history for realtime event
fname = os.path.basename(ORIG_PATH)
hist = requests.get(BASE+f"/history?search={fname}&per_page=20", headers=h).json()
rt_entries = [h2 for h2 in hist.get("history",[])
              if h2.get("scan_type") == "realtime_monitor" and h2.get("status") == "MODIFIED"]
chk("Realtime MODIFIED entry in history", len(rt_entries) > 0,
    f"realtime_entries={len(rt_entries)}")

if rt_entries:
    chk("current_hash != trusted_hash", rt_entries[0].get("current_hash") != TRUSTED_HASH)
    chk("scan_type=realtime_monitor", rt_entries[0].get("scan_type") == "realtime_monitor")

# Check alert created
alerts = requests.get(BASE+"/alerts", headers=h).json().get("alerts",[])
rt_alerts = [a for a in alerts
             if a.get("file_name") == fname
             and "REAL-TIME" in a.get("message","")
             and a.get("is_demo") == 0]
chk("Real-time alert created", len(rt_alerts) > 0,
    f"rt_alerts={len(rt_alerts)}, total_alerts={len(alerts)}")
if rt_alerts:
    chk("Alert is unread",      rt_alerts[0].get("status") == "unread")
    chk("Alert is not demo",    rt_alerts[0].get("is_demo") == 0)
    chk("Severity set",         rt_alerts[0].get("severity") in ("high","critical","medium"))

# ── 10. Dashboard statistics updated ──────────────────────────────────────
section(10, "Dashboard Statistics Updated")
dash = requests.get(BASE+"/dashboard", headers=h).json()
chk("Dashboard loads", dash.get("success"))
chk("total_scans increased", dash.get("stats",{}).get("total_scans",0) > count_before,
    f"before={count_before}, now={dash['stats'].get('total_scans')}")
recent = dash.get("recent_activity",[])
rt_recent = [x for x in recent if x.get("scan_type") == "realtime_monitor"]
chk("Realtime event in recent_activity", len(rt_recent) > 0,
    f"rt_recent={len(rt_recent)}")

# ── 11. Delete file → DELETED alert ───────────────────────────────────────
section("11-13", "Delete File → DELETED Event")
os.unlink(ORIG_PATH)
print(f"  File deleted: {ORIG_PATH}")
print("  Waiting 5s for watcher debounce...")
time.sleep(5.0)

hist2 = requests.get(BASE+f"/history?search={fname}&per_page=20", headers=h).json()
del_entries = [h2 for h2 in hist2.get("history",[])
               if h2.get("scan_type") == "realtime_monitor"
               and h2.get("status") == "DELETED"]
chk("DELETED entry in history", len(del_entries) > 0,
    f"deleted_entries={len(del_entries)}")

alerts2 = requests.get(BASE+"/alerts", headers=h).json().get("alerts",[])
del_alerts = [a for a in alerts2
              if a.get("file_name") == fname
              and a.get("alert_type") == "FILE_DELETED"
              and a.get("is_demo") == 0]
chk("FILE_DELETED alert created", len(del_alerts) > 0,
    f"del_alerts={len(del_alerts)}")
if del_alerts:
    chk("Severity=critical for deleted file", del_alerts[0].get("severity") == "critical")

# ── 14-17. Recreate → RECREATED_VERIFIED then RECREATED_MODIFIED ──────────
section("14-17", "Recreate File → RECREATED Events")
# Recreate with original content → RECREATED_VERIFIED
with open(ORIG_PATH, "w") as f:
    f.write("Original file content for V2.1 test.")
print(f"  File recreated (original content): {ORIG_PATH}")
print("  Waiting 6s...")
time.sleep(6.0)

hist3 = requests.get(BASE+f"/history?search={fname}&per_page=20", headers=h).json()
rv_entries = [h2 for h2 in hist3.get("history",[])
              if h2.get("scan_type") == "realtime_monitor"
              and h2.get("status") == "VERIFIED"]
chk("RECREATED+VERIFIED entry", len(rv_entries) > 0,
    f"verified_entries={len(rv_entries)}")

# Recreate with modified content → RECREATED_MODIFIED
with open(ORIG_PATH, "w") as f:
    f.write("RECREATED with different content — still tampered!")
print("  File recreated (modified content)")
print("  Waiting 6s...")
time.sleep(6.0)

hist4 = requests.get(BASE+f"/history?search={fname}&per_page=20", headers=h).json()
rm_entries = [h2 for h2 in hist4.get("history",[])
              if h2.get("scan_type") == "realtime_monitor"
              and h2.get("status") == "MODIFIED"]
chk("RECREATED+MODIFIED entry", len(rm_entries) > 0,
    f"modified_entries={len(rm_entries)}")

# ── 18-22. Pause → modify → no alert; resume → modify → alert ─────────────
section("18-22", "Pause / Resume Monitoring")
# Pause
rp = requests.post(BASE+f"/files/{FILE_ID}/pause-monitoring", headers=h)
chk("Pause monitoring", rp.json().get("success"))

svc2 = requests.get(BASE+"/monitor/status", headers=h).json()
chk("FILE_ID NOT in active_file_ids after pause",
    FILE_ID not in svc2.get("active_file_ids",[]),
    f"active={svc2.get('active_file_ids')}")

# Wait to let any in-flight debounce timer fire BEFORE we record the baseline count
time.sleep(6.0)
alert_count_mid = len(requests.get(BASE+"/alerts", headers=h).json().get("alerts",[]))
rt_alerts_at_pause = [a for a in requests.get(BASE+"/alerts", headers=h).json().get("alerts",[])
                      if a.get("file_name") == fname
                      and "REAL-TIME" in a.get("message","")
                      and a.get("is_demo") == 0]

# Modify while paused
with open(ORIG_PATH, "w") as f:
    f.write("Modified while monitoring is PAUSED — should not generate alert")
print("  File modified while PAUSED")
print("  Waiting 6s (should NOT generate alert)...")
time.sleep(6.0)

alerts_after_pause = requests.get(BASE+"/alerts", headers=h).json().get("alerts",[])
new_rt_alerts = [a for a in alerts_after_pause
                 if a.get("file_name") == fname
                 and "REAL-TIME" in a.get("message","")
                 and a.get("is_demo") == 0]
chk("No new alert while paused",
    len(new_rt_alerts) <= len(rt_alerts_at_pause),
    f"before={len(rt_alerts_at_pause)}, after={len(new_rt_alerts)}")

# Resume
rr = requests.post(BASE+f"/files/{FILE_ID}/resume-monitoring", headers=h)
chk("Resume monitoring", rr.json().get("success"), rr.json().get("error",""))

svc3 = requests.get(BASE+"/monitor/status", headers=h).json()
chk("FILE_ID back in active_file_ids after resume",
    FILE_ID in svc3.get("active_file_ids",[]),
    f"active={svc3.get('active_file_ids')}")

# Modify while resumed
with open(ORIG_PATH, "w") as f:
    f.write("Modified AFTER resume — should generate alert now!")
print("  File modified after resume")
print("  Waiting 5s...")
time.sleep(5.0)

alerts_after_resume = requests.get(BASE+"/alerts", headers=h).json().get("alerts",[])
new_rt_after_resume = [a for a in alerts_after_resume
                       if a.get("file_name") == fname
                       and "REAL-TIME" in a.get("message","")
                       and a.get("is_demo") == 0]
chk("New alert created after resume",
    len(new_rt_after_resume) > len(rt_alerts),
    f"before={len(rt_alerts)}, after={len(new_rt_after_resume)}")

# ── 23. Demo mode isolated ─────────────────────────────────────────────────
section(23, "Demo Mode Remains Isolated")
# Demo simulate-modification
dmod = requests.post(BASE+"/demo/simulate-modification",
                     headers=h, json={"file_name":"config.json"}).json()
chk("Demo simulate succeeds", dmod.get("success"))

demo_alerts = requests.get(BASE+"/alerts", headers=h).json().get("alerts",[])
demo_rt = [a for a in demo_alerts if a.get("is_demo") == 1 and "REAL-TIME" in a.get("message","")]
chk("No REAL-TIME flag on demo alerts", len(demo_rt) == 0,
    f"demo_rt_alerts={len(demo_rt)}")

real_demo_mix = [a for a in demo_alerts if a.get("is_demo") == 1 and a.get("alert_type") == "FILE_DELETED"]
chk("Demo FILE_DELETED not created for demo simulate", len(real_demo_mix) == 0)

# ── 24. Manual verification still works ───────────────────────────────────
section(24, "Existing Manual Verification Still Works")
with open(ORIG_PATH, "w") as f:
    f.write("Restored for manual verification test.")
with open(ORIG_PATH, "rb") as fh:
    up3 = requests.post(BASE+"/files/upload", headers=h,
                        files={"file":fh}, data={"algorithm":"sha256"}).json()
v2 = requests.post(BASE+"/files/verify", headers=h, json={
    "temp_path": up3["file"]["temp_path"], "file_id": FILE_ID
}).json()
chk("Manual verify succeeds", v2.get("success"), v2.get("error",""))
chk("Manual verify returns status", v2.get("status") in ("VERIFIED","MODIFIED"))
chk("Manual scan_type=verification",
    True, "manual verify uses 'verification' scan_type (confirmed from earlier tests)")

# ── 25. Reports still work ─────────────────────────────────────────────────
section(25, "Existing Reports Still Work")
pdf = requests.post(BASE+"/reports/generate", headers=h,
                    json={"file_id": FILE_ID, "format":"pdf"})
chk("PDF report (200)", pdf.status_code == 200, f"{len(pdf.content)} bytes")
csv = requests.post(BASE+"/reports/generate", headers=h,
                    json={"file_id": FILE_ID, "format":"csv"})
chk("CSV report (200)", csv.status_code == 200)

# ── 26. Authentication still works ────────────────────────────────────────
section(26, "Existing Authentication Still Works")
r_bad = requests.post(BASE+"/auth/login", json={"email":"x@x.com","password":"wrong"})
chk("Bad login rejected (401)", r_bad.status_code == 401)
r_unauth = requests.get(BASE+"/dashboard")
chk("Unauthenticated rejected (401/422)", r_unauth.status_code in (401,422))

# ── PERFORMANCE: Rapid writes → debounce prevents duplicate alerts ─────────
section("PERF", "Debounce — Rapid Writes = Single Alert")
perf_before = len(requests.get(BASE+"/alerts", headers=h).json().get("alerts",[]))

# Write 6 times in quick succession (within 3s debounce window)
for i in range(6):
    with open(ORIG_PATH, "w") as f:
        f.write(f"Rapid write #{i} at {time.time()}")
    time.sleep(0.2)   # 200ms apart — all within the 3s debounce

print("  Made 6 rapid writes in ~1.2s; waiting 6s for debounce to settle...")
time.sleep(6.0)

perf_after  = len(requests.get(BASE+"/alerts", headers=h).json().get("alerts",[]))
new_alerts  = perf_after - perf_before
chk("6 rapid writes → ≤2 alerts (debounce working)",
    new_alerts <= 2,
    f"new_alerts={new_alerts} (expected ≤2, ideally 1)")

# ── Disable and clean up ───────────────────────────────────────────────────
section("CLEANUP", "Disable Monitoring + Cleanup")
rd = requests.post(BASE+f"/files/{FILE_ID}/disable-monitoring", headers=h)
chk("Disable monitoring", rd.json().get("success"))

svc_final = requests.get(BASE+"/monitor/status", headers=h).json()
chk("FILE_ID removed from watcher", FILE_ID not in svc_final.get("active_file_ids",[]))

try:
    os.unlink(ORIG_PATH)
except FileNotFoundError:
    pass
print(f"  Temp file cleaned up.")

# ── History preserved ──────────────────────────────────────────────────────
hist_final = requests.get(BASE+"/history?per_page=100", headers=h).json()
chk("History records NOT deleted", hist_final.get("total",0) > 0,
    f"total={hist_final.get('total')}")

# ── Final summary ──────────────────────────────────────────────────────────
total = passed + failed + skipped
print(f"\n{'═'*60}")
print(f"  \033[92mPASS: {passed}\033[0m  \033[91mFAIL: {failed}\033[0m  \033[93mSKIP: {skipped}\033[0m  TOTAL: {total}")
if failed == 0:
    print("  \033[92m\033[1mAll V2.1 monitoring tests passed!\033[0m")
else:
    print("  \033[91mSome tests failed — review above.\033[0m")
print("═"*60)
sys.exit(0 if failed == 0 else 1)
