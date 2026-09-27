"""AI analysis routes"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.evidence import Evidence
from app.models.ai_analysis import AIAnalysis
from app.models.user import User
from app.schemas import AIAnalysisOut
from app.security.auth import require_permission
from app.ai.pipeline import run_pipeline
from app.security.auth import decrypt_file
from app.utils.helpers import create_audit_log
from app.config import settings
import os

router = APIRouter(prefix="/api/ai", tags=["AI Analysis"])


@router.post("/analyze/{evidence_id}", response_model=AIAnalysisOut)
def analyze_evidence(
    evidence_id: int,
    user: User = Depends(require_permission("ai.analyze")),
    db: Session = Depends(get_db),
):
    ev = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    # Decrypt and read file
    storage_path = os.path.join(settings.STORAGE_DIR, ev.encrypted_path)
    if not os.path.exists(storage_path):
        raise HTTPException(status_code=404, detail="Evidence file not found")

    with open(storage_path, "rb") as f:
        encrypted_data = f.read()
    file_bytes = decrypt_file(encrypted_data)

    # Run AI pipeline
    result = run_pipeline(
        file_bytes, ev.mime_type, ev.original_filename,
        evidence_data={
            "stored_hash": ev.sha256_hash,
            "file_size": ev.file_size,
            "current_version": ev.current_version,
            "created_at": ev.created_at.isoformat() if ev.created_at else "",
        }
    )

    # Update or create AI record
    existing = db.query(AIAnalysis).filter(AIAnalysis.evidence_id == ev.id).first()
    if existing:
        existing.document_type = result["document_type"]
        existing.confidence = result["confidence"]
        existing.extracted_text = result["extracted_text"]
        existing.summary = result["summary"]
        existing.entities_json = json.dumps(result["entities"])
        existing.risk_score = result["risk_score"]
        existing.risk_level = result["risk_level"]
        existing.anomalies_json = json.dumps(result["anomalies"])
        existing.key_persons_count = result["key_persons_count"]
        existing.locations_count = result["locations_count"]
        existing.dates_count = result["dates_count"]
        existing.case_references_count = result["case_references_count"]
        existing.classification_method = result["classification_method"]
        ai_record = existing
    else:
        ai_record = AIAnalysis(
            evidence_id=ev.id,
            document_type=result["document_type"],
            confidence=result["confidence"],
            extracted_text=result["extracted_text"],
            summary=result["summary"],
            entities_json=json.dumps(result["entities"]),
            risk_score=result["risk_score"],
            risk_level=result["risk_level"],
            anomalies_json=json.dumps(result["anomalies"]),
            key_persons_count=result["key_persons_count"],
            locations_count=result["locations_count"],
            dates_count=result["dates_count"],
            case_references_count=result["case_references_count"],
            classification_method=result["classification_method"],
        )
        db.add(ai_record)

    ev.classification = result["document_type"]
    ev.ai_confidence = result["confidence"]
    ev.risk_score = result["risk_score"]
    db.commit()
    db.refresh(ai_record)

    create_audit_log(db, user_id=user.id, user_email=user.email, role=user.role,
                    action="AI_ANALYSIS", resource_type="EVIDENCE",
                    resource_id=ev.evidence_id)

    return AIAnalysisOut.model_validate(ai_record)


@router.get("/results/{evidence_id}", response_model=AIAnalysisOut)
def get_ai_results(
    evidence_id: int,
    user: User = Depends(require_permission("evidence.read")),
    db: Session = Depends(get_db),
):
    ev = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    ai = db.query(AIAnalysis).filter(AIAnalysis.evidence_id == ev.id).first()
    if not ai:
        raise HTTPException(status_code=404, detail="No AI analysis found. Run analysis first.")

    return AIAnalysisOut.model_validate(ai)


# =========================================================================
# 2. AI Case Assistant ("Ask the Case") Endpoints
# =========================================================================
from pydantic import BaseModel
from typing import Optional, List
from app.services.case_assistant import CaseAssistantService
from app.security.auth import require_any_permission


class AskCaseRequest(BaseModel):
    case_id: int
    query: str


@router.post("/ask-the-case")
def ask_the_case(
    req: AskCaseRequest,
    user: User = Depends(require_any_permission("cases.read", "evidence.read")),
    db: Session = Depends(get_db),
):
    """Interactive AI Assistant querying case facts, statement contradictions, and evidence."""
    result = CaseAssistantService.ask_the_case(db=db, case_id=req.case_id, query=req.query)

    create_audit_log(
        db, user_id=user.id, user_email=user.email, role=user.role,
        action="AI_ASK_THE_CASE", resource_type="CASE",
        resource_id=str(req.case_id), details={"query": req.query[:100]}
    )
    return result


@router.get("/case-contradictions/{case_id}")
def get_case_contradictions(
    case_id: int,
    user: User = Depends(require_any_permission("cases.read", "evidence.read")),
    db: Session = Depends(get_db),
):
    """Detects statement contradictions, temporal variances, and physical evidence mismatches."""
    contradictions = CaseAssistantService.detect_contradictions(db=db, case_id=case_id)
    return {
        "case_id": case_id,
        "total_contradictions": len(contradictions),
        "contradictions": contradictions,
    }


@router.get("/case-timeline/{case_id}")
def get_case_timeline(
    case_id: int,
    user: User = Depends(require_any_permission("cases.read", "evidence.read")),
    db: Session = Depends(get_db),
):
    """Synthesizes chronological crime timeline from FIR, witness records, and evidence intake."""
    timeline = CaseAssistantService.generate_timeline(db=db, case_id=case_id)
    return {
        "case_id": case_id,
        "total_milestones": len(timeline),
        "timeline": timeline,
    }

