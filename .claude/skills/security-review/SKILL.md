---
name: "security-review"
description: "Security review for AI Homework Grader — checks input validation, SQL injection, auth/ownership, secrets management, and OWASP Top 10 awareness for the MVP threat model."
---

# Security Review

You have been asked to review code for security vulnerabilities. The AI Homework Grader
MVP runs on a local network for family use — the threat model is internal/trusted network,
but the review prepares for future external exposure and catches common coding mistakes.

**Read every changed file. Apply each check below. Report every finding with severity
and a concrete fix.**

---

## 1. Threat Model (MVP Context)

| Aspect              | MVP Reality                                      | Review Posture                       |
|---------------------|--------------------------------------------------|--------------------------------------|
| Network             | Local IP + port, no public exposure               | Review as if internet-facing (future-proof) |
| Authentication      | Phone number, unverified, trusted input           | Flag auth bypass risks; note what breaks without real auth |
| Data sensitivity    | Children's names, exam photos, phone numbers      | Treat as PII — flag leaks, logs, exposures |
| External dependency | GLM-4V API only                                   | Review API key handling, token logging |
| Deployment          | Docker Compose, local filesystem                  | Flag hardcoded credentials, insecure defaults |

---

## 2. Input Validation

### 2.1 File Upload Validation

Check every file upload endpoint against these criteria:

- [ ] **File type whitelist**: Only `image/jpeg` and `image/png` MIME types accepted. Verify via magic bytes, not just file extension or Content-Type header.
- [ ] **File size limit**: Hard cap at 20MB. Enforced server-side (not just client-side). Use FastAPI's `UploadFile` with size validation.
- [ ] **File name sanitization**: Uploaded file names are NOT used directly for storage paths. Use generated names (`{submission_id}.jpg`).
- [ ] **Directory traversal prevention**: All file paths constructed with `Path` objects under the configured storage root. No user-controlled path segments.
- [ ] **Image validation**: Attempt to open with Pillow and verify it's a valid image before storing. Catch `PIL.UnidentifiedImageError`.

```python
# Example of what to verify exists:
import magic  # python-magic for MIME detection
from pathlib import Path

MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png"}

# Check file size
contents = await file.read()
if len(contents) > MAX_UPLOAD_SIZE:
    raise HTTPException(400, detail="File too large. Maximum 20MB.")

# Check MIME type via magic bytes
detected_type = magic.from_buffer(contents[:2048], mime=True)
if detected_type not in ALLOWED_MIME_TYPES:
    raise HTTPException(400, detail="Only JPEG and PNG images are accepted.")

# Validate image integrity
from PIL import Image
from io import BytesIO
try:
    img = Image.open(BytesIO(contents))
    img.verify()
except Exception:
    raise HTTPException(400, detail="Invalid or corrupted image file.")
```

### 2.2 Query Parameter Validation

- [ ] **phone**: Validated against `^\d{11}$` regex. Reject non-numeric, too short, too long.
- [ ] **subject**: Whitelist against enum `["english", "math"]`. Reject any other value.
- [ ] **question_type**: Whitelist against known enum. Reject any other value.
- [ ] **child_id / submission_id / question_id**: Integer type enforced. Negative numbers, zero, or excessively large values rejected.
- [ ] **limit / offset**: Integer, within declared ranges (limit: 1-100, offset: ≥0).
- [ ] **dates (from_date, to_date)**: Valid ISO 8601 date format. `from_date ≤ to_date` enforced.
- [ ] **All parameters**: Strip whitespace. Reject null bytes (`\x00`) as injection attempts.

### 2.3 Request Body Validation

- [ ] **name (child name)**: Length 1-50, trimmed. No HTML/script tags (strip or reject).
- [ ] **count (error sheet)**: Integer 1-50. Default enforced when missing.
- [ ] **is_correct (manual fix)**: Boolean only — reject strings, numbers, or objects.

---

## 3. SQL Injection Prevention

### 3.1 Parameterized Queries

- [ ] **All database queries use SQLAlchemy ORM with parameter binding**. Zero instances of raw SQL string formatting with user input.
- [ ] Flag any use of `text()` with f-strings, `.format()`, or `%` interpolation on user-supplied values.
- [ ] Flag any use of `db.execute()` with dynamically constructed SQL strings.
- [ ] Dynamic ORDER BY or GROUP BY fields (if any): must be whitelisted against a fixed set of column names, never passed directly from query parameters.

```python
# ❌ VULNERABLE — SQL injection
db.execute(text(f"SELECT * FROM children WHERE name = '{name}'"))

# ❌ VULNERABLE — still injection if 'name' is user input
db.execute(text("SELECT * FROM children WHERE name = '" + name + "'"))

# ✅ SAFE — parameterized
await db.execute(select(Child).where(Child.name == name))

# ✅ SAFE — parameterized with text()
await db.execute(text("SELECT * FROM children WHERE name = :name"), {"name": name})
```

### 3.2 ORM Coverage

- [ ] Every data access goes through SQLAlchemy ORM models. No raw SQL.
- [ ] If a raw SQL query is genuinely needed (performance), it must use bound parameters and be documented with a comment explaining why ORM couldn't be used.

---

## 4. Authentication & Authorization

### 4.1 Phone-Based Identity (MVP Temporary)

- [ ] Every endpoint except `/api/health` requires `phone` parameter or `X-Parent-Phone` header.
- [ ] `phone` is validated (11-digit pattern) before database lookup.
- [ ] `phone` is NOT logged in application logs, error messages, or API responses.
- [ ] No fallback to a default or empty phone — missing phone → 422 error immediately.

### 4.2 Data Ownership Verification

This is the **most critical check** for this project. Per architecture §8:

- [ ] **Every query that returns user data filters by `parent_id`** (resolved from `phone` once per request via `Depends()`).
- [ ] **Every endpoint that accepts `child_id`, `submission_id`, or `question_id`** verifies the resource belongs to the current parent by tracing the FK chain up to Parent.
- [ ] **Ownership check failures return 404**, not 403 (per architecture §8: avoid resource-existence probing).
- [ ] **`parent_id` is NEVER accepted as a direct request parameter** — always resolved from `phone` server-side.

```python
# Pattern to verify everywhere:
# 1. Resolve parent from phone (once per request)
# 2. For child_id in path/body: verify child.parent_id == parent.id → else 404
# 3. For submission_id: verify submission.child.parent_id == parent.id → else 404
# 4. For question_id: verify question.submission.child.parent_id == parent.id → else 404
```

### 4.3 Future Auth Considerations

Flag these as MEDIUM severity (not blocking MVP, but must be fixed before going public):
- [ ] No session management. Phone sent in plaintext as query parameter on every request.
- [ ] No rate limiting on any endpoint. Brute-force possible on phone lookup.
- [ ] No CSRF protection. State-changing requests (POST/PUT/PATCH/DELETE) have no CSRF tokens.
- [ ] Phone numbers visible in browser history and server access logs (query parameter).

---

## 5. Secrets Management

### 5.1 Hardcoded Secrets

- [ ] **Zero hardcoded secrets** in code. Scan for:
  - API keys, tokens, passwords as string literals
  - Database connection strings with credentials
  - JWT secrets, encryption keys, signing keys
  - Any string matching common secret patterns: `sk-*`, `api_key=`, `password=`, `Bearer *`
- [ ] All secrets sourced from environment variables.
- [ ] `.env` files are in `.gitignore` (verified).
- [ ] Docker Compose uses environment variables for secrets, not hardcoded values in `docker-compose.yml`.

### 5.2 Secret Exposure Risks

- [ ] Secrets are NOT logged. Flag any `print()`, `logging.info()`, or `loguru` calls that might leak env vars or API responses containing keys.
- [ ] GLM-4V API key is NOT included in error messages returned to the client.
- [ ] Database connection errors do NOT include the connection string or password.

---

## 6. OWASP Top 10 Awareness

### A01: Broken Access Control
- [ ] Ownership checks on every resource access (see §4.2 above).
- [ ] No direct object references without ownership verification.

### A02: Cryptographic Failures
- [ ] No custom cryptography. No hardcoded keys.
- [ ] MVP: No sensitive data at rest that requires encryption (local deployment). Flag if PII stored unencrypted in DB for future concern.

### A03: Injection
- [ ] SQL injection: parameterized queries everywhere (see §3).
- [ ] No OS command injection: flag any `os.system()`, `subprocess.call()` with user input.
- [ ] No LDAP/XML/XPath injection surface (not applicable, but verify).

### A04: Insecure Design
- [ ] Trust boundary is documented: frontend is untrusted, backend validates everything.
- [ ] No client-side-only validation for security-critical checks (file type, size, ownership).

### A05: Security Misconfiguration
- [ ] Docker containers don't run as root.
- [ ] CORS: In MVP, `allow_origins=["*"]` is acceptable for local dev. Flag for production hardening.
- [ ] Debug mode: verify `debug=False` in production, no tracebacks in responses.
- [ ] MySQL: no default/weak passwords. Flag if `MYSQL_ROOT_PASSWORD=homework_dev` is hardcoded (should be env var).

### A06: Vulnerable Components
- [ ] `requirements.txt` and `package.json` dependencies pinned to specific versions.
- [ ] No known vulnerabilities in pinned versions (note: requires `pip-audit` or `npm audit` — flag if not run recently).

### A07: Auth Failures
- [ ] MVP phone auth is weak by design. Flag all limitations for pre-launch hardening.
- [ ] No password storage (no passwords in MVP).

### A08: Software & Data Integrity
- [ ] No deserialization of untrusted data (no `pickle.load()` on user input).
- [ ] GLM-4V API response is parsed with `json.loads()` — handle malformed JSON gracefully.

### A09: Logging & Monitoring
- [ ] Token usage logged per API call (for cost monitoring, not security).
- [ ] Failed operations logged (for debugging).
- [ ] No PII in logs (phone numbers, child names, image contents).

### A10: SSRF
- [ ] GLM-4V API URL is configured via environment variable, not user input.
- [ ] No user-controlled URLs that the backend will fetch.
- [ ] If image URL fetching is added later: must validate URL is to allowed origins.

---

## 7. Security Review Report

After completing all checks, produce this report:

```
## Security Review: [Branch / Commit / Scope]

### Threat Model: MVP Local Deployment

### Findings

| # | Severity | Category | File:Line | Finding | Fix |
|---|----------|----------|-----------|---------|-----|
| 1 | HIGH/MED/LOW | ... | file.ts:42 | ... | ... |

### Severity Definitions
- **CRITICAL**: Data leak, remote code execution, auth bypass with public exposure. Ship blocker.
- **HIGH**: SQL injection, broken ownership check, hardcoded secret, missing input validation. Fix before merge.
- **MEDIUM**: Information disclosure, missing rate limiting, weak auth for future public use. Fix before going public.
- **LOW**: Best practice deviation, hardening recommendation. Document and schedule.

### Summary
- CRITICAL: [count]
- HIGH: [count]
- MEDIUM: [count]
- LOW: [count]

### OWASP Top 10 Coverage
- A01 Broken Access Control: [PASS / FINDINGS]
- A02 Cryptographic Failures: [PASS / N/A / FINDINGS]
- A03 Injection: [PASS / FINDINGS]
- A04 Insecure Design: [PASS / FINDINGS]
- A05 Security Misconfiguration: [PASS / FINDINGS]
- A06 Vulnerable Components: [PASS / FINDINGS]
- A07 Auth Failures: [NOTED / FINDINGS]
- A08 Data Integrity: [PASS / FINDINGS]
- A09 Logging: [PASS / FINDINGS]
- A10 SSRF: [PASS / N/A / FINDINGS]

### Verdict
[PASS — no HIGH+ findings] / [NEEDS FIX — N HIGH findings, M MEDIUM]
```
