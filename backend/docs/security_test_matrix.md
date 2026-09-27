# Security Test Matrix

This document defines the 34 End-to-End security tests implemented to verify the Evidence Vault hardened architecture.

## A. Authentication / authorization
1. **Admin raw evidence access**: 403 Forbidden. Administrator role is blocked from raw evidence content via ABAC.
2. **Admin protected download**: 403 Forbidden. Administrator cannot download evidence files.
3. **IO unrelated case**: Denied. Investigating Officers can only access cases assigned to them.
4. **Forensic unauthorized court action**: 403 Forbidden. Forensic Specialist role lacks court export permissions.
5. **Prosecutor authorized court action**: Success. Legal Prosecutor role has correct permissions.
6. **Auditor unauthorized evidence access**: Denied unless unsealed via warrant.

## B. Multi-Party Authorization (MPA)
7. **Self-approval**: Rejected. Requester cannot approve their own MPA request.
8. **Wrong-role approval**: Rejected. Approver must have an allowed role for the specific operation.
9. **Insufficient quorum**: Execution blocked. Operation cannot proceed until required approval count is met.
10. **Correct quorum**: Execution allowed. When quorum is met, state changes to APPROVED.
11. **Approval replay**: Rejected. Once an MPA request is executed, it cannot be reused.
12. **Expired approval**: Rejected. MPA requests expire after the designated timeframe.
13. **Approval for Evidence A reused on Evidence B**: Rejected. MPA payload cryptographically binds to the evidence ID.

## C. State Machine
14. **Invalid state transition**: Rejected. Enforced by `state_machine.py`.
15. **DESTROYED → active transition**: Rejected. Once destroyed, evidence cannot re-enter active status.
16. **COURT_HOLD → destruction without required authorization**: Rejected. Requires multi-party authorization to leave court hold for destruction.

## D. Evidence Integrity
17. **Modified evidence bytes**: Detected. Recalculated SHA-256 will not match stored hash.
18. **Modified stored hash**: Detected. Will break the custody event chain and Merkle inclusion proof.
19. **Modified custody event**: Detected. Breaks the cryptographic hash-chain linking events.

## E. Audit Integrity
20. **Modified audit event**: Detected. `current_hash` and `previous_hash` chain will break, causing validation failure.
21. **Reordered event**: Detected. Sequential hash chaining prevents reordering.
22. **Deleted event**: Detected. Deletion breaks the cryptographic chain between adjacent events.

## F. Corrections
23. **Correction creates new event**: Success. Overwriting original records is blocked; append-only Correction Events are used.
24. **Original event remains unchanged**: Success. The original historical record is preserved alongside the correction.

## G. Cryptographic MACs
25. **Invalid signature**: Rejected. The `SigningService` will reject malformed or tampered signatures on MPA or custody payloads.

## H. Merkle Verification
26. **Modified Merkle proof/root**: Detected. Root mismatch during `verify-full-integrity`.

## I. External Anchor
27. **Local Merkle root differs from external anchor**: Mismatch. Verification queries the external anchor and detects local DB tampering.
28. **Invalid anchor signature**: Verification failure. The anchor payload signature must be valid.

## J. End-to-End Workflow
29. **Unauthorized freeze**: Rejected. Requires Legal Prosecutor and Auditor approval.
30. **Unauthorized unseal**: Rejected. Requires valid judicial warrant workflow.
31. **Unauthorized destruction**: Rejected. Requires 3-party quorum.
32. **Single-user destruction**: Rejected. No single role can execute destruction.
33. **Audit modification**: Detected. Raw SQL modifications to the database are flagged by `verify-full-integrity`.
34. **Full E2E**: Success. Complete lifecycle from Case Creation → Evidence Upload → Hash generation → Transfer → Analysis → Integrity check.
