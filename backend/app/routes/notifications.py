"""Notifications API — Real-time alerts, approvals, and custody events"""
from datetime import datetime, timedelta
from typing import List, Optional, Set
from fastapi import APIRouter, Depends, Body, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.case import Case
from app.models.evidence import Evidence, CustodyEvent
from app.models.approval import ApprovalRequest
from app.models.audit import AuditLog, PrivilegeRequest
from app.models.notification import NotificationState
from app.security.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class MarkReadPayload(BaseModel):
    id: Optional[str] = None  # if None, mark all as read


class DismissPayload(BaseModel):
    id: str


def _get_notification_states(db: Session, user_id: int):
    states = db.query(NotificationState).filter(NotificationState.user_id == user_id).all()
    read_ids = {s.notification_id for s in states if s.is_read}
    dismissed_ids = {s.notification_id for s in states if s.is_dismissed}
    return read_ids, dismissed_ids


@router.get("")
def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns aggregated paginated notifications for the current authenticated user:
    """
    read_ids, dismissed_ids = _get_notification_states(db, user.id)

    notifications = []

    # 1. Tamper / Hash Mismatch Alerts
    tampered_evidence = db.query(Evidence).filter(Evidence.integrity_status == "TAMPERED").order_by(Evidence.updated_at.desc()).limit(20).all()
    for ev in tampered_evidence:
        nid = f"tamper-ev-{ev.id}"
        if nid not in dismissed_ids:
            notifications.append({
                "id": nid,
                "type": "CRITICAL",
                "category": "TAMPER_ALERT",
                "title": f"Integrity Failure: {ev.original_filename}",
                "message": f"SHA-256 hash mismatch detected on evidence {ev.evidence_id}. Chain of custody quarantine flagged.",
                "timestamp": (ev.updated_at or datetime.utcnow()).isoformat(),
                "link": f"/evidence/{ev.id}",
                "read": nid in read_ids,
            })

    # 2. Multi-Party Approval (MPA) Requests
    approvals = db.query(ApprovalRequest).filter(ApprovalRequest.status == "PENDING").order_by(ApprovalRequest.created_at.desc()).limit(20).all()
    for req in approvals:
        nid = f"mpa-req-{req.id}"
        if nid not in dismissed_ids:
            is_eligible = not req.allowed_approver_roles or user.role in req.allowed_approver_roles.split(",")
            notifications.append({
                "id": nid,
                "type": "WARNING",
                "category": "APPROVAL",
                "title": f"Pending Multi-Party Approval: {req.operation.replace('_', ' ')}",
                "message": f"{req.reason} (Evidence #{req.evidence_id}). Action required: {req.required_approval_count} signatures needed.",
                "timestamp": (req.created_at or datetime.utcnow()).isoformat(),
                "link": f"/evidence/{req.evidence_id}" if req.evidence_id else "/evidence",
                "read": nid in read_ids,
                "badge": "Action Required" if is_eligible else "Pending Other Officers",
            })

    # 3. Pending Custody Transfers
    recent_transfers = (
        db.query(CustodyEvent)
        .filter(CustodyEvent.action.in_(["EVIDENCE_TRANSFERRED", "CUSTODY_TRANSFERRED"]))
        .order_by(CustodyEvent.timestamp.desc())
        .limit(20)
        .all()
    )
    for tr in recent_transfers:
        nid = f"transfer-{tr.id}"
        if nid not in dismissed_ids:
            ev = db.query(Evidence).filter(Evidence.id == tr.evidence_id).first()
            ev_name = ev.original_filename if ev else f"Item #{tr.evidence_id}"
            notifications.append({
                "id": nid,
                "type": "INFO",
                "category": "CUSTODY_TRANSFER",
                "title": f"Custody Handoff: {ev_name}",
                "message": f"Handoff logged by {tr.actor_name} ({tr.actor_role}). Destination: {tr.location}. Status: {tr.integrity_state}.",
                "timestamp": (tr.timestamp or datetime.utcnow()).isoformat(),
                "link": f"/evidence/{tr.evidence_id}",
                "read": nid in read_ids,
            })

    # 4. Role-Specific Alerts
    role = (user.role or "").upper()
    if role in ["ADMIN", "AUDITOR"]:
        priv_reqs = db.query(PrivilegeRequest).filter(PrivilegeRequest.status == "PENDING").order_by(PrivilegeRequest.created_at.desc()).limit(20).all()
        for p in priv_reqs:
            nid = f"priv-req-{p.id}"
            if nid not in dismissed_ids:
                notifications.append({
                    "id": nid,
                    "type": "WARNING",
                    "category": "RBAC",
                    "title": f"Privilege Elevation Request: {p.target_user_email}",
                    "message": f"{p.target_full_name} requested role {p.requested_role}: \"{p.justification}\"",
                    "timestamp": (p.created_at or datetime.utcnow()).isoformat(),
                    "link": "/users" if role == "ADMIN" else "/audit",
                    "read": nid in read_ids,
                })

        frozen_cases = db.query(Case).filter(Case.is_frozen == True).order_by(Case.updated_at.desc()).limit(20).all()
        for fc in frozen_cases:
            nid = f"frozen-case-{fc.id}"
            if nid not in dismissed_ids:
                notifications.append({
                    "id": nid,
                    "type": "WARNING",
                    "category": "QUARANTINE",
                    "title": f"Legal Hold Active: {fc.case_number}",
                    "message": f"Case \"{fc.title}\" is currently under cryptographic quarantine.",
                    "timestamp": (fc.updated_at or datetime.utcnow()).isoformat(),
                    "link": f"/cases/{fc.id}",
                    "read": nid in read_ids,
                })

    elif role in ["INVESTIGATOR", "IO"]:
        my_cases = db.query(Case).filter(
            (Case.assigned_user_id == user.id) | (Case.investigating_officer.like(f"%{user.full_name}%"))
        ).order_by(Case.created_at.desc()).limit(10).all()
        for c in my_cases:
            nid = f"my-case-{c.id}"
            if nid not in dismissed_ids:
                ev_cnt = db.query(Evidence).filter(Evidence.case_id == c.id).count()
                notifications.append({
                    "id": nid,
                    "type": "SUCCESS",
                    "category": "ASSIGNMENT",
                    "title": f"Assigned Case: {c.case_number}",
                    "message": f"Active docket \"{c.title}\" ({c.status}) — {ev_cnt} registered evidence items.",
                    "timestamp": (c.created_at or datetime.utcnow()).isoformat(),
                    "link": f"/cases/{c.id}",
                    "read": nid in read_ids,
                })

    elif role in ["FORENSIC_OFFICER", "FORENSICS"]:
        pending_lab = db.query(Evidence).filter(
            Evidence.forensic_status.in_(["PENDING_ANALYSIS", "IN_ANALYSIS"])
        ).order_by(Evidence.uploaded_at.desc()).limit(20).all()
        for pe in pending_lab:
            nid = f"lab-queue-{pe.id}"
            if nid not in dismissed_ids:
                notifications.append({
                    "id": nid,
                    "type": "INFO",
                    "category": "LAB_WORK",
                    "title": f"Workbench Task: {pe.original_filename}",
                    "message": f"Item {pe.evidence_id} is queued for forensic acquisition and child report derivation.",
                    "timestamp": (pe.uploaded_at or datetime.utcnow()).isoformat(),
                    "link": f"/evidence/{pe.id}",
                    "read": nid in read_ids,
                })

    elif role in ["LEGAL_OFFICER", "PROSECUTOR"]:
        court_cases = db.query(Case).filter(Case.is_court_ready == True).order_by(Case.updated_at.desc()).limit(20).all()
        for cc in court_cases:
            nid = f"court-ready-{cc.id}"
            if nid not in dismissed_ids:
                notifications.append({
                    "id": nid,
                    "type": "SUCCESS",
                    "category": "COURT_DOCKET",
                    "title": f"Court Ready Docket: {cc.case_number}",
                    "message": f"Evidence bundle for \"{cc.title}\" certified under BSA Section 63 with presentation watermarks.",
                    "timestamp": (cc.updated_at or datetime.utcnow()).isoformat(),
                    "link": f"/cases/{cc.id}",
                    "read": nid in read_ids,
                })

    # Sort notifications: unread first, then newest
    notifications.sort(key=lambda n: n["timestamp"], reverse=True)
    notifications.sort(key=lambda n: 1 if n["read"] else 0)

    total_count = len(notifications)
    paginated = notifications[offset:offset + limit]

    return {
        "notifications": paginated,
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total_count
    }


@router.get("/unread-count")
def get_unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get count of unread, undismissed notifications."""
    read_ids, dismissed_ids = _get_notification_states(db, user.id)
    
    # We must calculate total available notifications to subtract read/dismissed accurately
    # To do this efficiently, we call get_notifications with a very high limit but we only need the count
    # Since get_notifications already does the filtering, we can just use its result.
    all_notifs = get_notifications(limit=1000, offset=0, user=user, db=db)
    
    unread = sum(1 for n in all_notifs["notifications"] if not n["read"])
    return {"unread_count": unread}


def _update_or_create_state(db: Session, user_id: int, notification_id: str, is_read: bool = None, is_dismissed: bool = None):
    state = db.query(NotificationState).filter(
        NotificationState.user_id == user_id, 
        NotificationState.notification_id == notification_id
    ).first()
    
    if not state:
        state = NotificationState(user_id=user_id, notification_id=notification_id)
        db.add(state)
        
    if is_read is not None:
        state.is_read = is_read
    if is_dismissed is not None:
        state.is_dismissed = is_dismissed
        
    db.commit()


@router.post("/read")
def mark_read(
    payload: MarkReadPayload = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a specific notification or all notifications as read."""
    if payload.id:
        _update_or_create_state(db, user.id, payload.id, is_read=True)
        return {"status": "ok", "read_count": 1}
    else:
        # Mark all currently generated as read
        all_notifs = get_notifications(limit=1000, offset=0, user=user, db=db)
        count = 0
        for n in all_notifs["notifications"]:
            if not n["read"]:
                _update_or_create_state(db, user.id, n["id"], is_read=True)
                count += 1
        return {"status": "ok", "read_count": count}


@router.post("/{id}/read")
def mark_read_path(
    id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a specific notification as read via path parameter."""
    _update_or_create_state(db, user.id, id, is_read=True)
    return {"status": "ok", "read_id": id}


@router.post("/dismiss")
def dismiss_notification_body(
    payload: DismissPayload = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dismiss a notification from view via body."""
    _update_or_create_state(db, user.id, payload.id, is_dismissed=True)
    return {"status": "ok", "dismissed_id": payload.id}


@router.post("/{id}/dismiss")
def dismiss_notification(
    id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dismiss a notification from view."""
    _update_or_create_state(db, user.id, id, is_dismissed=True)
    return {"status": "ok", "dismissed_id": id}
