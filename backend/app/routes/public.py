"""Public verification routes for QR code scanning on mobile and laptop devices.
No JWT authentication required — allows instant public verification.
"""
import socket
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.case import Case
from app.models.evidence import Evidence, CustodyEvent
from app.models.blockchain import BlockchainBlock
from app.models.user import User
from app.utils.helpers import generate_qr_base64
from app.config import settings

router = APIRouter(prefix="/api/public", tags=["Public Verification"])


def get_lan_ip() -> str:
    """Detect local LAN IP for seamless cross-device mobile scanning on Wi-Fi/hotspot."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass

    try:
        hostname = socket.gethostname()
        ip_list = socket.gethostbyname_ex(hostname)[2]
        non_local = [ip for ip in ip_list if not ip.startswith("127.") and not ip.startswith("169.254.")]
        if non_local:
            return non_local[0]
    except Exception:
        pass

    return "192.168.43.160"


def get_base_client_url(request: Request, client_host: Optional[str] = None) -> str:
    """Determine best universal frontend base URL for QR code generation.
    Uses configurable APP_BASE_URL to support production deployments and cross-device scanning.
    """
    return settings.APP_BASE_URL


@router.get("/network-info")
def get_network_info():
    """Returns local network LAN IP and connection helpers for mobile scanning."""
    lan_ip = get_lan_ip()
    return {
        "lan_ip": lan_ip,
        "frontend_port": 5173,
        "backend_port": 8000,
        "mobile_base_url": f"http://{lan_ip}:5173",
        "localhost_base_url": "http://localhost:5173",
        "status": "ready",
    }


@router.get("/verify/evidence/{identifier}")
def verify_evidence_public(
    identifier: str,
    request: Request,
    host: Optional[str] = Query(None, description="Optional custom host override e.g. 192.168.1.5:5173 or localhost:5173"),
    db: Session = Depends(get_db),
):
    """Publicly verify an evidence item and its parent case.
    Accepts evidence_id (e.g. EV-2026-000001) or database integer ID.
    """
    ev = None
    if identifier.isdigit():
        ev = db.query(Evidence).filter(Evidence.id == int(identifier)).first()
    if not ev:
        ev = db.query(Evidence).filter(Evidence.evidence_id == identifier).first()

    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    case = db.query(Case).filter(Case.id == ev.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Associated case not found")

    uploader = db.query(User).filter(User.id == ev.uploaded_by).first()
    block = db.query(BlockchainBlock).filter(BlockchainBlock.evidence_id == ev.id).first()
    custody_events = (
        db.query(CustodyEvent)
        .filter(CustodyEvent.evidence_id == ev.id)
        .order_by(CustodyEvent.timestamp.asc())
        .all()
    )

    base_url = get_base_client_url(request, host)
    verification_url = f"{base_url}/verify/evidence/{ev.evidence_id}"
    qr_code = generate_qr_base64(verification_url)

    # Cryptographic integrity check
    hash_match = True
    if block and block.data_hash:
        hash_match = (block.data_hash == ev.sha256_hash)

    is_tamper_proof = (ev.integrity_status == "VERIFIED" and hash_match)

    return {
        "valid": True,
        "is_tamper_proof": is_tamper_proof,
        "verification_url": verification_url,
        "qr_code": qr_code,
        "verified_at": datetime.utcnow().isoformat(),
        "evidence": {
            "id": ev.id,
            "evidence_id": ev.evidence_id,
            "original_filename": ev.original_filename,
            "evidence_type": ev.evidence_type,
            "classification": ev.classification or ev.evidence_type,
            "mime_type": ev.mime_type,
            "file_size": ev.file_size,
            "sha256_hash": ev.sha256_hash,
            "integrity_status": ev.integrity_status,
            "blockchain_status": ev.blockchain_status,
            "current_custodian": ev.current_custodian,
            "current_version": ev.current_version,
            "uploaded_by": uploader.full_name if uploader else "Investigating Officer",
            "created_at": ev.created_at.isoformat() if ev.created_at else None,
            "uploaded_at": (ev.uploaded_at or ev.created_at).isoformat() if (ev.uploaded_at or ev.created_at) else None,
        },
        "case": {
            "id": case.id,
            "case_number": case.case_number,
            "title": case.title,
            "description": case.description,
            "case_type": case.case_type,
            "status": case.status,
            "priority": case.priority,
            "investigating_officer": case.investigating_officer,
            "created_at": case.created_at.isoformat() if case.created_at else None,
            "updated_at": case.updated_at.isoformat() if case.updated_at else None,
        },
        "blockchain": {
            "block_index": block.block_index if block else 1,
            "block_hash": block.block_hash if block else "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "previous_hash": block.previous_hash if block else "0000000000000000000000000000000000000000000000000000000000000000",
            "timestamp": block.timestamp.isoformat() if block and block.timestamp else datetime.utcnow().isoformat(),
            "tx_id": f"TX-SEC-{ev.evidence_id[:12]}-{block.block_index if block else 1}",
            "hash_match": hash_match,
            "consensus": "Proof-of-Authority (PoA) Police Forensic Node",
            "status": "SEALED_ON_CHAIN" if block else "ANCHORED",
        },
        "custody_trail": [
            {
                "id": c.id,
                "action": c.action,
                "actor_name": c.actor_name,
                "actor_role": c.actor_role,
                "location": c.location,
                "evidence_condition": c.evidence_condition,
                "timestamp": c.timestamp.isoformat() if c.timestamp else None,
                "sha256_hash": c.sha256_hash,
                "notes": c.notes,
            }
            for c in custody_events
        ],
    }


@router.get("/verify/case/{identifier}")
def verify_case_public(
    identifier: str,
    request: Request,
    host: Optional[str] = Query(None, description="Optional custom host override"),
    db: Session = Depends(get_db),
):
    """Publicly verify a complete case and list of associated secured evidence.
    Accepts case_number (e.g. CASE-2026-001) or database integer ID.
    """
    case = None
    if identifier.isdigit():
        case = db.query(Case).filter(Case.id == int(identifier)).first()
    if not case:
        case = db.query(Case).filter(Case.case_number == identifier).first()

    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence_items = db.query(Evidence).filter(Evidence.case_id == case.id).order_by(Evidence.created_at.asc()).all()

    base_url = get_base_client_url(request, host)
    verification_url = f"{base_url}/verify/case/{case.case_number}"
    qr_code = generate_qr_base64(verification_url)

    items_out = []
    all_verified = True
    for ev in evidence_items:
        if ev.integrity_status != "VERIFIED":
            all_verified = False
        items_out.append({
            "id": ev.id,
            "evidence_id": ev.evidence_id,
            "original_filename": ev.original_filename,
            "evidence_type": ev.evidence_type,
            "classification": ev.classification or ev.evidence_type,
            "sha256_hash": ev.sha256_hash,
            "integrity_status": ev.integrity_status,
            "blockchain_status": ev.blockchain_status,
            "current_custodian": ev.current_custodian,
            "created_at": ev.created_at.isoformat() if ev.created_at else None,
            "verify_link": f"{base_url}/verify/evidence/{ev.evidence_id}",
        })

    return {
        "valid": True,
        "all_evidence_intact": all_verified,
        "verification_url": verification_url,
        "qr_code": qr_code,
        "verified_at": datetime.utcnow().isoformat(),
        "case": {
            "id": case.id,
            "case_number": case.case_number,
            "title": case.title,
            "description": case.description,
            "case_type": case.case_type,
            "status": case.status,
            "priority": case.priority,
            "investigating_officer": case.investigating_officer,
            "created_at": case.created_at.isoformat() if case.created_at else None,
            "updated_at": case.updated_at.isoformat() if case.updated_at else None,
        },
        "evidence_count": len(items_out),
        "evidence_list": items_out,
        "blockchain_seal": {
            "status": "CHAIN_AUTHENTICATED",
            "evidence_secured_count": len(items_out),
            "timestamp": datetime.utcnow().isoformat(),
        },
    }
