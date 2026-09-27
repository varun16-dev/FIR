"""Audit log model"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), default="")
    role = Column(String(50), default="")
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), default="")
    resource_id = Column(String(100), default="")
    ip_address = Column(String(50), default="127.0.0.1")
    status = Column(String(50), default="SUCCESS")
    details = Column(Text, default="")
    previous_hash = Column(String(64), nullable=True)
    current_hash = Column(String(64), nullable=True)


class PrivilegeRequest(Base):
    __tablename__ = "privilege_requests"

    id = Column(Integer, primary_key=True, index=True)
    requested_by_email = Column(String(255), nullable=False)
    target_user_email = Column(String(255), nullable=False)
    target_full_name = Column(String(255), default="")
    requested_role = Column(String(50), nullable=False)
    justification = Column(Text, default="")
    status = Column(String(50), default="PENDING")  # PENDING, APPROVED, REJECTED
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CorrectionEvent(Base):
    __tablename__ = "correction_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    original_event_id = Column(String(50), nullable=False)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    old_value = Column(Text, nullable=False)
    new_value = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    previous_hash = Column(String(64), nullable=True)
    current_hash = Column(String(64), nullable=True)
    signature = Column(Text, nullable=False)

class MerkleCheckpoint(Base):
    __tablename__ = "merkle_checkpoints"

    id = Column(Integer, primary_key=True, index=True)
    checkpoint_id = Column(String(50), unique=True, index=True, nullable=False)
    tree_size = Column(Integer, nullable=False)
    merkle_root = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    hash_algorithm = Column(String(20), default="SHA-256")
    event_range_start = Column(Integer, nullable=False)
    event_range_end = Column(Integer, nullable=False)
    signature = Column(Text, nullable=True)
    signer_identity = Column(String(255), nullable=True)
    external_anchor_status = Column(String(50), default="PENDING") # PENDING, ANCHORED, FAILED
    external_anchor_timestamp = Column(DateTime, nullable=True)
    external_anchor_id = Column(String(255), nullable=True)
