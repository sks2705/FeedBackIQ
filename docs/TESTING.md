# FeedbackIQ Testing Matrix & Documentation

This document describes the automated test suite, coverage matrix, and execution steps for FeedbackIQ Phase 6.

## 1. Testing Matrix

| Test Suite | File Location | Purpose | Key Assertions |
|---|---|---|---|
| **Validation Schemas** | `web/tests/unit.test.ts` | Validates Zod inputs for feedback, login, and analytics query params | Rejects short messages (< 10 chars), invalid email formats, and out-of-bound page numbers. |
| **CSV Formula Protection** | `web/tests/unit.test.ts` | Prevents CSV injection / formula execution in spreadsheet software | Prepends single quote `'` to cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r`. |
| **Rate Limiter** | `web/tests/unit.test.ts` | In-memory sliding window rate limiter | Allows requests up to max threshold, then returns `allowed: false` with `retryAfterSeconds`. |
| **Auth Helpers** | `web/tests/auth.test.ts` | Tests bcrypt password hashing and JWT `jose` signing/verification | Verifies password hash matching and confirms tampered JWT tokens return `null`. |
| **AI Failure Handling** | `web/tests/aiFailure.test.ts` | Verifies graceful degradation when FastAPI AI service times out/fails | Ensures feedback is saved in PostgreSQL with `analysisStatus: FAILED` and `analysisError` message populated. |
| **Route Authorization** | `web/tests/routes.test.ts` | Route handler unit tests for authentication & role checks | Verifies unauthenticated GET returns `401`, VIEWER PATCH status returns `403`, missing items return `404`, invalid input returns `400`. |
| **End-to-End Smoke Test** | `web/scripts/smoke.ps1` & `smoke.sh` | Integrated live endpoint testing against running web server | Exercises login, public create, protected list, role restriction, status update, analytics summary, and CSV export. |

---

## 2. Running Automated Tests

### A. Vitest Unit & Integration Tests
Run all unit and route handler tests using Vitest:

```bash
cd feedbackiq/web
npm run test
```

*Expected Result:*
```text
 ✓ tests/aiFailure.test.ts (1 test)
 ✓ tests/unit.test.ts (5 tests)
 ✓ tests/routes.test.ts (4 tests)
 ✓ tests/auth.test.ts (3 tests)

 Test Files  4 passed (4)
      Tests  13 passed (13)
```

---

### B. PowerShell E2E Smoke Script (Windows)
Ensure PostgreSQL 16 (`localhost:5432`) and Web App (`npm run dev` at `http://localhost:3000`) are running, then execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke.ps1
```

*Expected Result:*
```text
==========================================
 FeedbackIQ Smoke Test Suite (PowerShell) 
==========================================
[1/8] Admin Login... PASS
[2/8] Public read access blocked (401)... PASS
[3/8] Create Feedback (Public)... PASS (ID: <uuid>)
[4/8] List Feedback as Admin... PASS
[5/8] Viewer Forbidden Action (403)... PASS
[6/8] Admin Update Status (PATCH)... PASS
[7/8] Analytics Summary... PASS
[8/8] Export CSV... PASS
==========================================
 ALL SMOKE TESTS PASSED SUCCESSFULLY! 
==========================================
```

---

### C. Bash E2E Smoke Script (macOS / Linux / Git Bash)

```bash
chmod +x ./scripts/smoke.sh
./scripts/smoke.sh
```

---

## 3. Verifying Secret Zero-Trust in Git

Run the following commands to confirm no production or environment secrets exist in the git history or source tree:

```bash
git grep -i "super-secret"
git grep -i "AdminPassword123!"
```

*Expected Result:* Zero matches found in committed code files (excluding `.env.example`).
