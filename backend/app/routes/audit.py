"""Audit log routes"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas import AuditLogOut
from app.security.auth import require_permission, get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])


@router.get("/logins")
def list_login_history(
    status: Optional[str] = None,
    user_email: Optional[str] = None,
    role: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_actions = [action] if action else ["LOGIN", "LOGOUT"]
    q = db.query(AuditLog).filter(AuditLog.action.in_(target_actions))
    if status:
        q = q.filter(AuditLog.status == status)
    if user_email:
        q = q.filter(AuditLog.user_email.ilike(f"%{user_email}%"))
    if role:
        q = q.filter(AuditLog.role == role)

    logs = q.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()

    user_ids = {l.user_id for l in logs if l.user_id}
    users_by_id = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    results = []
    for l in logs:
        u = users_by_id.get(l.user_id) if l.user_id else None
        fallback_name = l.user_email.split("@")[0].replace(".", " ").title() if l.user_email else "Unknown"
        results.append({
            "id": l.id,
            "timestamp": l.timestamp.isoformat() if l.timestamp else "",
            "user_id": l.user_id,
            "user_email": l.user_email,
            "full_name": u.full_name if u else fallback_name,
            "badge_number": u.badge_number if u else (l.resource_id if l.resource_id and not l.resource_id.startswith("AUTH") else ""),
            "department": u.department if u else "",
            "role": l.role or (u.role if u else "OFFICER"),
            "action": l.action,
            "ip_address": l.ip_address or "127.0.0.1",
            "status": l.status,
            "details": l.details or f"{l.action} session recorded",
            "is_current_user": bool(current_user and ((l.user_id == current_user.id) or (l.user_email == current_user.email))),
        })
    return results


@router.delete("/logins")
def clear_login_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Purge synthetic or prior login records so tracking starts fresh from live authentications."""
    deleted_count = db.query(AuditLog).filter(
        AuditLog.action.in_(["LOGIN", "LOGOUT", "LOGIN_PASSWORD_VERIFIED", "MFA_CHALLENGE"])
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Cleared {deleted_count} prior login records. Live tracking active."}


@router.get("", response_model=list[AuditLogOut])

def list_audit_logs(
    action: Optional[str] = None,
    user_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_permission("audit.read")),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if user_email:
        q = q.filter(AuditLog.user_email.ilike(f"%{user_email}%"))
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    if status:
        q = q.filter(AuditLog.status == status)

    logs = q.order_by(AuditLog.timestamp.desc()).offset(skip).limit(limit).all()
    return [AuditLogOut.model_validate(l) for l in logs]
