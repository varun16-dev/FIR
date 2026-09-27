# Evidence Vault - Product Guide

## Overview
Evidence Vault is a secure digital evidence and case management system designed to uphold the integrity, confidentiality, and chain of custody for digital forensics and criminal investigations. It provides a tamper-evident, end-to-end encrypted repository for evidence files.

## Features
- **Strict Five-Role Architecture**: Administrator, Investigating Officer, Forensic Specialist, Legal Prosecutor, and Compliance Auditor.
- **End-to-End Evidence Encryption (E3EE)**: Evidence is encrypted client-side using AES-256-GCM.
- **Multi-Party Authorization (MPA)**: Destructive or sensitive actions require quorum approval.
- **Cryptographic Integrity Ledger**: Immutable ledger anchoring for file hashes.
- **Chain of Custody Tracking**: Complete audit history for every evidence transfer and state change.

## User Roles
1. **Administrator**: System infrastructure, role provisioning, and key management.
2. **Investigating Officer**: Case creation, evidence ingestion, and E3EE uploads.
3. **Forensic Specialist**: Evidence decryption (if authorized), analysis, and laboratory reporting.
4. **Legal Prosecutor**: Presentation in court, watermarked downloads, and legal hold applications.
5. **Compliance Auditor**: Reviewing immutable audit logs, tamper detection, and verification.

## Demo Flow
1. Login as Investigating Officer to ingest evidence using E3EE.
2. Use the Cryptographic Ledger to verify the SHA-256 hash.
3. Request an MPA authorization to destroy evidence.
4. Login as Administrator/Legal Prosecutor to approve the MPA request.
5. Verify the destruction sequence in the Audit Logs.

## Notifications Architecture
**Current Prototype Implementation:**
- Notifications are strictly database-backed (`NotificationState`) ensuring persistent read/dismissed states across backend restarts.
- Data retrieval is paginated, minimizing database load.
- Updates are currently checked via a modest polling interval (e.g. 30 seconds for unread counts) to maintain reasonable real-time responsiveness without unnecessary infrastructure complexity.

**Future Production Enhancement:**
- In the final production environment, real-time alerts (such as tamper events and critical custody transfers) will be upgraded to use WebSocket or Server-Sent Events (SSE) for instantaneous, push-based delivery, along with a dedicated scalable notifications microservice if required. Real-time WebSocket notifications are *not* implemented in this prototype phase.
