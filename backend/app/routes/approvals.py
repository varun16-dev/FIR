from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.security.auth import get_current_user, require_any_permission
from app.services.mpa import create_approval_request, approve_request
from app.models.approval import ApprovalRequest, ApprovalSignature
from typing import List, Dict, Any

router = APIRouter(
    prefix="/api/approvals",
    tags=["Multi-Party Authorization"]
)

@router.get("/")
def get_requests(
    evidence_id: int = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ApprovalRequest)
    if evidence_id:
        query = query.filter(ApprovalRequest.evidence_id == evidence_id)
    requests = query.order_by(ApprovalRequest.created_at.desc()).all()
    
    result = []
    for r in requests:
        sigs = db.query(ApprovalSignature).filter(ApprovalSignature.request_id == r.request_id).all()
        result.append({
            "id": r.id,
            "request_id": r.request_id,
            "operation": r.operation,
            "requester_id": r.requester_id,
            "reason": r.reason,
            "evidence_id": r.evidence_id,
            "status": r.status,
            "required_approval_count": r.required_approval_count,
            "allowed_approver_roles": r.allowed_approver_roles,
            "created_at": r.created_at,
            "signatures": [{"approver_id": s.approver_id, "approver_role": s.approver_role, "signed_at": s.signed_at} for s in sigs]
        })
    return result

@router.post("/")
def create_request(
    payload: Dict[str, Any] = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    operation = payload.get("operation")
    reason = payload.get("reason", "No reason provided")
    evidence_id = payload.get("evidence_id")
    req = create_approval_request(
        db=db,
        operation=operation,
        requester_id=user.id,
        reason=reason,
        evidence_id=evidence_id,
        required_approval_count=payload.get("required_approval_count", 1),
        allowed_approver_roles=payload.get("allowed_approver_roles", "")
    )
    return {"status": "success", "request_id": req.request_id}

@router.post("/{request_id}/approve")
def approve(
    request_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quorum_met = approve_request(db, request_id, user.id, user.role)
    from app.utils.helpers import create_audit_log
    create_audit_log(
        db, user_id=user.id, user_email=user.email, role=user.role,
        action="APPROVAL_SIGNED", resource_type="APPROVAL_REQUEST", resource_id=request_id,
        details=f"Approved request {request_id}. Quorum met: {quorum_met}"
    )
    
    if quorum_met:
        # Actually execute the operation here or mark it as executable for the requester.
        # For simplicity, we just mark it as APPROVED, and the original caller can now poll and execute it,
        # or we execute it synchronously if we map operations to functions.
        pass
        
    return {"status": "success", "quorum_met": quorum_met}
