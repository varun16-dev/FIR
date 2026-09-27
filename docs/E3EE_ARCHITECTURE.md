# End-to-End Evidence Encryption (E3EE) Architecture

## Security Objective
Prevent server-side and database-level compromises from exposing raw evidence files. The Evidence Vault server must function as a "Zero-Knowledge" repository for the actual evidence payloads.

## Key Management & Cryptography
We utilize the browser's native `Web Crypto API` to ensure encryption happens before the file ever hits the network.

- **Symmetric Payload Encryption**: `AES-256-GCM`
- **Asymmetric Key Wrapping**: `RSA-OAEP` (2048-bit)
- **Integrity Hashing**: `SHA-256`

## Upload Flow (Investigating Officer)
1. **Client Setup**: The IO's browser generates a random 256-bit AES key.
2. **Encryption**: The evidence file is encrypted using `AES-GCM` in the browser.
3. **Hashing**: The `SHA-256` hash of the *ciphertext* is generated.
4. **Upload**: The ciphertext blob is uploaded to the `/api/evidence/upload` endpoint.
5. **Metadata Registration**: The client posts the `AES-GCM` IV (nonce), auth tag, and ciphertext hash to `/api/e3ee/metadata`.
6. **Key Wrapping**: The client fetches target recipients' RSA Public Keys (e.g., Forensics), wraps the AES key using those public keys, and posts the resulting envelopes to `/api/e3ee/envelope/grant`.

## Download Flow (Forensic Specialist / Authorized Role)
1. **Fetch Envelope**: The client requests their specific RSA-wrapped key envelope from `/api/e3ee/envelope/{evidence_id}`.
2. **Fetch Ciphertext**: The encrypted blob is downloaded.
3. **Fetch Metadata**: The IV and Auth Tag are retrieved.
4. **Key Unwrapping**: The client unwraps the AES key using their private RSA key.
5. **Decryption**: The `AES-GCM` decryption algorithm processes the blob in-browser, verifying the auth tag simultaneously.
6. **Save to Disk**: The plaintext file is reconstructed and prompted for user download.

## Edge Cases & Limitations
- **Key Loss**: If a user loses their RSA Private Key, they cannot decrypt any previously granted evidence unless another authorized user with a working envelope grants them a new one.
- **Admin Escrow**: A specialized escrow public key may optionally be included in the wrapping phase for emergency access, depending on organizational policy.
