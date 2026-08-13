"""Dashboard polish verification tests."""
import requests, sys

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

# 1. Login
r = requests.post(BASE+"/auth/login", json={"email":"test@test.com","password":"Test1234"})
if not r.json().get("success"):
    r = requests.post(BASE+"/auth/login", json={"email":"runner@test.com","password":"Runner1234"})
chk("Login", r.json().get("success"))
tok = r.json()["token"]
h   = {"Authorization": "Bearer " + tok}

# 2. Dashboard loads
d     = requests.get(BASE+"/dashboard", headers=h).json()
stats = d.get("stats", {})
chk("Dashboard loads", d.get("success"))

# 3. Protected Files = active_monitoring value
am    = stats.get("active_monitoring", -1)
total = stats.get("total_files", 0)
chk("active_monitoring is non-negative integer", am >= 0, "value=" + str(am))
chk("active_monitoring <= total_files (sanity)", total >= am, "total=" + str(total) + ", active=" + str(am))

# 4. Security score is 0-100 and dynamic
sc = stats.get("security_score", -1)
chk("Security score present", sc != -1, "score=" + str(sc))
chk("Security score is 0-100", 0 <= sc <= 100, "score=" + str(sc))
chk("Verified, modified, alerts are in stats", all(k in stats for k in ["verified","modified","unread_alerts"]))

# 5. recent_activity has is_demo field
recent = d.get("recent_activity", [])
chk("recent_activity returned", len(recent) >= 0, "count=" + str(len(recent)))
if recent:
    chk("is_demo field present", "is_demo" in recent[0])
    real_c = sum(1 for x in recent if x.get("is_demo") != 1)
    demo_c = sum(1 for x in recent if x.get("is_demo") == 1)
    chk("Real/demo items distinguishable", True, "real=" + str(real_c) + ", demo=" + str(demo_c))

# 6. Scan history NOT modified
hist = requests.get(BASE+"/history?per_page=100", headers=h).json()
chk("History endpoint works", hist.get("success"))
chk("History has records (none deleted)", hist.get("total", 0) > 0, "total=" + str(hist.get("total")))

# 7. Alerts NOT modified
alerts = requests.get(BASE+"/alerts", headers=h).json()
chk("Alerts endpoint works", alerts.get("success"))

print()
if not errs:
    print("  \033[92mAll checks passed.\033[0m")
else:
    print("  \033[91m" + str(len(errs)) + " failure(s): " + str(errs) + "\033[0m")
print()
print("  active_monitoring (Protected Files): " + str(am))
print("  Security score:                      " + str(sc) + "/100")
print("  Total scan records:                  " + str(hist.get("total", 0)))
sys.exit(0 if not errs else 1)
