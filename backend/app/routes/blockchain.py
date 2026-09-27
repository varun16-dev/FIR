"""Blockchain routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.blockchain import BlockchainBlock
from app.models.user import User
from app.schemas import BlockOut, ChainVerifyResult
from app.security.auth import get_current_user
from app.blockchain import verify_chain, verify_evidence_blocks
from app.utils.helpers import create_audit_log

router = APIRouter(prefix="/api/blockchain", tags=["Blockchain"])


@router.get("/blocks", response_model=list[BlockOut])
def list_blocks(
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    blocks = db.query(BlockchainBlock).order_by(
        BlockchainBlock.block_index.desc()
    ).offset(skip).limit(limit).all()
    return [BlockOut.model_validate(b) for b in blocks]


@router.get("/evidence/{evidence_id}")
def get_evidence_blocks(
    evidence_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = verify_evidence_blocks(db, evidence_id)
    return result


@router.post("/verify", response_model=ChainVerifyResult)
def verify_blockchain(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = verify_chain(db)

    create_audit_log(db, user_id=user.id, user_email=user.email, role=user.role,
                    action="BLOCKCHAIN_VERIFIED", resource_type="BLOCKCHAIN",
                    status="SUCCESS" if result["valid"] else "WARNING",
                    details=result["message"])

    return ChainVerifyResult(**result)


@router.post("/verify/{evidence_id}")
def verify_evidence_chain(
    evidence_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = verify_evidence_blocks(db, evidence_id)
    return result
