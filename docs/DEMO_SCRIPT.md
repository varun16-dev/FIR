# Evidence Vault - Interactive Demo Script

This script provides a step-by-step walkthrough of the Evidence Vault system, demonstrating the core security features: End-to-End Evidence Encryption (E3EE), Cryptographic Ledger Anchoring, and Multi-Party Authorization (MPA).

## Prerequisites
Ensure the backend server (`uvicorn`) and frontend server (`vite`) are running.

## Step 1: E3EE Ingestion (Investigating Officer)
1. **Login**: Use an Investigating Officer account (e.g., `io@police.gov`, password: `Password123!`).
2. **Navigate**: Go to the **Evidence Vault**.
3. **Upload**: Click **Secure Upload**. Select a sample image or text file.
4. **Observe**: The UI will visually step through local hashing and AES-256-GCM encryption before transferring data to the server.
5. **Verify Zero-Knowledge**: Notice that the backend database only stores the ciphertext and the RSA-wrapped keys, proving the server cannot view the raw file.

## Step 2: Cryptographic Ledger & Integrity (Compliance Auditor)
1. **Login**: Use a Compliance Auditor account (e.g., `auditor@police.gov`).
2. **Navigate**: Open the uploaded evidence in the **Evidence Detail Page**.
3. **Verify**: Click **Verify Integrity**. This triggers the system to recalculate the SHA-256 hash and compare it against the original hash anchored in the `Cryptographic Ledger`.
4. **Review Ledger**: Switch to the **Cryptographic Ledger** tab to see the block sequence that anchors this file's integrity.
5. **Tamper Simulation**: Click **Demo: Tamper** to intentionally corrupt the database record. Click **Verify Integrity** again to see the system catch the tampering attempt with a red alert.

## Step 3: E3EE Decryption (Forensic Specialist)
1. **Login**: Use a Forensic Specialist account (e.g., `forensics@police.gov`).
2. **Navigate**: Open the evidence that was uploaded in Step 1.
3. **Download**: Click **Download Original (E3EE)**.
4. **Observe**: The browser downloads the ciphertext, fetches the RSA-wrapped envelope, unwraps the AES key, decrypts the file locally, and saves the pristine original file to your machine.

## Step 4: Multi-Party Authorization (Legal Prosecutor)
1. **Request Destruction**: Log back in as the IO or Admin. Go to the Evidence Detail Page. Under the **Approvals** tab, click **Request Destruction**.
2. **Login**: Use a Legal Prosecutor account (e.g., `prosecutor@court.gov`).
3. **Navigate**: Open the **Approvals** tab for that evidence.
4. **Approve**: Click **Approve** on the pending `DESTRUCT_EVIDENCE` request.
5. **Observe Quorum**: Notice the signature count updates. Once the required signatures (e.g., 2) are met, the status changes to `APPROVED`.

## Conclusion
This demo proves that the Evidence Vault relies on **mathematical and cryptographic constraints**, rather than mere trust, to protect the chain of custody and data confidentiality.
