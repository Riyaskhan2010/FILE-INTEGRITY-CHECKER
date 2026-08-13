"""Sections 17-18: cross-user isolation + change password."""
import requests, random, string, sys

BASE = "http://localhost:5000/api"
OK   = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
errs = []

def chk(label, cond, detail=""):
    sym = OK if cond else FAIL
    print(f"  {sym}  {label}" + (f"  →  {detail}" if detail else ""))
    if not cond: errs.append(label)

# get a real file_id from runner account
r = requests.post(f"{BASE}/auth/login", json={"email":"runner@test.com","password":"Runner1234"})
tok1 = r.json().get("token","")
h1   = {"Authorization": f"Bearer {tok1}"}
files = requests.get(f"{BASE}/files", headers=h1).json().get("files",[])
file_id = files[0]["id"] if files else 1

print("\n── 17. Cross-user isolation ──────────────────────────────")
tag = "".join(random.choices(string.ascii_lowercase, k=5))
r2  = requests.post(f"{BASE}/auth/register",
                    json={"name":"Other","email":f"other_{tag}@t.com","password":"Other1234"})
tok2 = r2.json().get("token","")
h2   = {"Authorization": f"Bearer {tok2}"}

r_get = requests.get(f"{BASE}/files/{file_id}", headers=h2)
chk("Other user cannot GET our file (404)", r_get.status_code == 404, str(r_get.status_code))

r_del = requests.delete(f"{BASE}/files/{file_id}", headers=h2)
chk("Other user cannot DELETE our file (404)", r_del.status_code == 404, str(r_del.status_code))

r_unauth = requests.get(f"{BASE}/dashboard")
chk("Unauthenticated request rejected (401/422)", r_unauth.status_code in (401, 422), str(r_unauth.status_code))

print("\n── 18. Change Password ───────────────────────────────────")
r_cp = requests.post(f"{BASE}/auth/change-password", headers=h1,
                     json={"current_password":"Runner1234","new_password":"Runner5678"})
chk("Change password succeeds", r_cp.json().get("success"), r_cp.json().get("error",""))

r_new = requests.post(f"{BASE}/auth/login", json={"email":"runner@test.com","password":"Runner5678"})
chk("Login with new password works", r_new.json().get("success"))

r_old = requests.post(f"{BASE}/auth/login", json={"email":"runner@test.com","password":"Runner1234"})
chk("Old password now rejected", not r_old.json().get("success"))

# restore
hnew = {"Authorization": f"Bearer {r_new.json().get('token','')}"}
requests.post(f"{BASE}/auth/change-password", headers=hnew,
              json={"current_password":"Runner5678","new_password":"Runner1234"})
print("  (password restored)")

print(f"\n{'='*52}")
if not errs:
    print("  \033[92m\033[1mSections 17-18: ALL PASSED\033[0m")
else:
    print(f"  \033[91m{len(errs)} failure(s): {errs}\033[0m")
print("="*52)
sys.exit(0 if not errs else 1)
