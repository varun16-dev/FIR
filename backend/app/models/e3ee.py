from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from datetime import datetime
from app.database import Base

class UserKey(Base):
    __tablename__ = "user_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    public_key = Column(String, nullable=False) # e.g., Base64 encoded RSA or ECC public key
    algorithm = Column(String(50), default="RSA-2048")
    key_version = Column(Integer, default=1)
    status = Column(String(50), default="ACTIVE") # ACTIVE, REVOKED
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

class EvidenceEncryptionMetadata(Base):
    __tablename__ = "evidence_encryption_metadata"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=False, unique=True)
    algorithm = Column(String(50), default="AES-256-GCM")
    key_version = Column(Integer, default=1)
    nonce = Column(String, nullable=False) # Base64 encoded nonce/IV
    auth_tag = Column(String, nullable=False) # Base64 encoded authentication tag
    ciphertext_hash = Column(String(64), nullable=False)
    encryption_version = Column(Integer, default=2) # 1=Legacy, 2=E3EE
    created_at = Column(DateTime, default=datetime.utcnow)

class EvidenceKeyEnvelope(Base):
    __tablename__ = "evidence_key_envelopes"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=False)
    recipient_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    wrapped_key = Column(String, nullable=False) # Base64 encoded encrypted AES key
    wrapping_algorithm = Column(String(50), default="RSA-OAEP")
    key_version = Column(Integer, default=1)
    status = Column(String(50), default="ACTIVE") # ACTIVE, REVOKED
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)
    
    # Optional context for temporary access
    authorization_ref = Column(String(100), nullable=True) 
    expires_at = Column(DateTime, nullable=True)
