"""Evidence State Machine"""
from fastapi import HTTPException

VALID_TRANSITIONS = {
    "REGISTERED": ["SEALED", "COURT_HOLD", "ARCHIVED"],
    "SEALED": ["IN_CUSTODY"],
    "IN_CUSTODY": ["FORENSIC_ANALYSIS", "COURT_READY"],
    "FORENSIC_ANALYSIS": ["COURT_READY", "IN_CUSTODY"],
    "COURT_READY": ["COURT_HOLD", "COURT_ADMITTED", "ARCHIVED"],
    "COURT_HOLD": ["ARCHIVED", "COURT_READY", "COURT_ADMITTED"],
    "COURT_ADMITTED": ["ARCHIVED"],
    "ARCHIVED": ["DISPOSITION_PENDING", "IN_CUSTODY"],
    "DISPOSITION_PENDING": ["DESTROYED", "ARCHIVED"],
    "DESTROYED": []
}

def validate_transition(current_state: str, requested_state: str):
    # Some initial states in current DB might be 'COURT_ADMITTED' or arbitrary.
    # Let's map any unknown state to a generic starting point if it's not in VALID_TRANSITIONS,
    # or just strictly enforce if it is.
    if current_state not in VALID_TRANSITIONS:
        # For legacy data support
        return True
        
    allowed = VALID_TRANSITIONS.get(current_state, [])
    if requested_state not in allowed:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid state transition from {current_state} to {requested_state}"
        )
    return True
