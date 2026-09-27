# Frontend Integration Plan

## 1. Existing Pages & Routing
The frontend is a React SPA using `react-router-dom`. It is structured as follows:
- **Authentication**: `LoginPage`
- **Dashboards**: `DashboardPage` (role-switched views)
- **Entities**: `CasesPage`, `CaseDetailPage`, `EvidenceVaultPage`, `EvidenceDetailPage`, `EvidencePassportPage`
- **Workflows**: `CourtDashboardPage` (Legal Officer)
- **Oversight**: `BlockchainPage` (to be renamed/refactored), `AuditLogsPage`, `LoginActivityPage`
- **System**: `UsersPage`, `ReportsPage`, `CAPDemoPage`
- **Public**: `PublicVerifyPage` (No auth required)

## 2. Reusable Components
- `RoleGuard`: Currently supports role-based conditional rendering.
- `RoleSwitcher`: Useful for demo purposes.
- UI library components: Tailored HTML/Tailwind classes, Lucide React icons.
- Role-specific dashboard components: `AdminDashboard`, `IODashboard`, `ForensicDashboard`, `ProsecutorDashboard`, `AuditorDashboard`.

## 3. Missing Pages & Components
- **MPA Approval Workflow UI**: Needs a dedicated dashboard tab or component in `EvidenceDetailPage` to show pending approvals, quorum status, and authorization actions.
- **E3EE Components**: Need specialized components for client-side encryption/decryption on the client (AES-GCM key generation, encrypting Blob, attaching metadata).
- **Security Architecture Page**: A new page to visually explain the layered architecture.

## 4. Missing API Integrations
The `src/services/api.ts` file is missing client wrappers for:
- **E3EE Endpoints**:
  - `POST /api/e3ee/keypair`
  - `POST /api/e3ee/metadata`
  - `POST /api/e3ee/envelope/grant`
  - `GET /api/e3ee/envelope/{evidence_id}`
- **MPA Approval Endpoints**:
  - `POST /api/approvals/`
  - `POST /api/approvals/{request_id}/approve`

## 5. Required Frontend/Backend Changes
- Remove `CustodianDashboard.tsx` and any reference to `CUSTODIAN` to strictly enforce the 5-role constraint.
- Refactor `BlockchainPage` to "Cryptographic Integrity Ledger" and display proper terminology.
- Implement E3EE logic:
  - Generate AES-256 key on the frontend during upload.
  - Encrypt evidence bytes using AES-GCM (Web Crypto API).
  - Encrypt the AES key for the server (or authorized roles) using their public keys.
  - Call E3EE APIs to store the metadata alongside the encrypted evidence.
- Refactor the QR Verification page (`PublicVerifyPage`) to explicitly ensure safe metadata display (no raw evidence or keys).
- Enhance the Evidence Detail page to cleanly separate Overview, Integrity, CoC, Access History, Approvals, Forensic Analysis, Court Info, Encryption.

## 6. Role Visibility Matrix
- **ADMIN**: Users, Audit Logs, Login History, Dashboard (System Infra focus)
- **INVESTIGATOR**: Cases, Evidence Vault, Case Reports, Blockchain (Integrity Ledger), Dashboard (Upload & Transfer)
- **FORENSIC_OFFICER**: Cases, Evidence Vault, Case Reports, Blockchain, Dashboard (Analysis)
- **LEGAL_OFFICER**: Court Dashboard, Cases, Evidence Vault, Case Reports, Blockchain, Dashboard (Trial Dossier)
- **AUDITOR**: Audit Logs, Login History, Cases, Evidence Vault, Blockchain, Dashboard (Oversight)

## 7. Implementation Order
1. **API Client & E3EE Service Layer**: Add missing E3EE and MPA endpoints to `api.ts`. Create a `crypto.ts` utility for Web Crypto API operations.
2. **Evidence Upload (E3EE)**: Modify the upload flow to do client-side encryption, key envelope generation, and E3EE API interactions.
3. **Evidence Download (E3EE)**: Modify the download flow to fetch the key envelope, decrypt it, and decrypt the evidence ciphertext client-side.
4. **MPA Approval Workflow UI**: Create the approval tracker and interaction component. Integrate into Evidence detail and Dashboards.
5. **Dashboard Refinement**: Clean up the 5 role dashboards (and remove Custodian).
6. **Evidence Detail & Court Pages**: Implement the tabbed interface and watermarked viewing.
7. **Integrity & CoC Visualization**: Refactor "Blockchain" to "Cryptographic Integrity Ledger" and polish the visual CoC timeline.
8. **QR Verification**: Polish the public `/verify` page.
9. **Final Security Page**: Implement the visual architecture page.
10. **Testing & Build**: Run existing backend tests, lint frontend, build for production.
