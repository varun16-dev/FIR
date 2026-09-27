# Evidence Vault - Security Architecture

## Overview
The Evidence Vault is hardened against insider abuse, database compromise, and application server compromise.

## Multi-Layered Defense

### 1. Identity & Access (Authentication & Authorization)
- **JWT-Based Sessions**: Short-lived access tokens with secure lifecycle management.
- **Role-Based Access Control (RBAC)**: Exactly five rigid roles enforced at the API routing layer.
- **Attribute-Based Access Control (ABAC)**: Contextual permissions (e.g., must be assigned to the specific case to edit evidence).

### 2. Multi-Party Authorization (MPA)
- Prevents unilateral destructive actions (e.g. `DESTRUCT_EVIDENCE`).
- Requires a cryptographic quorum (e.g. 2+ authorized roles like ADMIN + LEGAL) to approve an operation before the system will execute it.

### 3. End-to-End Evidence Encryption (E3EE)
- Client-side Web Crypto API implementation.
- AES-256-GCM symmetric encryption for the evidence file payload.
- RSA-OAEP for key wrapping. Key envelopes are distributed only to authorized personnel via the backend API.
- **Zero-Knowledge Server**: The backend never sees the plaintext evidence or the raw symmetric key.

### 4. Cryptographic Integrity Ledger
- Every evidence piece generates a SHA-256 hash client-side.
- The hash is anchored to a cryptographic ledger block sequence.
- Independent Verification allows any user (or public node, via QR code) to recalculate the hash and verify it against the anchored block.

### 5. Immutable Audit Trail
- Chain of Custody events and critical system actions are logged using tamper-evident chaining.
- An attacker with raw database access cannot alter the history without breaking the cryptographic hash chain.
