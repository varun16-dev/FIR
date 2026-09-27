"""Utility functions"""
import os
import uuid
import base64
import io
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.utils.files import (  # noqa: F401 — re-export for existing imports
    ALLOWED_EXTENSIONS,
    ALLOWED_MIMES,
    sanitize_filename,
    validate_file,
)


# --- Evidence ID Generator ---
_evidence_counter = 0


def generate_evidence_id(db: Session) -> str:
    """Generate unique evidence ID like EV-2026-000001."""
    from app.models.evidence import Evidence
    year = datetime.utcnow().year
    count = db.query(Evidence).count() + 1
    return f"EV-{year}-{count:06d}"


def generate_case_number(db: Session) -> str:
    """Generate unique case number like CASE-2026-001."""
    from app.models.case import Case
    year = datetime.utcnow().year
    count = db.query(Case).count() + 1
    return f"CASE-{year}-{count:03d}"


# --- Audit Logging ---
def create_audit_log(db: Session, user_id: int = None, user_email: str = "",
                     role: str = "", action: str = "", resource_type: str = "",
                     resource_id: str = "", ip_address: str = "127.0.0.1",
                     status: str = "SUCCESS", details: str = "", commit: bool = True):
    log = AuditLog(
        user_id=user_id,
        user_email=user_email,
        role=role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        status=status,
        details=details,
    )
    
    log.timestamp = datetime.utcnow()
    # Cryptographic chaining
    last_log = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    log.previous_hash = last_log.current_hash if last_log and last_log.current_hash else "GENESIS_AUDIT_HASH"
    
    import hashlib
    import json
    data_to_hash = f"{log.user_id}:{log.action}:{log.resource_id}:{log.timestamp}:{log.previous_hash}"
    log.current_hash = hashlib.sha256(data_to_hash.encode()).hexdigest()

    db.add(log)
    if commit:
        db.commit()
        db.refresh(log)
        try:
            from app.services.audit_service import process_merkle_checkpoint
            process_merkle_checkpoint(db, force=False)
        except Exception as e:
            print(f"Merkle error: {e}")
            
    return log


# --- QR Code ---
def generate_qr_base64(data: str) -> str:
    """Generate QR code as base64 PNG string."""
    try:
        import qrcode
        qr = qrcode.make(data)
        buffer = io.BytesIO()
        qr.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()
    except ImportError:
        return ""


