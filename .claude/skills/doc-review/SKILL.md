---
name: "doc-review"
description: "Validate specification documents against the interview summary for completeness and consistency. Run after producing or updating any spec doc (PRD, architecture, UX spec, OpenAPI contract, brand identity)."
---

# Document Review — Completeness & Consistency Check

<!-- WHY THIS SKILL EXISTS:
Spec documents are produced sequentially by AI agents. Each document references the
ones before it, but agents drift: they add features not in the interview summary,
omit constraints the user specified, or contradict earlier documents. This skill
validates that every spec document is complete, consistent with prior docs, and
faithful to the original interview. -->

You have been asked to review specification documents for completeness and consistency.
Read every document in order, trace each requirement back to the interview summary,
and flag every gap, contradiction, or omission.

---

## 1. Load All Documents

Read these files in order:

1. `docs/interview-summary.md` — the canonical source of user intent
2. `docs/prd.md` — product requirements
3. `docs/architecture.md` — technical architecture
4. `docs/ux-spec.md` — UX specification
5. `contracts/openapi.yaml` — API contract
6. `docs/brand-identity.md` — brand and design system

---

## 2. Interview Traceability

For each document, verify:

- [ ] Every constraint in the interview summary appears in at least one spec document.
- [ ] Every explicit "non-goal" from the interview is respected (no spec adds it back).
- [ ] Tech stack decisions in the interview match what's in the architecture doc.
- [ ] Budget and timeline constraints are reflected in scope decisions.

### Interview Constraint Checklist

| Constraint | Source | Found In | Status |
|---|---|---|---|
| GLM-4V API ≤ 50元/月 | Interview | Architecture N-04 | |
| MVP 一周交付 | Interview | PRD scope | |
| 图片存本地文件系统 | Interview | Architecture | |
| 无域名/HTTPS，IP+端口 | Interview | Architecture | |
| 单人开发 + AI 辅助 | Interview | (implicit in scope) | |
| 移动端优先 | Interview | UX spec | |
| 无注册/登录 | Interview | PRD, Architecture | |
| 无脱敏 | Interview | PRD, Architecture | |
| 仅英语+数学 | Interview | PRD F-02 | |
| 不做小程序/App | Interview | PRD non-goals | |
| 手机号作为家长标识 | Interview | PRD F-04, Architecture | |

---

## 3. Cross-Document Consistency

### 3.1 PRD ↔ Architecture

- [ ] Every PRD feature (F-01 through F-08) has a corresponding architecture implementation path.
- [ ] Every data model in architecture supports a PRD feature (no orphan tables).
- [ ] Every API endpoint in architecture maps to a PRD feature.
- [ ] PRD non-functional requirements (N-01 to N-06) are addressed in architecture.

### 3.2 PRD ↔ UX Spec

- [ ] Every PRD feature that has a UI surface has at least one UX screen.
- [ ] UX screen count matches PRD feature count (8 features → ≥8 screens or views).
- [ ] All user interactions described in PRD acceptance criteria appear in UX spec.
- [ ] Empty, loading, and error states in UX spec cover all PRD features.

### 3.3 Architecture ↔ OpenAPI Contract

- [ ] Every endpoint in the OpenAPI contract has a corresponding path in the architecture API design section.
- [ ] Every schema in the OpenAPI contract matches the data model in architecture (fields, types, constraints).
- [ ] Status codes in the contract match architecture decisions (202 for async, etc.).
- [ ] Request/response examples in the contract are consistent with architecture data models.

### 3.4 Brand Identity ↔ UX Spec

- [ ] Color tokens in brand identity are used consistently in UX spec component descriptions.
- [ ] Typography scale in brand identity matches UX spec heading/size usage.
- [ ] Icon choices in UX spec align with brand identity icon library and sizes.
- [ ] Tone of voice in brand identity matches UX spec button labels and messages.

---

## 4. Completeness Check

### 4.1 PRD Completeness

- [ ] Every feature has acceptance criteria written as testable statements.
- [ ] All acceptance criteria use concrete values (not "reasonable," "fast," "good").
- [ ] Non-functional requirements are measurable.
- [ ] No open questions remain (all OQs resolved and documented).

### 4.2 Architecture Completeness

- [ ] Every technology choice has a stated version or version constraint.
- [ ] Every data model has field types, constraints, and relationships.
- [ ] Every external dependency (GLM-4V API, fonts, libraries) is listed.
- [ ] Security considerations cover MVP's actual threat model.
- [ ] Architecture Decision Records (ADRs) explain non-obvious choices.

### 4.3 UX Spec Completeness

- [ ] Every screen has: URL/route, layout description, interaction behavior, and all three states (loading, empty, error).
- [ ] Navigation structure covers all screens.
- [ ] Responsive behavior is defined for mobile and desktop breakpoints.
- [ ] Accessibility minimums are stated.

### 4.4 OpenAPI Contract Completeness

- [ ] Every endpoint has: operationId, request schema (if applicable), response schemas for all status codes.
- [ ] All schemas define required fields explicitly.
- [ ] Enum values are documented.
- [ ] Error response formats are consistent.

### 4.5 Brand Identity Completeness

- [ ] All 11 sections are covered or explicitly marked as not applicable.
- [ ] Color system includes approved pairings with contrast ratios.
- [ ] Typography has a full type scale with sizes, line heights, and weights.
- [ ] Anti-generic checklist is present and has 32 items.

---

## 5. Gap Report

For each issue found, report:

```
| # | Document | Severity | Issue | Recommendation |
|---|----------|----------|-------|----------------|
| 1 | PRD      | HIGH/MED/LOW | ... | ... |
```

**Severity:**
- **HIGH** — Contradicts interview summary or makes a feature impossible to implement
- **MED** — Missing detail that would cause an agent to guess incorrectly
- **LOW** — Minor inconsistency or formatting issue

---

## 6. Consistency Score

After review, provide a score for each document pair:

| Relationship | Score (1-5) | Notes |
|---|---|---|
| PRD ↔ Interview | | |
| Architecture ↔ PRD | | |
| UX ↔ PRD | | |
| Contract ↔ Architecture | | |
| Brand ↔ UX | | |

**Scoring:**
- 5 — Perfect alignment, every detail matches
- 4 — Minor differences that don't affect implementation
- 3 — Some gaps; agents would need to make a few assumptions
- 2 — Significant drift; implementing from these docs would produce wrong behavior
- 1 — Major contradictions; docs describe different products

**Target:** All relationships ≥ 4 before proceeding to implementation.

---

## Result

Summarize:
- **Documents reviewed:** [list]
- **HIGH issues:** [count]
- **MED issues:** [count]
- **LOW issues:** [count]
- **Consistency score (average):** [1-5]
- **Verdict:** PASS (all ≥ 4) / NEEDS FIX (list what to fix)
