"""Test suite verifying all 6 recommended features end-to-end:
1. New Criminal Laws (BSA 2023 Compliance & Section 63 Certificates)
2. AI Case Assistant ("Ask the Case", Contradictions, Timelines)
3. Automated PII Redaction (DPDP Act 2023)
4. Crime Scene GPS & EXIF Verification
5. National CCTNS / ICJS Integration
6. Citizen FIR Status Portal (OTP-based Milestone Tracker)
"""
import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal, init_db
from app.models.user import User
from app.models.case import Case
from app.models.evidence import Evidence
from app.security.auth import create_access_token

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("Starting Automated Verification of All 6 Recommended Additions")
    print("=" * 60)

    init_db()
    db = SessionLocal()

    # Get demo users and a sample case
    user = db.query(User).filter(User.role == "INVESTIGATOR").first()
    if not user:
        user = db.query(User).first()
    token = create_access_token(data={"sub": user.email, "role": user.role, "id": user.id})
    headers = {"Authorization": f"Bearer {token}"}

    case = db.query(Case).first()
    assert case is not None, "At least one case must exist in DB"
    evidence = db.query(Evidence).filter(Evidence.case_id == case.id).first()
    if not evidence:
        evidence = db.query(Evidence).first()

    print(f"Using Test Case: {case.case_number} (ID: {case.id})")
    print(f"Using Test Evidence: {evidence.evidence_id if evidence else 'None'}")

    # -------------------------------------------------------------
    # Feature 1: New Criminal Laws (BSA 2023 Compliance)
    # -------------------------------------------------------------
    print("\n[1/6] Testing New Criminal Laws (BSA 2023 Compliance)...")
    # 1a: BNS Mapper
    res = client.get("/api/legal/bns-mapper?query=302")
    assert res.status_code == 200, f"BNS mapper failed: {res.text}"
    data = res.json()
    assert any("103(1)" in m["bns"] for m in data["bns_matches"]), "BNS 103(1) for IPC 302 not found"
    print("  ✓ BNS Mapper (IPC 302 -> BNS 103(1)) OK")

    # 1b: Analyze Charges
    res = client.post("/api/legal/analyze-charges", json={"text": "Accused is charged under Section 302, 307 and 420 for murder and cheating."})
    assert res.status_code == 200, f"Analyze charges failed: {res.text}"
    conversions = res.json()["conversions"]
    assert len(conversions) >= 2, "Failed to parse criminal sections"
    print(f"  ✓ Automatic Section Scanner detected {len(conversions)} sections OK")

    # 1c: BSA Section 63 Certificate JSON & PDF
    if evidence:
        res = client.get(f"/api/legal/bsa-certificate/{evidence.evidence_id}", headers=headers)
        assert res.status_code == 200, f"BSA certificate JSON failed: {res.text}"
        assert "Section 63(4)" in res.json()["governing_statute"]
        print("  ✓ Section 63 Electronic Evidence Certificate Metadata OK")

        res = client.get(f"/api/legal/bsa-certificate/{evidence.evidence_id}/pdf", headers=headers)
        assert res.status_code == 200, f"BSA certificate PDF failed: {res.text}"
        assert res.headers["content-type"] == "application/pdf"
        assert len(res.content) > 1000
        print(f"  ✓ Section 63 Certificate PDF Generated ({len(res.content)} bytes) OK")

    # 1d: Case-level Section 63 Dossier PDF
    res = client.get(f"/api/legal/bsa-certificate/case/{case.id}/pdf", headers=headers)
    assert res.status_code == 200, f"Case BSA dossier PDF failed: {res.text}"
    assert res.headers["content-type"] == "application/pdf"
    print(f"  ✓ Consolidated Case Section 63 Dossier PDF Generated ({len(res.content)} bytes) OK")

    # -------------------------------------------------------------
    # Feature 2: AI Case Assistant ("Ask the Case")
    # -------------------------------------------------------------
    print("\n[2/6] Testing AI Case Assistant ('Ask the Case')...")
    # 2a: Interactive Q&A
    res = client.post("/api/ai/ask-the-case", json={"case_id": case.id, "query": "What are the key pieces of evidence and timeline of events?"}, headers=headers)
    assert res.status_code == 200, f"Ask the case failed: {res.text}"
    data = res.json()
    assert "answer" in data and len(data["answer"]) > 50
    print(f"  ✓ Ask the Case Q&A returned answer ({len(data['answer'])} chars) OK")

    # 2b: Contradictions Detection
    res = client.get(f"/api/ai/case-contradictions/{case.id}", headers=headers)
    assert res.status_code == 200, f"Case contradictions failed: {res.text}"
    contras = res.json()["contradictions"]
    print(f"  ✓ Contradiction Spotter identified {len(contras)} contradictions OK")

    # 2c: Chronological Timeline Generation
    res = client.get(f"/api/ai/case-timeline/{case.id}", headers=headers)
    assert res.status_code == 200, f"Case timeline failed: {res.text}"
    timeline = res.json()["timeline"]
    assert len(timeline) >= 4, "Timeline generated fewer milestones than expected"
    print(f"  ✓ Chronological Timeline generated {len(timeline)} chronological milestones OK")

    # -------------------------------------------------------------
    # Feature 3: Automated PII Redaction (DPDP Act 2023)
    # -------------------------------------------------------------
    print("\n[3/6] Testing Automated PII Redaction (DPDP Act 2023)...")
    sample_text = "Complainant Sunita Sharma (Aadhaar: 3829 4812 9021, Phone: 9811234567, email: sunita.s@gov.in, PAN: ABCDE1234F) reported theft."
    res = client.post("/api/legal/dpdp/redact-text", json={"text": sample_text, "victim_names": ["Sunita Sharma"]}, headers=headers)
    assert res.status_code == 200, f"DPDP text redact failed: {res.text}"
    data = res.json()
    assert data["stats"]["aadhaar"] >= 1
    assert data["stats"]["phone"] >= 1
    assert data["stats"]["email"] >= 1
    assert data["stats"]["pan"] >= 1
    assert "3829 4812 9021" not in data["redacted_text"]
    assert "9811234567" not in data["redacted_text"]
    print(f"  ✓ DPDP PII Engine masked {data['stats']['total_redacted']} identifiers OK")

    # 3b: Sanitized Case Record & PDF
    res = client.get(f"/api/legal/dpdp/redacted-case/{case.id}", headers=headers)
    assert res.status_code == 200, f"DPDP redacted case failed: {res.text}"
    sanitized = res.json()
    assert "redacted_title" in sanitized
    print(f"  ✓ DPDP Sanitized Case Record OK")

    res = client.get(f"/api/legal/dpdp/redacted-case/{case.id}/pdf", headers=headers)
    assert res.status_code == 200, f"DPDP redacted PDF failed: {res.text}"
    assert res.headers["content-type"] == "application/pdf"
    print(f"  ✓ DPDP Sanitized Public/Media FIR PDF Generated ({len(res.content)} bytes) OK")

    # -------------------------------------------------------------
    # Feature 4: Crime Scene GPS & EXIF Verification
    # -------------------------------------------------------------
    print("\n[4/6] Testing Crime Scene GPS & EXIF Verification...")
    if evidence:
        res = client.post(f"/api/evidence/{evidence.evidence_id}/verify-exif", headers=headers)
        assert res.status_code == 200, f"EXIF verify failed: {res.text}"
        data = res.json()
        assert "verification" in data
        assert data["verification"]["status"] in ["VERIFIED", "VICINITY_WARNING", "MISMATCH_DISTANCE", "NO_EXIF"]
        print(f"  ✓ GPS & EXIF Extraction & Verification Status: {data['verification']['status']} (Dist: {data['verification'].get('distance_meters')}m) OK")

        res = client.get(f"/api/evidence/{evidence.evidence_id}/exif", headers=headers)
        assert res.status_code == 200, f"EXIF get failed: {res.text}"
        print(f"  ✓ Stored EXIF GPS query OK")

    # -------------------------------------------------------------
    # Feature 5: National CCTNS / ICJS Integration
    # -------------------------------------------------------------
    print("\n[5/6] Testing National CCTNS / ICJS Integration...")
    # 5a: CCTNS Packet
    res = client.get(f"/api/cases/{case.id}/cctns-packet", headers=headers)
    assert res.status_code == 200, f"CCTNS packet failed: {res.text}"
    cctns_packet = res.json()
    assert "cctns_version" in cctns_packet
    print(f"  ✓ CCTNS CAS Standardized IIF Packet Generated OK")

    # 5b: CCTNS Sync
    res = client.post(f"/api/cases/{case.id}/cctns-sync", headers=headers)
    assert res.status_code == 200, f"CCTNS sync failed: {res.text}"
    sync_data = res.json()
    assert sync_data["sync_status"] == "SYNCED"
    print(f"  ✓ Synced to National CCTNS Registry: Token {sync_data['cctns_fir_number']} OK")

    # 5c: ICJS e-Court Dossier
    res = client.get(f"/api/cases/{case.id}/icjs-dossier", headers=headers)
    assert res.status_code == 200, f"ICJS dossier failed: {res.text}"
    icjs_dossier = res.json()
    assert "court_natural_record_number_cnr" in icjs_dossier
    print(f"  ✓ ICJS e-Court Interoperability Dossier Generated OK")

    # 5d: ICJS Transmission
    res = client.post(f"/api/cases/{case.id}/icjs-transmit", headers=headers)
    assert res.status_code == 200, f"ICJS transmit failed: {res.text}"
    tx_data = res.json()
    assert tx_data["transmission_status"] == "TRANSMITTED_TO_ECOURTS"
    print(f"  ✓ Transmitted to e-Courts ICJS Gateway: CNR {tx_data['cnr_number']} OK")

    # -------------------------------------------------------------
    # Feature 6: Citizen FIR Status Portal
    # -------------------------------------------------------------
    print("\n[6/6] Testing Citizen FIR Status Portal (OTP-based Public Tracker)...")
    # 6a: Request OTP (no auth header needed)
    res = client.post("/api/public/citizen/request-otp", json={"fir_number": case.case_number, "contact": "9812345678"})
    assert res.status_code == 200, f"Citizen OTP request failed: {res.text}"
    otp_data = res.json()
    session_id = otp_data["session_id"]
    demo_otp = otp_data.get("demo_otp_hint", "123456")
    print(f"  ✓ Citizen OTP Issued for {otp_data['masked_contact']} (Session: {session_id[:12]}...) OK")

    # 6b: Verify OTP
    res = client.post("/api/public/citizen/verify-otp", json={"session_id": session_id, "otp": demo_otp})
    assert res.status_code == 200, f"Citizen OTP verification failed: {res.text}"
    verify_data = res.json()
    access_token = verify_data["access_token"]
    print(f"  ✓ Citizen OTP Verified: Access Token {access_token[:14]}... OK")

    # 6c: Track FIR Milestones
    res = client.get(f"/api/public/citizen/track-fir?access_token={access_token}")
    assert res.status_code == 200, f"Citizen track FIR failed: {res.text}"
    track_data = res.json()
    assert track_data["success"] is True
    assert len(track_data["investigation_milestones"]) >= 5
    print(f"  ✓ Citizen Milestone Tracker returned {len(track_data['investigation_milestones'])} sanitized stages OK")

    # 6d: Citizen FIR Slip PDF
    res = client.get(f"/api/public/citizen/fir-receipt/{case.id}/pdf")
    assert res.status_code == 200, f"Citizen FIR slip PDF failed: {res.text}"
    assert res.headers["content-type"] == "application/pdf"
    print(f"  ✓ Citizen Section 173 BNSS FIR Acknowledgment Slip PDF Generated ({len(res.content)} bytes) OK")

    db.close()

    print("\n" + "=" * 60)
    print("ALL 6 RECOMMENDED ADDITIONS FULLY VERIFIED ON BACKEND!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
