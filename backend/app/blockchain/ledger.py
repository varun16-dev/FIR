"""Local permissioned blockchain simulation"""
import hashlib
import json
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session
from app.models.blockchain import BlockchainBlock


def _compute_block_hash(block_index: int, timestamp: str, previous_hash: str,
                         evidence_id: str, document_hash: str, action: str,
                         actor: str, metadata_json: str, nonce: int = 0) -> str:
    """Calculate SHA-256 hash for a block."""
    block_string = f"{block_index}{timestamp}{previous_hash}{evidence_id}{document_hash}{action}{actor}{metadata_json}{nonce}"
    return hashlib.sha256(block_string.encode()).hexdigest()


def get_latest_block(db: Session) -> Optional[BlockchainBlock]:
    return db.query(BlockchainBlock).order_by(BlockchainBlock.block_index.desc()).first()


def create_genesis_block(db: Session) -> BlockchainBlock:
    """Create the genesis block if it doesn't exist."""
    existing = db.query(BlockchainBlock).filter(BlockchainBlock.block_index == 0).first()
    if existing:
        return existing

    ts = datetime.utcnow().isoformat()
    block_hash = _compute_block_hash(0, ts, "0" * 64, "GENESIS", "", "GENESIS", "SYSTEM", "{}")
    genesis = BlockchainBlock(
        block_index=0,
        timestamp=datetime.utcnow(),
        previous_hash="0" * 64,
        current_hash=block_hash,
        evidence_id="GENESIS",
        document_hash="",
        action="GENESIS",
        actor="SYSTEM",
        actor_role="SYSTEM",
        metadata_json="{}",
    )
    db.add(genesis)
    db.commit()
    db.refresh(genesis)
    return genesis


def add_block(db: Session, evidence_id: str, document_hash: str,
              action: str, actor: str, actor_role: str = "",
              metadata: dict = None) -> BlockchainBlock:
    """Add a new block to the chain."""
    latest = get_latest_block(db)
    if not latest:
        latest = create_genesis_block(db)

    new_index = latest.block_index + 1
    ts = datetime.utcnow().isoformat()
    meta_json = json.dumps(metadata or {})
    block_hash = _compute_block_hash(
        new_index, ts, latest.current_hash,
        evidence_id, document_hash, action, actor, meta_json
    )

    block = BlockchainBlock(
        block_index=new_index,
        timestamp=datetime.utcnow(),
        previous_hash=latest.current_hash,
        current_hash=block_hash,
        evidence_id=evidence_id,
        document_hash=document_hash,
        action=action,
        actor=actor,
        actor_role=actor_role,
        metadata_json=meta_json,
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


def verify_chain(db: Session) -> dict:
    """Verify the entire blockchain integrity."""
    blocks: List[BlockchainBlock] = db.query(BlockchainBlock).order_by(BlockchainBlock.block_index).all()
    if not blocks:
        return {"valid": True, "message": "No blocks in chain", "blocks_checked": 0}

    errors = []
    for i, block in enumerate(blocks):
        # Verify current hash
        ts = block.timestamp.isoformat() if isinstance(block.timestamp, datetime) else str(block.timestamp)
        expected = _compute_block_hash(
            block.block_index, ts, block.previous_hash,
            block.evidence_id or "", block.document_hash or "",
            block.action or "", block.actor or "",
            block.metadata_json or "{}", block.nonce or 0
        )
        if block.current_hash != expected:
            errors.append({
                "block_index": block.block_index,
                "error": "HASH_MISMATCH",
                "expected": expected,
                "actual": block.current_hash,
            })

        # Verify chain linkage (skip genesis)
        if i > 0:
            if block.previous_hash != blocks[i - 1].current_hash:
                errors.append({
                    "block_index": block.block_index,
                    "error": "CHAIN_BREAK",
                    "expected_previous": blocks[i - 1].current_hash,
                    "actual_previous": block.previous_hash,
                })

    return {
        "valid": len(errors) == 0,
        "blocks_checked": len(blocks),
        "errors": errors,
        "message": "Blockchain integrity verified" if not errors else f"Found {len(errors)} integrity issues",
    }


def verify_evidence_blocks(db: Session, evidence_id: str) -> dict:
    """Verify blocks related to a specific evidence."""
    blocks = db.query(BlockchainBlock).filter(
        BlockchainBlock.evidence_id == evidence_id
    ).order_by(BlockchainBlock.block_index).all()

    if not blocks:
        return {"valid": True, "message": "No blocks found for this evidence", "blocks": []}

    block_data = []
    for b in blocks:
        block_data.append({
            "block_index": b.block_index,
            "action": b.action,
            "document_hash": b.document_hash,
            "current_hash": b.current_hash,
            "previous_hash": b.previous_hash,
            "actor": b.actor,
            "timestamp": b.timestamp.isoformat() if b.timestamp else "",
        })

    # Full chain verification
    chain_result = verify_chain(db)
    evidence_errors = [e for e in chain_result.get("errors", [])
                       if any(b.block_index == e["block_index"] for b in blocks)]

    return {
        "valid": len(evidence_errors) == 0,
        "chain_valid": chain_result["valid"],
        "blocks": block_data,
        "errors": evidence_errors,
    }
