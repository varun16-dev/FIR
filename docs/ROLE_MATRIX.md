# Evidence Vault - Role Matrix

This document defines the strictly enforced five-role architecture of the Evidence Vault. No other roles exist.

| Role | Primary Responsibility | Key Permissions |
|---|---|---|
| **Administrator (ADMIN)** | System setup, configuration, and recovery. | Create users, configure system settings, approve high-level MPA requests, emergency key escrow. |
| **Investigating Officer (IO)** | Case creation and evidence ingestion. | Create cases, upload E3EE evidence, grant key envelopes to forensics, update case metadata. |
| **Forensic Specialist (FORENSICS)** | Analysis of digital evidence. | Receive key envelopes, decrypt and analyze evidence, submit analysis reports and updated AI metadata. |
| **Legal Prosecutor (PROSECUTOR)** | Trial preparation and court presentation. | View verified evidence passports, request legal holds, update court disposition metadata, approve destruction MPA. |
| **Compliance Auditor (AUDITOR)** | Oversight and integrity monitoring. | Read-only access to immutable audit logs, view chain of custody, verify cryptographic ledger integrity, inspect tamper alerts. |

## Explicit Anti-Patterns
To maintain strict compliance and security, the system explicitly **rejects** the following legacy/ambiguous roles:
- `CUSTODIAN`
- `EVIDENCE_MANAGER`
- `LAB_ANALYST`
- `COURT_OFFICIAL`

All functionality is cleanly mapped into the exact five roles listed above.
