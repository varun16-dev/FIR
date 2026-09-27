"""EvidenceVault — Secure Digital Document Management System
FastAPI Main Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.blockchain import create_genesis_block
from app.database import SessionLocal
from app.routes import (
    auth_router, cases_router, evidence_router, ai_router,
    blockchain_router, audit_router, users_router,
    dashboard_router, reports_router, public_router, approvals_router
)

app = FastAPI(
    title="EvidenceVault API",
    description="Secure Digital Document Management System for Legal & Investigation Documents",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow frontend & mobile devices on local network
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(public_router)
app.include_router(auth_router)
app.include_router(cases_router)
app.include_router(evidence_router)
app.include_router(ai_router)
app.include_router(blockchain_router)
app.include_router(audit_router)
app.include_router(users_router)
app.include_router(dashboard_router)
app.include_router(reports_router)
app.include_router(approvals_router)
from app.routes.legal import router as legal_router
app.include_router(legal_router)



@app.on_event("startup")
def startup():
    init_db()
    # Create genesis block
    db = SessionLocal()
    try:
        create_genesis_block(db)
    finally:
        db.close()


@app.get("/", tags=["Root"])
def root():
    return {
        "name": "EvidenceVault API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }
from app.routes.e3ee import router as e3ee_router
from app.routes.notifications import router as notifications_router
app.include_router(e3ee_router)
app.include_router(notifications_router)
