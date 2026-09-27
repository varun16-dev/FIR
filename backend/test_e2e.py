import requests
import sys

BASE_URL = "http://localhost:8000"

def test():
    print("--- 1. Testing Root API ---")
    r = requests.get(f"{BASE_URL}/")
    assert r.status_code == 200, f"Root failed: {r.status_code} {r.text}"
    print(" Root API OK:", r.json())

    print("\n--- 2. Testing Authentication (Login) ---")
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@evidencevault.local",
        "password": "demo123"
    })
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    auth_data = r.json()
    token = auth_data["access_token"]
    user = auth_data["user"]
    print(" Login OK: User:", user["full_name"], "Role:", user["role"])

    headers = {"Authorization": f"Bearer {token}"}

    print("\n--- 3. Testing Current User (/api/auth/me) ---")
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
    assert r.status_code == 200, f"Get me failed: {r.status_code}"
    print(" Auth me OK:", r.json()["email"])

    print("\n--- 4. Testing Dashboard Stats (/api/dashboard/stats) ---")
    r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
    assert r.status_code == 200, f"Dashboard stats failed: {r.status_code} {r.text}"
    stats = r.json()
    print(" Dashboard Stats OK:", stats)

    print("\n--- 5. Testing Cases List (/api/cases) ---")
    r = requests.get(f"{BASE_URL}/api/cases", headers=headers)
    assert r.status_code == 200, f"Cases list failed: {r.status_code} {r.text}"
    cases = r.json()
    print(f" Cases List OK: Found {len(cases)} cases")
    assert len(cases) > 0, "No cases found!"
    first_case_id = cases[0]["id"]

    print(f"\n--- 6. Testing Case Detail (/api/cases/{first_case_id}) ---")
    r = requests.get(f"{BASE_URL}/api/cases/{first_case_id}", headers=headers)
    assert r.status_code == 200, f"Case detail failed: {r.status_code}"
    print(f" Case Detail OK: Case Number {r.json()['case_number']}")

    print("\n--- 7. Testing Evidence Vault (/api/evidence) ---")
    r = requests.get(f"{BASE_URL}/api/evidence", headers=headers)
    assert r.status_code == 200, f"Evidence list failed: {r.status_code} {r.text}"
    evidence_list = r.json()
    print(f" Evidence Vault OK: Found {len(evidence_list)} evidence items")
    assert len(evidence_list) > 0, "No evidence items found!"
    first_ev_id = evidence_list[0]["id"]

    print(f"\n--- 8. Testing Evidence Detail & Chain of Custody (/api/evidence/{first_ev_id}) ---")
    r = requests.get(f"{BASE_URL}/api/evidence/{first_ev_id}", headers=headers)
    assert r.status_code == 200, f"Evidence detail failed: {r.status_code}"
    ev_detail = r.json()
    print(f" Evidence Detail OK: {ev_detail['title']} (Hash: {ev_detail['sha256_hash'][:16]}...)")

    print(f"\n--- 9. Testing Evidence Custody Timeline (/api/evidence/{first_ev_id}/custody) ---")
    r = requests.get(f"{BASE_URL}/api/evidence/{first_ev_id}/custody", headers=headers)
    assert r.status_code == 200, f"Custody timeline failed: {r.status_code}"
    print(f" Custody Events OK: {len(r.json())} events recorded")

    print(f"\n--- 10. Testing Evidence Verification (/api/evidence/{first_ev_id}/verify) ---")
    r = requests.get(f"{BASE_URL}/api/evidence/{first_ev_id}/verify", headers=headers)
    assert r.status_code == 200, f"Evidence verify failed: {r.status_code}"
    print(" Evidence Integrity Verification OK:", r.json())

    print("\n--- 11. Testing Blockchain Ledger (/api/blockchain/blocks) ---")
    r = requests.get(f"{BASE_URL}/api/blockchain/blocks", headers=headers)
    assert r.status_code == 200, f"Blockchain blocks failed: {r.status_code}"
    blocks = r.json()
    print(f" Blockchain Ledger OK: {len(blocks)} blocks found")

    print("\n--- 12. Testing Blockchain Chain Integrity Verification (/api/blockchain/verify) ---")
    r = requests.get(f"{BASE_URL}/api/blockchain/verify", headers=headers)
    assert r.status_code == 200, f"Blockchain verify failed: {r.status_code}"
    print(" Blockchain Verification Result:", r.json())

    print("\n--- 13. Testing Audit Logs (/api/audit) ---")
    r = requests.get(f"{BASE_URL}/api/audit", headers=headers)
    assert r.status_code == 200, f"Audit logs failed: {r.status_code}"
    logs = r.json()
    print(f" Audit Logs OK: {len(logs)} audit entries recorded")

    print("\n--- 14. Testing AI Summary / Analysis (/api/ai/summarize/{first_ev_id}) ---")
    r = requests.get(f"{BASE_URL}/api/ai/summarize/{first_ev_id}", headers=headers)
    assert r.status_code == 200, f"AI summary failed: {r.status_code}"
    print(" AI Summary OK:", r.json().get("summary", "")[:120], "...")

    print("\n==========================================")
    print("🎉 ALL END-TO-END VERIFICATION CHECKS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    test()
