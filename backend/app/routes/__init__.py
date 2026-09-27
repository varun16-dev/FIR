from app.routes.auth import router as auth_router
from app.routes.cases import router as cases_router
from app.routes.evidence import router as evidence_router
from app.routes.ai import router as ai_router
from app.routes.blockchain import router as blockchain_router
from app.routes.audit import router as audit_router
from app.routes.users import router as users_router
from app.routes.dashboard import router as dashboard_router
from app.routes.reports import router as reports_router
from app.routes.public import router as public_router

from app.routes.approvals import router as approvals_router

__all__ = [
    "auth_router", "cases_router", "evidence_router", "ai_router",
    "blockchain_router", "audit_router", "users_router",
    "dashboard_router", "reports_router", "public_router",
    "approvals_router"
]

from app.routes.e3ee import router as e3ee_router
from app.routes.notifications import router as notifications_router
