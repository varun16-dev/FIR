from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.security.auth import get_current_user, require_any_permission, require_permission
from app.models.user import User
from app.models.e3ee import UserKey, EvidenceEncryptionMetadata, EvidenceKeyEnvelope
from app.models.evidence import Evidence
from pydantic import BaseModel
from app.services.key_management import DevelopmentKeyProvider
from app.utils.helpers import create_audit_log
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/e3ee", tags=["E3EE"])

class PublicKeyUpload(BaseModel):
    public_key: str
    algorithm: str = "RSA-2048"

class E3EEMetadataUpload(BaseModel):
    evidence_id: int
    algorithm: str = "AES-256-GCM"
    nonce: str
    auth_tag: str
    ciphertext_hash: str

class EnvelopeGrant(BaseModel):
    evidence_id: int
    recipient_user_id: int
    wrapped_key: str
    wrapping_algorithm: str = "RSA-OAEP"

@router.post("/keypair")
def generate_dev_keypair():
    """DEVELOPMENT ONLY: Generate an RSA keypair for client-side testing."""
    priv, pub = DevelopmentKeyProvider.generate_user_keypair()
    return {"private_key": priv, "public_key": pub}

@router.post("/public-key")
def upload_public_key(payload: PublicKeyUpload, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Uploads the user's public key for receiving E3EE key envelopes."""
    key = db.query(UserKey).filter(UserKey.user_id == user.id, UserKey.status == "ACTIVE").first()
    if key:
        key.status = "REVOKED"
        key.revoked_at = datetime.utcnow()
    
    new_key = UserKey(
        user_id=user.id,
        public_key=payload.public_key,
        algorithm=payload.algorithm,
        status="ACTIVE"
    )
    db.add(new_key)
    db.commit()
    return {"message": "Public key registered"}

@router.get("/public-key/{user_id}")
def get_public_key(user_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve an active public key for a user to wrap an evidence key for them."""
    key = db.query(UserKey).filter(UserKey.user_id == user_id, UserKey.status == "ACTIVE").first()
    if not key:
        raise HTTPException(status_code=404, detail="Active public key not found for user")
    return {"user_id": user_id, "public_key": key.public_key, "algorithm": key.algorithm}

@router.post("/metadata")
def upload_encryption_metadata(payload: E3EEMetadataUpload, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Upload encryption metadata for an evidence file (nonce, tag, etc)."""
    ev = db.query(Evidence).filter(Evidence.id == payload.evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    meta = db.query(EvidenceEncryptionMetadata).filter(EvidenceEncryptionMetadata.evidence_id == payload.evidence_id).first()
    if meta:
        raise HTTPException(status_code=400, detail="Metadata already exists for this evidence")
        
    new_meta = EvidenceEncryptionMetadata(
        evidence_id=payload.evidence_id,
        algorithm=payload.algorithm,
        nonce=payload.nonce,
        auth_tag=payload.auth_tag,
        ciphertext_hash=payload.ciphertext_hash,
        encryption_version=2
    )
    db.add(new_meta)
    
    # Also update evidence version
    ev.encryption_version = 2
    db.commit()
    return {"message": "Metadata stored"}

@router.get("/metadata/{evidence_id}")
def get_encryption_metadata(evidence_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meta = db.query(EvidenceEncryptionMetadata).filter(EvidenceEncryptionMetadata.evidence_id == evidence_id).first()
    if not meta:
        raise HTTPException(status_code=404, detail="Metadata not found")
    return {
        "algorithm": meta.algorithm,
        "nonce": meta.nonce,
        "auth_tag": meta.auth_tag,
        "ciphertext_hash": meta.ciphertext_hash,
        "encryption_version": meta.encryption_version
    }

@router.post("/envelope/grant")
def grant_key_envelope(payload: EnvelopeGrant, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Store a wrapped key for a specific recipient."""
    ev = db.query(Evidence).filter(Evidence.id == payload.evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
    
    # Basic Authorization: must be uploader or investigating officer, OR an admin configuring access
    if user.role not in ["INVESTIGATING_OFFICER", "ADMINISTRATOR"] and ev.uploaded_by != user.id:
        raise HTTPException(status_code=403, detail="Unauthorized to grant key envelopes for this evidence")
        
    env = EvidenceKeyEnvelope(
        evidence_id=payload.evidence_id,
        recipient_user_id=payload.recipient_user_id,
        wrapped_key=payload.wrapped_key,
        wrapping_algorithm=payload.wrapping_algorithm,
        status="ACTIVE"
    )
    db.add(env)
    
    create_audit_log(
        db, user_id=user.id, user_email=user.email, role=user.role,
        action="E3EE_KEY_GRANTED", status="SUCCESS",
        resource_type="KEY_ENVELOPE", resource_id=str(ev.evidence_id),
        details=f"Key envelope granted to user_id {payload.recipient_user_id}"
    )
    
    db.commit()
    return {"message": "Key envelope granted", "envelope_id": env.id}

@router.get("/envelope/{evidence_id}")
def get_my_envelope(evidence_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve the current user's key envelope for a given evidence ID, respecting authorization."""
    # Enforce basic ABAC via case
    ev = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    # Check if they have an active envelope
    env = db.query(EvidenceKeyEnvelope).filter(
        EvidenceKeyEnvelope.evidence_id == evidence_id,
        EvidenceKeyEnvelope.recipient_user_id == user.id,
        EvidenceKeyEnvelope.status == "ACTIVE"
    ).order_by(EvidenceKeyEnvelope.id.desc()).first()
    
    if not env:
        raise HTTPException(status_code=403, detail="No active key envelope found for your user")
        
    # Check expiration (Temporary Access / MPA integration)
    if env.expires_at and env.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Temporary key envelope has expired")
        
    # Prevent Admin and Auditor from automatically accessing raw plaintext just by getting an envelope
    # (Unless they were specifically granted a temporary one with unseal)
    if user.role in ["ADMINISTRATOR", "COMPLIANCE_AUDITOR"] and not env.authorization_ref:
        raise HTTPException(status_code=403, detail="Role not authorized for direct plaintext access without MPA")
        
    return {
        "envelope_id": env.id,
        "wrapped_key": env.wrapped_key,
        "wrapping_algorithm": env.wrapping_algorithm,
        "expires_at": env.expires_at
    }

@router.post("/envelope/{envelope_id}/revoke")
def revoke_envelope(envelope_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    env = db.query(EvidenceKeyEnvelope).filter(EvidenceKeyEnvelope.id == envelope_id).first()
    if not env:
        raise HTTPException(status_code=404, detail="Envelope not found")
        
    # Only Admin or Uploader can revoke
    ev = db.query(Evidence).filter(Evidence.id == env.evidence_id).first()
    if user.role != "ADMINISTRATOR" and ev.uploaded_by != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to revoke")
        
    env.status = "REVOKED"
    env.revoked_at = datetime.utcnow()
    
    create_audit_log(
        db, user_id=user.id, user_email=user.email, role=user.role,
        action="E3EE_KEY_REVOKED", status="SUCCESS",
        resource_type="KEY_ENVELOPE", resource_id=str(env.id),
        details=f"Key envelope revoked for user_id {env.recipient_user_id}"
    )
    
    db.commit()
    return {"message": "Envelope revoked"}
