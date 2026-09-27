"""Automated test suite for QR Code & Public Verification System (Mobile & Laptop)."""
import base64
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_network_info():
    res = client.get("/api/public/network-info")
    assert res.status_code == 200, f"Network info failed: {res.text}"
    data = res.json()
    assert "lan_ip" in data, "lan_ip missing from network-info"
    assert "frontend_port" in data and data["frontend_port"] == 5173
    assert "mobile_base_url" in data
    assert "localhost_base_url" in data
    print(f"  [OK] Network info: LAN IP={data['lan_ip']}, Mobile Base={data['mobile_base_url']}")

def test_public_evidence_verification_by_id():
    res = client.get("/api/public/verify/evidence/1")
    assert res.status_code == 200, f"Failed verify evidence 1: {res.text}"
    data = res.json()
    assert data["valid"] is True
    assert "evidence" in data and "case" in data and "blockchain" in data
    assert "verification_url" in data and "/verify/evidence/" in data["verification_url"]
    assert "qr_code" in data and len(data["qr_code"]) > 100
    # Test decoding base64 QR PNG header
    qr_bytes = base64.b64decode(data["qr_code"])
    assert qr_bytes.startswith(b"\x89PNG\r\n\x1a\n"), "QR code is not a valid PNG image"
    print(f"  [OK] Evidence ID 1 verified: URL={data['verification_url']}, QR size={len(data['qr_code'])} chars")

def test_public_evidence_verification_by_code():
    # First get evidence code
    ev1 = client.get("/api/public/verify/evidence/1").json()["evidence"]
    code = ev1["evidence_id"]
    res = client.get(f"/api/public/verify/evidence/{code}?host=192.168.43.160:5173")
    assert res.status_code == 200
    data = res.json()
    assert data["evidence"]["evidence_id"] == code
    assert "192.168.43.160:5173/verify/evidence/" in data["verification_url"]
    print(f"  [OK] Evidence by string code '{code}' with custom mobile host verified: {data['verification_url']}")

def test_public_case_verification():
    res = client.get("/api/public/verify/case/CASE-2026-001")
    assert res.status_code == 200, f"Case verification failed: {res.text}"
    data = res.json()
    assert data["valid"] is True
    assert data["case"]["case_number"] == "CASE-2026-001"
    assert "/verify/case/CASE-2026-001" in data["verification_url"]
    assert "evidence_list" in data and data["evidence_count"] > 0
    assert "qr_code" in data and len(data["qr_code"]) > 100
    print(f"  [OK] Case 'CASE-2026-001' verified with {data['evidence_count']} evidence files secured")

def test_passport_route_scannable_qr():
    login_res = client.post("/api/auth/login", json={"email": "admin@evidencevault.local", "password": "demo123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    login_data = login_res.json()
    if login_data.get("mfa_required"):
        mfa_res = client.post("/api/auth/verify-mfa", json={
            "temp_token": login_data["temp_token"],
            "mfa_code": login_data["demo_totp_code"]
        })
        assert mfa_res.status_code == 200, f"MFA failed: {mfa_res.text}"
        token = mfa_res.json()["access_token"]
    else:
        token = login_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    
    res = client.get("/api/evidence/1/passport?host=192.168.43.160:5173", headers=headers)
    assert res.status_code == 200, f"Passport fetch failed: {res.text}"
    data = res.json()
    assert "verification_url" in data and data["verification_url"] is not None
    assert "/verify/evidence/" in data["verification_url"]
    assert "qr_code" in data and len(data["qr_code"]) > 100
    print(f"  [OK] Passport route returns scannable URL: {data['verification_url']}")

if __name__ == "__main__":
    print("==================================================")
    print("Running Universal QR Verification Test Suite")
    print("==================================================")
    test_network_info()
    test_public_evidence_verification_by_id()
    test_public_evidence_verification_by_code()
    test_public_case_verification()
    test_passport_route_scannable_qr()
    print("==================================================")
    print("[SUCCESS] ALL QR & PUBLIC VERIFICATION TESTS PASSED!")
    print("==================================================")
