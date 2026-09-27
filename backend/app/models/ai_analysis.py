"""AI Analysis model"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from app.database import Base


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=False, index=True)
    document_type = Column(String(100), default="OTHER")
    confidence = Column(Float, default=0.0)
    extracted_text = Column(Text, default="")
    summary = Column(Text, default="")
    entities_json = Column(Text, default="[]")
    risk_score = Column(Float, default=0.0)
    risk_level = Column(String(20), default="LOW")
    anomalies_json = Column(Text, default="[]")
    key_persons_count = Column(Integer, default=0)
    locations_count = Column(Integer, default=0)
    dates_count = Column(Integer, default=0)
    case_references_count = Column(Integer, default=0)
    classification_method = Column(String(50), default="keyword")
    processed_at = Column(DateTime, default=datetime.utcnow)
