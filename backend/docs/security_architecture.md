# Evidence Vault Security Architecture

## Overview
This document outlines the security architecture for the Evidence Vault, designed to ensure that no single compromised account or local database modification can silently tamper with evidence or history. 

## Implemented Now

### Threat Model
The system protects against:
- **Insider Abuse:** A single malicious actor (even an Administrator) cannot view raw evidence, manipulate records, or destroy evidence without detection.
- **Database Compromise:** Direct `sqlite3` modifications are detectable via cryptographic Merkle checkpoints anchored externally.
- **API Abuse:** Attempting to bypass the UI to call destructive endpoints is blocked via strict backend RBAC/ABAC and MPA.

### RBAC (Role-Based Access Control)
Exactly five roles exist, mapping to enterprise privileges:
1. **Administrator:** System configuration only. Zero access to evidence, case narratives, or suspect PII.
2. **Investigating Officer (IO):** Can upload and transfer evidence for their assigned cases.
3. **Forensic Specialist:** Can analyze and submit forensic reports.
4. **Legal Prosecutor:** Can view watermarked evidence and prepare court exhibits.
5. **Compliance Auditor:** Can verify cryptographic integrity and approve destructive/unseal actions.

### ABAC (Attribute-Based Access Control)
Evidence access is restricted based on assignment. For example, an Investigating Officer can only access evidence for cases where they are the assigned investigator.

### Multi-Party Authorization (MPA)
High-risk operations (e.g., Destruction, Freeze) require a multi-signature quorum. 
- A policy matrix in `app/services/mpa.py` defines the required quorum and eligible roles per operation.
- Self-approval is cryptographically rejected.
- MPA payloads are signed via `SigningService`.

### State Machine
Evidence lifecycle transitions (e.g., `IN_CUSTODY` → `FORENSIC_ANALYSIS`) are strictly enforced via `app/services/state_machine.py`. Invalid state jumps (e.g., `DESTROYED` → `IN_CUSTODY`) are blocked.

### Evidence Immutability & Correction Events
Original evidence bytes and SHA-256 hashes cannot be overwritten via standard APIs. If metadata must be corrected, an append-only `CorrectionEvent` is appended to the audit trail, preserving the historical record.

### Cryptographic Protections
- **SHA-256 Hashing:** Raw files are hashed upon intake.
- **AES-256 Encryption:** Files are stored encrypted at rest.
- **Audit Hash Chain:** `CustodyEvent` and `AuditLog` entries form a cryptographically linked list.
- **Merkle Tree Checkpoints:** Every 10 audit events, a deterministic Merkle root is calculated.
- **Cryptographic MACs:** Critical events (MPA approvals, Checkpoints) are signed using `DevelopmentSigner` (simulating KMS/HSM).
- **External Anchor:** Checkpoints are pushed to `DevelopmentAnchorProvider` to simulate Write-Once-Read-Many (WORM) storage.

### Integrity Verification
The `/api/evidence/{id}/verify-full-integrity` endpoint validates:
1. File existence and decryption
2. File SHA-256 match
3. Custody & Audit chain hashes
4. Merkle proof and External Anchor match
5. Cryptographic MACs

### QR Verification
QR codes are generated using the environment `APP_BASE_URL` (avoiding hardcoded localhost). They expose public verification metadata without leaking raw PII.

## Production Hardening / Future
- **Distributed Blockchain:** The current ledger is an internal integrity ledger. Production should use a permissioned ledger like Hyperledger Fabric.
- **WORM Storage:** Replace `DevelopmentAnchorProvider` with an actual AWS S3 Object Lock or external timestamp authority.
- **KMS / HSM:** Replace `DevelopmentSigner` with AWS KMS or physical HSM for key protection.
- **Threshold Cryptography:** Enhance MPA signatures with Shamir's Secret Sharing.
