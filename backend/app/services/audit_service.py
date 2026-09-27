"""Audit & Merkle Anchor Integration Service"""
from sqlalchemy.orm import Session
from app.models.audit import AuditLog, MerkleCheckpoint
from app.services.merkle import MerkleTree, compute_leaf_hash
from app.services.anchors import anchor_provider
from app.services.signing import signer
from datetime import datetime

CHECKPOINT_INTERVAL = 10  # Every N events, create a checkpoint

def get_unanchored_events(db: Session):
    last_ckpt = db.query(MerkleCheckpoint).order_by(MerkleCheckpoint.id.desc()).first()
    start_id = last_ckpt.event_range_end + 1 if last_ckpt else 1
    
    events = db.query(AuditLog).filter(AuditLog.id >= start_id).order_by(AuditLog.id.asc()).all()
    return start_id, events

def process_merkle_checkpoint(db: Session, force: bool = False):
    start_id, events = get_unanchored_events(db)
    
    if not events:
        return None
        
    if len(events) < CHECKPOINT_INTERVAL and not force:
        return None

    # Compute leaves
    leaves = []
    for ev in events:
        event_data = {
            "id": ev.id,
            "action": ev.action,
            "hash": ev.current_hash,
            "timestamp": ev.timestamp.isoformat()
        }
        leaves.append(compute_leaf_hash(event_data))

    tree = MerkleTree(leaves)
    root = tree.root
    end_id = events[-1].id
    
    ckpt_id = f"CKPT-{start_id}-{end_id}"
    
    # Sign checkpoint
    payload = {
        "checkpoint_id": ckpt_id,
        "merkle_root": root,
        "tree_size": len(leaves),
        "range": f"{start_id}-{end_id}"
    }
    signature = signer.sign(payload)
    
    ckpt = MerkleCheckpoint(
        checkpoint_id=ckpt_id,
        tree_size=len(leaves),
        merkle_root=root,
        hash_algorithm="SHA-256",
        event_range_start=start_id,
        event_range_end=end_id,
        signature=signature,
        signer_identity="DevelopmentSigner",
        external_anchor_status="PENDING"
    )
    db.add(ckpt)
    db.commit()
    db.refresh(ckpt)
    
    # Anchor externally
    try:
        anchor_data = {
            "checkpoint_id": ckpt.checkpoint_id,
            "merkle_root": ckpt.merkle_root,
            "tree_size": ckpt.tree_size,
            "event_range": f"{ckpt.event_range_start}-{ckpt.event_range_end}",
            "signature": ckpt.signature,
            "signer_identity": ckpt.signer_identity,
            "timestamp": ckpt.created_at.isoformat()
        }
        ext_id = anchor_provider.anchor_checkpoint(anchor_data)
        ckpt.external_anchor_id = ext_id
        ckpt.external_anchor_status = "ANCHORED"
        ckpt.external_anchor_timestamp = datetime.utcnow()
        db.commit()
    except Exception as e:
        ckpt.external_anchor_status = "FAILED"
        db.commit()
        print(f"Failed to anchor checkpoint {ckpt_id}: {e}")

    return ckpt
