# Security Specification: Nahj Al-Noor Cloud Search & Fatwa

## Data Invariants
1. `search_indexes` can only be modified by the authorized administrator (`hsynalmhnh224@gmail.com`).
2. `fatwa_questions` can be created by any authenticated user (including anonymous), but they can only read and list their own questions.
3. Once a `SearchIndex` is created, its `bookId` and `pageNumber` must remain immutable.
4. Terminal state for `FatwaQuestion` is `answered`. Once answered, only an admin should be able to modify it (though currently we don't have a UI for admins to update in the app, but rules should protect it).

## The Dirty Dozen Payloads (Rejection Targets)

### 1. Identity Spoofing (Search Index)
Payload: `{ "bookId": "spoof", "content": "malicious", "ownerId": "attacker-uid" }`
Action: `create` by non-admin.

### 2. ID Poisoning (Search Index)
Payload: document ID `a`.repeat(2000)
Action: `create`.

### 3. State Shortcutting (Fatwa)
Payload: `{ "userId": "user123", "question": "...", "status": "answered" }`
Action: `create` by a normal user.

### 4. PII Leak (Fatwa List)
Action: `list` on `fatwa_questions` without a `where` clause for `userId`.

### 5. Shadow Update (Search Index)
Payload: `{ "bookId": "real", "isVerified": true, "ghost": "data" }`
Action: `update`.

### 6. Email Spoofing (Admin Bypass)
Auth: `{ email: "hsynalmhnh224@gmail.com", email_verified: false }`
Action: `write` to `search_indexes`.

### 7. Resource Poisoning (Large Strings)
Payload: `{ "content": "A".repeat(1000000) }`
Action: `create` or `update`.

### 8. Denial of Wallet (Unchecked Get)
Action: `list` query that triggers multiple `get()` calls in rules (e.g. `allow list: if get(...).data.role == 'admin'`).

### 9. Orphaned Record (Search Index)
Payload: `{ "bookId": "non-existent-book", ... }`
Action: `create`. (Note: In this app, books are local data, so we can't easily verify existence in Firestore, but we can verify field integrity).

### 10. Immutable Field Modification
Payload: `{ "bookId": "new-id" }`
Action: `update` on an existing search index.

### 11. Unauthorized Read (Fatwa)
Action: `get` on `/fatwa_questions/other-users-question-id`.

### 12. Query Scraping
Action: `list` query on `search_indexes` where the client tries to extract the entire database without filtering.

## Test Runner (Mock)
See `firestore.rules.test.ts` for implementation details.
