"""Evidence registration pipeline: hash, metadata, encrypt, persist, custody, audit."""
from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Callable, Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models.case import Case
from app.models.evidence import Evidence, EvidenceVersion, CustodyEvent, EvidenceRelationship
from app.models.user import User
from app.security.encryption import encrypt_file
from app.utils.files import (
    compute_sha256,
    extract_metadata,
    file_type_from_mime,
    generate_storage_filename,
    sanitize_filename,
    validate_file,
)
from app.utils.helpers import generate_evidence_id, create_audit_log

StageCallback = Callable[[str, dict], None]


def _emit(cb: Optional[StageCallback], stage: str, extra: Optional[dict] = None):
    if cb:
        cb(stage, extra or {})


def register_evidence_upload(
    db: Session,
    user: User,
    case: Case,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    description: str = "",
    change_reason: str = "Initial upload",
    on_stage: Optional[StageCallback] = None,
) -> Evidence:
    error = validate_file(filename or "unnamed", content_type or "", len(file_bytes), file_bytes)
    if error:
        raise ValueError(error)

    _emit(on_stage, "hashing")
    file_hash = compute_sha256(file_bytes)

    _emit(on_stage, "metadata")
    safe_name = sanitize_filename(filename or "unnamed")
    mime = (content_type or "").split(";")[0].strip() or "application/octet-stream"
    metadata = extract_metadata(file_bytes, safe_name, mime)
    file_type = file_type_from_mime(mime, safe_name)

    _emit(on_stage, "encryption")
    encrypted = encrypt_file(file_bytes)
    storage_name = generate_storage_filename(safe_name)
    storage_path = os.path.join(settings.STORAGE_DIR, storage_name)
    os.makedirs(settings.STORAGE_DIR, exist_ok=True)
    with open(storage_path, "wb") as fh:
        fh.write(encrypted)

    _emit(on_stage, "registration")
    ev_id = generate_evidence_id(db)
    now = datetime.utcnow()
    evidence = Evidence(
        evidence_id=ev_id,
        case_id=case.id,
        original_filename=safe_name,
        stored_filename=storage_name,
        evidence_type=file_type,
        file_type=file_type,
        mime_type=mime,
        file_size=len(file_bytes),
        sha256_hash=file_hash,
        encrypted_path=storage_name,
        current_version=1,
        status="REGISTERED",
        current_custodian=user.full_name,
        custodian_id=user.id,
        classification=metadata.get("file_type") or file_type,
        ai_confidence=0.0,
        integrity_status="PENDING",
        blockchain_status="NOT_REGISTERED",
        custody_count=1,
        risk_score=0.0,
        description=description or json.dumps({"metadata": metadata}, default=str)[:2000],
        uploaded_by=user.id,
        uploaded_at=now,
        created_at=now,
    )
    db.add(evidence)
    db.flush()

    version = EvidenceVersion(
        evidence_id=evidence.id,
        version_number=1,
        filename=safe_name,
        sha256_hash=file_hash,
        encrypted_path=storage_name,
        file_size=len(file_bytes),
        action="UPLOADED",
        reason=change_reason,
        change_reason=change_reason,
        actor_id=user.id,
        actor_name=user.full_name,
        uploaded_by=user.full_name,
    )
    db.add(version)

    custody = CustodyEvent(
        evidence_id=evidence.id,
        actor_id=user.id,
        actor_name=user.full_name,
        actor_role=user.role,
        action="EVIDENCE_CREATED",
        location="Digital Evidence Vault",
        evidence_condition="INTACT",
        notes=f"Evidence {ev_id} created from upload {safe_name}",
        sha256_hash=file_hash,
    )
    db.add(custody)

    db.add(EvidenceRelationship(
        source_evidence_id=evidence.id,
        target_case_id=case.id,
        relationship_type="BELONGS_TO",
        label="Belongs to",
        node_type="CASE",
        node_label=case.case_number,
    ))

    db.flush()

    create_audit_log(
        db, user_id=user.id, user_email=user.email, role=user.role,
        action="EVIDENCE_UPLOADED", resource_type="EVIDENCE",
        resource_id=ev_id, details=f"File: {safe_name}; SHA-256: {file_hash}",
        commit=False,
    )
    create_audit_log(
        db, user_id=user.id, user_email=user.email, role=user.role,
        action="VERSION_CREATED", resource_type="EVIDENCE",
        resource_id=ev_id, details="Version 1 created",
        commit=False,
    )
    db.commit()
    db.refresh(evidence)
    _emit(on_stage, "completed", {"evidence_id": evidence.evidence_id})
    return evidence


def create_new_version(
    db: Session,
    user: User,
    evidence: Evidence,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    change_reason: str = "New version uploaded",
) -> EvidenceVersion:
    error = validate_file(filename or evidence.original_filename, content_type or "", len(file_bytes), file_bytes)
    if error:
        raise ValueError(error)

    file_hash = compute_sha256(file_bytes)
    safe_name = sanitize_filename(filename or evidence.original_filename)
    encrypted = encrypt_file(file_bytes)
    storage_name = generate_storage_filename(safe_name)
    storage_path = os.path.join(settings.STORAGE_DIR, storage_name)
    os.makedirs(settings.STORAGE_DIR, exist_ok=True)
    with open(storage_path, "wb") as fh:
        fh.write(encrypted)

    next_ver = (evidence.current_version or 1) + 1
    version = EvidenceVersion(
        evidence_id=evidence.id,
        version_number=next_ver,
        filename=safe_name,
        sha256_hash=file_hash,
        encrypted_path=storage_name,
        file_size=len(file_bytes),
        action="VERSIONED",
        reason=change_reason,
        change_reason=change_reason,
        actor_id=user.id,
        actor_name=user.full_name,
        uploaded_by=user.full_name,
    )
    db.add(version)

    evidence.current_version = next_ver
    evidence.sha256_hash = file_hash
    evidence.file_size = len(file_bytes)
    evidence.original_filename = safe_name
    evidence.stored_filename = storage_name
    evidence.encrypted_path = storage_name
    evidence.integrity_status = "PENDING"
    evidence.status = "REGISTERED"
    evidence.mime_type = (content_type or evidence.mime_type or "").split(";")[0].strip()

    create_audit_log(
        db, user_id=user.id, user_email=user.email, role=user.role,
        action="VERSION_CREATED", resource_type="EVIDENCE",
        resource_id=evidence.evidence_id,
        details=f"Version {next_ver}: {change_reason}",
        commit=False,
    )
    db.commit()
    db.refresh(version)
    return version


def verify_evidence_integrity(db: Session, evidence: Evidence) -> dict:
    storage_name = evidence.encrypted_path or evidence.stored_filename or ""
    storage_path = os.path.join(settings.STORAGE_DIR, storage_name)
    computed_hash = ""
    hash_match = False
    details = ""

    if not os.path.exists(storage_path):
        computed_hash = "FILE_NOT_FOUND"
        details = "Encrypted file is missing from storage."
        status_str = "TAMPERED"
    else:
        from app.security.encryption import decrypt_file
        try:
            with open(storage_path, "rb") as fh:
                encrypted_data = fh.read()
            decrypted = decrypt_file(encrypted_data)
            computed_hash = compute_sha256(decrypted)
            hash_match = computed_hash == evidence.sha256_hash
            if hash_match:
                status_str = "VERIFIED"
                details = "Document integrity verified. SHA-256 matches the stored hash."
            else:
                status_str = "TAMPERED"
                details = "TAMPERING DETECTED: stored hash does not match decrypted file hash."
        except Exception as exc:
            computed_hash = "DECRYPTION_FAILED"
            status_str = "TAMPERED"
            details = f"Unable to decrypt stored file: {exc}"

    evidence.integrity_status = status_str
    if status_str == "VERIFIED":
        evidence.status = "VERIFIED"
    elif status_str == "TAMPERED":
        evidence.status = "TAMPERED"
    db.commit()

    return {
        "status": status_str,
        "hash_match": hash_match,
        "stored_hash": evidence.sha256_hash,
        "computed_hash": computed_hash,
        "details": details,
    }
