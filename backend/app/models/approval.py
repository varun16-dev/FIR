"""Multi-Party Authorization Models"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from app.database import Base

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(50), unique=True, index=True, nullable=False)
    operation = Column(String(100), nullable=False)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    reason = Column(Text, nullable=False)
    current_state = Column(String(50), default="")
    requested_state = Column(String(50), default="")
    required_approval_count = Column(Integer, default=1)
    allowed_approver_roles = Column(String(255), nullable=False)  # comma separated
    status = Column(String(50), default="PENDING")  # PENDING, APPROVED, REJECTED, EXPIRED, EXECUTED
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    execution_timestamp = Column(DateTime, nullable=True)

class ApprovalSignature(Base):
    __tablename__ = "approval_signatures"

    id = Column(Integer, primary_key=True, index=True)
    approval_request_id = Column(Integer, ForeignKey("approval_requests.id"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approver_role = Column(String(50), nullable=False)
    decision = Column(String(50), nullable=False)  # APPROVED, REJECTED
    signature = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
