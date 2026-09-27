"""Blockchain simulation model"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.database import Base


class BlockchainBlock(Base):
    __tablename__ = "blockchain_blocks"

    id = Column(Integer, primary_key=True, index=True)
    block_index = Column(Integer, unique=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    previous_hash = Column(String(64), nullable=False)
    current_hash = Column(String(64), nullable=False)
    evidence_id = Column(String(50), nullable=True, index=True)
    document_hash = Column(String(64), default="")
    action = Column(String(100), nullable=False)
    actor = Column(String(255), default="")
    actor_role = Column(String(50), default="")
    metadata_json = Column(Text, default="{}")
    nonce = Column(Integer, default=0)
