# Phase 0: Payload-First Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Default-Deny Global Safety Net**: Any path not explicitly matched under `/black_box_entries/{entryId}` or `/diagnostic_audits/{auditId}` is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity & Ownership**: Every write operation requires a signed-in user with `request.auth.token.email_verified == true` and `incoming().ownerId == request.auth.uid`.
3. **Immutable Cryptographic Ledger (`BlackBoxEntry`)**: `/black_box_entries/{entryId}` is strictly append-only (`create` and `get`/`list` by owner or admin only; `update` and `delete` are forbidden so hash-chain blocks cannot be rewritten or deleted in cloud storage).
4. **Strict SHA-256 Format Enforcement**: `prevHash` and `entryHash` must be 64-character lowercase hexadecimal strings matching `^[a-f0-9]{64}$`.
5. **Terminal State Locking (`DiagnosticAudit`)**: Once a `DiagnosticAudit` reaches `status == 'RESOLVED'`, no further non-admin updates are permitted.
6. **Temporal Integrity**: `createdAt` must equal `request.time` on creation, and `updatedAt` must equal `request.time` on update.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Email Spoof**: Signed-in user with `email_verified: false` attempting `create` on `/black_box_entries/entry_01`.
2. **Cross-User Identity Spoofing**: Authenticated user `uid_attacker` creating `/black_box_entries/entry_02` with `ownerId: "uid_victim"`.
3. **Shadow Field Injection on Create**: Creating `/black_box_entries/entry_03` with an undeclared field `"isTampered": false`.
4. **Malformed SHA-256 Digest**: Creating `/black_box_entries/entry_04` with `entryHash: "not-a-valid-sha256"`.
5. **Immutable Ledger Mutation**: Attempting `update` on an existing `/black_box_entries/entry_01` document.
6. **Path ID Poisoning**: Creating `/black_box_entries/invalid$id!with*spaces` that violates `^[a-zA-Z0-9_\-]+$`.
7. **Denial-of-Wallet String Overflow**: Creating `/black_box_entries/entry_05` with a 10,000-character `summary` (> 500 max).
8. **Client-Forged Timestamp**: Creating `/diagnostic_audits/audit_01` with a past/future `createdAt` timestamp != `request.time`.
9. **Unauthorized List Scraping**: Listing `/diagnostic_audits` without constraining `resource.data.ownerId == request.auth.uid`.
10. **Shadow Update on DiagnosticAudit**: Updating `/diagnostic_audits/audit_01` by mutating `consensusScore` instead of the allowlisted `['status', 'updatedAt']`.
11. **Terminal State Re-Opening**: Attempting to update `/diagnostic_audits/audit_resolved` when `existing().status == 'RESOLVED'`.
12. **Value Poisoning on Update**: Updating `/diagnostic_audits/audit_01` with `status: "INVALID_ENUM_STATE"`.
