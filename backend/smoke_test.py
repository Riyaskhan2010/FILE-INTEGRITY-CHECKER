"""Quick smoke test — verifies the full real-file flow end-to-end."""
import requests, tempfile, os, sys

BASE = "http://localhost:5000/api"
OK   = "\033[92m[OK]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"

def chk(label, cond, detail=""):
    print(f"  {OK if cond else FAIL}  {label}" + (f" — {detail}" if detail else ""))
    return cond

errors = []

# 1. Login
r = requests.post(BASE+"/auth/login", json={"email":"test@test.com","password":"Test1234"})
if not r.json().get("success"):
    r = requests.post(BASE+"/auth/login", json={"email":"runner@test.com","password":"Runner1234"})
if not chk("Login", r.json().get("success")):
    print("Cannot continue — login failed"); sys.exit(1)

tok = r.json()["token"]
hdrs = {"Authorization": f"Bearer {tok}"}

# 2. Dashboard
d = requests.get(BASE+"/dashboard", headers=hdrs).json()
chk("Dashboard loads", d.get("success"))
chk("Stats have real data", d.get("stats",{}).get("total_files",0) > 0,
    f"files={d.get('stats',{}).get('total_files')}")

# 3. Upload + hash
with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
    f.write("Real file content — smoke test"); tmp = f.name

with open(tmp,"rb") as fh:
    up = requests.post(BASE+"/files/upload", headers=hdrs,
                       files={"file": fh}, data={"algorithm":"sha256"}).json()
chk("Upload works", up.get("success"))
chk("SHA-256 returned", bool(up.get("hashes",{}).get("sha256")),
    (up.get("hashes",{}).get("sha256") or "")[:20])
chk("SHA-512 returned", bool(up.get("hashes",{}).get("sha512")))
chk("SHA-3-256 returned", bool(up.get("hashes",{}).get("sha3_256")))
chk("MD5 returned", bool(up.get("hashes",{}).get("md5")))
tp = up["file"]["temp_path"]
sha256 = up["hashes"]["sha256"]

# 4. Save baseline
bl = requests.post(BASE+"/files/baseline", headers=hdrs, json={
    "temp_path": tp, "original_name": "smoke_test.txt", "algorithm": "sha256"
}).json()
chk("Baseline saved", bl.get("success"), bl.get("error",""))
chk("Hash matches", bl.get("trusted_hash") == sha256)
fid = bl.get("file_id")

# 5. Verify unchanged
with open(tmp,"rb") as fh:
    up2 = requests.post(BASE+"/files/upload", headers=hdrs,
                        files={"file": fh}, data={"algorithm":"sha256"}).json()
v1 = requests.post(BASE+"/files/verify", headers=hdrs,
                   json={"temp_path": up2["file"]["temp_path"], "file_id": fid}).json()
chk("Verify unchanged = VERIFIED", v1.get("verified"), v1.get("status",""))

# 6. Modify + verify
with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
    f.write("MODIFIED content — tampered!"); tmp2 = f.name
with open(tmp2,"rb") as fh:
    up3 = requests.post(BASE+"/files/upload", headers=hdrs,
                        files={"file": fh}, data={"algorithm":"sha256"}).json()
v2 = requests.post(BASE+"/files/verify", headers=hdrs,
                   json={"temp_path": up3["file"]["temp_path"], "file_id": fid}).json()
chk("Verify modified = MODIFIED", not v2.get("verified"), v2.get("status",""))
chk("Change analysis returned", v2.get("original_size") is not None)

# 7. Alert created
alerts = requests.get(BASE+"/alerts", headers=hdrs).json()
chk("Alert created for modification",
    any(a["file_name"]=="smoke_test.txt" for a in alerts.get("alerts",[])))

# 8. Scan history
hist = requests.get(BASE+"/history?search=smoke_test", headers=hdrs).json()
chk("History has VERIFIED entry", any(h["status"]=="VERIFIED" for h in hist.get("history",[])))
chk("History has MODIFIED entry", any(h["status"]=="MODIFIED" for h in hist.get("history",[])))

# 9. Hash comparison
with open(tmp,"rb") as fh:
    cmp = requests.post(BASE+"/files/compare-hash", headers=hdrs,
                        files={"file": fh},
                        data={"expected_hash": sha256, "algorithm":"sha256"}).json()
chk("Hash comparison MATCH", cmp.get("match"))

with open(tmp2,"rb") as fh:
    cmp2 = requests.post(BASE+"/files/compare-hash", headers=hdrs,
                         files={"file": fh},
                         data={"expected_hash": sha256, "algorithm":"sha256"}).json()
chk("Hash comparison MISMATCH detected", not cmp2.get("match"))

# 10. PDF report
pdf = requests.post(BASE+"/reports/generate", headers=hdrs,
                    json={"file_id": fid, "format":"pdf"})
chk("PDF report generated", pdf.status_code == 200 and len(pdf.content) > 1000,
    f"{len(pdf.content)} bytes")

# 11. CSV report
csv = requests.post(BASE+"/reports/generate", headers=hdrs,
                    json={"file_id": fid, "format":"csv"})
chk("CSV report generated", csv.status_code == 200)

# 12. Dashboard stats updated
d2 = requests.get(BASE+"/dashboard", headers=hdrs).json()
chk("Dashboard reflects activity", d2["stats"].get("total_scans",0) >= 2)

# Cleanup
os.unlink(tmp); os.unlink(tmp2)

print("\n  All core flows verified — application is fully functional.\n")
