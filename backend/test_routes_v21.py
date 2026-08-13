"""Quick test of V2.1 API routes."""
import requests, tempfile, os, sys

BASE = "http://localhost:5000/api"
OK = "\033[92m[OK]\033[0m"; FAIL = "\033[91m[FAIL]\033[0m"
errs = []

def chk(label, cond, detail=""):
    print(f"  {OK if cond else FAIL}  {label}" + (f"  ({detail})" if detail else ""))
    if not cond: errs.append(label)

r = requests.post(BASE+"/auth/login", json={"email":"test@test.com","password":"Test1234"})
if not r.json().get("success"):
    r = requests.post(BASE+"/auth/login", json={"email":"runner@test.com","password":"Runner1234"})
tok = r.json()["token"]
h = {"Authorization": "Bearer " + tok}
chk("Login", r.json().get("success"))

# Monitor status
r2 = requests.get(BASE+"/monitor/status", headers=h)
d2 = r2.json()
chk("GET /monitor/status", d2.get("success"))
chk("service_running=True", d2.get("service_running") is True, str(d2.get("service_running")))

# Create a temp file + baseline
with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
    f.write("V2.1 route test content"); tmp = f.name

with open(tmp,"rb") as fh:
    up = requests.post(BASE+"/files/upload", headers=h, files={"file":fh}, data={"algorithm":"sha256"}).json()
chk("Upload for route test", up.get("success"))

bl = requests.post(BASE+"/files/baseline", headers=h, json={
    "temp_path": up["file"]["temp_path"],
    "original_name": "v21_route_test.txt",
    "algorithm": "sha256",
}).json()
chk("Baseline created", bl.get("success"), bl.get("error",""))
fid = bl.get("file_id")

# Enable realtime monitor
r3 = requests.post(BASE+f"/files/{fid}/monitor", headers=h, json={"abs_path": tmp})
chk("POST /files/{id}/monitor", r3.json().get("success"), r3.json().get("error",""))

# Monitoring info
r4 = requests.get(BASE+f"/files/{fid}/monitoring-info", headers=h)
d4 = r4.json()
chk("GET monitoring-info", d4.get("success"))
chk("currently_watched=True", d4.get("file",{}).get("currently_watched") is True)
chk("abs_file_path stored", bool(d4.get("file",{}).get("abs_file_path")))
chk("watcher_enabled=1", d4.get("file",{}).get("watcher_enabled") == 1)

# Pause
r5 = requests.post(BASE+f"/files/{fid}/pause-monitoring", headers=h)
chk("POST pause-monitoring", r5.json().get("success"))

r4b = requests.get(BASE+f"/files/{fid}/monitoring-info", headers=h)
chk("currently_watched=False after pause", r4b.json().get("file",{}).get("currently_watched") is False)

# Resume
r6 = requests.post(BASE+f"/files/{fid}/resume-monitoring", headers=h)
chk("POST resume-monitoring", r6.json().get("success"), r6.json().get("error",""))

r4c = requests.get(BASE+f"/files/{fid}/monitoring-info", headers=h)
chk("currently_watched=True after resume", r4c.json().get("file",{}).get("currently_watched") is True)

# Disable
r7 = requests.post(BASE+f"/files/{fid}/disable-monitoring", headers=h)
chk("POST disable-monitoring", r7.json().get("success"))

# Security checks
r8 = requests.post(BASE+f"/files/{fid}/monitor", headers=h, json={"abs_path": "relative/path.txt"})
chk("Relative path rejected", not r8.json().get("success"))

r9 = requests.post(BASE+f"/files/{fid}/monitor", headers=h, json={"abs_path": "C:/nonexistent/ghost.txt"})
chk("Nonexistent file rejected", not r9.json().get("success"))

r10 = requests.post(BASE+f"/files/{fid}/monitor", headers=h, json={})
chk("Missing abs_path rejected", not r10.json().get("success"))

# Cross-user isolation: other user cannot enable monitoring on fid
ru = requests.post(BASE+"/auth/register",
    json={"name":"Other","email":"othervtest@t.com","password":"Other1234"})
if ru.json().get("success"):
    h2 = {"Authorization": "Bearer " + ru.json()["token"]}
    rx = requests.post(BASE+f"/files/{fid}/monitor", headers=h2, json={"abs_path": tmp})
    chk("Cross-user monitor rejected (404)", rx.status_code == 404)

# Clean up
os.unlink(tmp)

print()
if not errs:
    print("\033[92mAll V2.1 route tests passed.\033[0m")
else:
    print(f"\033[91m{len(errs)} failure(s): {errs}\033[0m")
sys.exit(0 if not errs else 1)
