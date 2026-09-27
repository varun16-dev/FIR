"""Multi-Party Authorization Engine"""
from sqlalchemy.orm import Session
import uuid
from datetime import datetime, timedelta
from app.models.approval import ApprovalRequest, ApprovalSignature
from app.services.signing import signer, create_canonical_payload
from fastapi import HTTPException

# Policy Configuration
MPA_POLICY = {
    "FREEZE_EVIDENCE": {"required_count": 1, "allowed_roles": ["AUDITOR"]},
    "UNSEAL_EVIDENCE": {"required_count": 1, "allowed_roles": ["AUDITOR", "LEGAL_OFFICER"]},
    "DESTROY_EVIDENCE": {"required_count": 1, "allowed_roles": ["FORENSIC_OFFICER", "LEGAL_OFFICER", "AUDITOR"]},
    "TRANSFER_EVIDENCE": {"required_count": 1, "allowed_roles": []}, # Evaluated dynamically
    "FINAL_REPORT": {"required_count": 1, "allowed_roles": ["LEGAL_OFFICER"]}
}

def verify_mpa_approval(db: Session, operation: str, evidence_id: int, request_id: str) -> bool:
    """Verifies if a specific operation has an APPROVED or EXECUTED MPA request."""
    if not request_id:
        raise HTTPException(status_code=403, detail=f"MPA Request ID required for {operation}")
        
    req = db.query(ApprovalRequest).filter(
        ApprovalRequest.request_id == request_id,
        ApprovalRequest.operation == operation,
        ApprovalRequest.evidence_id == evidence_id
    ).first()
    
    if not req:
        raise HTTPException(status_code=403, detail="Invalid MPA Request ID")
        
    if req.status not in ["APPROVED", "EXECUTED"]:
        raise HTTPException(status_code=403, detail=f"MPA Request is not approved. Current status: {req.status}")
        
    if req.status == "APPROVED":
        # Mark as executed so it can't be reused easily for another transaction
        req.status = "EXECUTED"
        req.execution_timestamp = datetime.utcnow()
        db.commit()
        
    return True


def create_approval_request(
    db: Session, 
    operation: str, 
    requester_id: int, 
    reason: str,
    evidence_id: int = None,
    case_id: int = None,
    current_state: str = "",
    requested_state: str = "",
    required_approval_count: int = 1,
    allowed_approver_roles: str = "",
    expires_in_hours: int = 24
) -> ApprovalRequest:
    req = ApprovalRequest(
        request_id=f"REQ-{uuid.uuid4().hex[:8].upper()}",
        operation=operation,
        requester_id=requester_id,
        evidence_id=evidence_id,
        case_id=case_id,
        reason=reason,
        current_state=current_state,
        requested_state=requested_state,
        required_approval_count=required_approval_count,
        allowed_approver_roles=allowed_approver_roles,
        status="PENDING",
        expires_at=datetime.utcnow() + timedelta(hours=expires_in_hours)
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

def approve_request(db: Session, request_id: str, approver_id: int, approver_role: str) -> bool:
    req = db.query(ApprovalRequest).filter(ApprovalRequest.request_id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    if req.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Request is not pending (Status: {req.status})")
        
    if datetime.utcnow() > req.expires_at:
        req.status = "EXPIRED"
        db.commit()
        raise HTTPException(status_code=400, detail="Approval request expired")

    if approver_id == req.requester_id:
        raise HTTPException(status_code=403, detail="Self-approval is strictly forbidden")

    allowed_roles = [r.strip() for r in req.allowed_approver_roles.split(",") if r.strip()]
    if allowed_roles and approver_role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Role {approver_role} not authorized for this approval")
        
    existing = db.query(ApprovalSignature).filter(
        ApprovalSignature.approval_request_id == req.id,
        ApprovalSignature.approver_id == approver_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already approved by this user")

    payload = create_canonical_payload(
        req.operation, req.requester_id, str(req.evidence_id or req.case_id), req.reason, approver_id=approver_id
    )
    sig = signer.sign(payload)
    
    app_sig = ApprovalSignature(
        approval_request_id=req.id,
        approver_id=approver_id,
        approver_role=approver_role,
        decision="APPROVED",
        signature=sig
    )
    db.add(app_sig)
    
    # Check quorum
    count = db.query(ApprovalSignature).filter(
        ApprovalSignature.approval_request_id == req.id,
        ApprovalSignature.decision == "APPROVED"
    ).count() + 1
    
    quorum_met = count >= req.required_approval_count
    
    if quorum_met:
        req.status = "APPROVED"
        
    db.commit()
    return quorum_met

def mark_executed(db: Session, request_id: str):
    req = db.query(ApprovalRequest).filter(ApprovalRequest.request_id == request_id).first()
    if req and req.status == "APPROVED":
        req.status = "EXECUTED"
        req.execution_timestamp = datetime.utcnow()
        db.commit()
