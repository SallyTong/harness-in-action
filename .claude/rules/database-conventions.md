---
paths:
  - "**/models/**"
  - "**/migrations/**"
  - "**/alembic/**"
---

# Database Conventions

Rules that would corrupt data or leak it across parents if forgotten. Full data model is in `docs/architecture.md` section 3.

## Non-Negotiable

### Model Definition
- SQLAlchemy 2.0 declarative: `mapped_column()` with `Mapped[]` type annotations.
- Tables: lowercase plural. PK: `id` INT AUTO_INCREMENT (no UUIDs). FKs: `<table>_id`. Timestamps: UTC.
- ENUMs must have explicit names. Required indexes per architecture section 3 must exist.

### Data Isolation (CRITICAL)
- **Every query returning user data MUST filter by `parent_id`** (resolved from `phone` once per request).
- Never accept `parent_id` as a direct request parameter.
- Cross-resource checks: trace FK chain to Parent. Fail → 404.

### Query Rules
- All queries use `AsyncSession`. No synchronous sessions in async endpoints.
- Eager-load or batch-fetch relationships. All relationship access in request path must be explicit (use `lazy="raise"` on ORM relationships; batch-fetch related data in separate queries). No lazy loading in request path.
- Every list query MUST paginate (`limit`/`offset`). Never load full tables. Exception: bounded lists (e.g., children per parent, max ~10) may omit pagination.
- No raw SQL with user input. Always parameterized ORM queries.

### Transactions
- ErrorQuestion sync MUST happen in the **same transaction** as GradedQuestion changes.
- Use `async with db.begin():` for explicit boundaries. Rollback on any exception.
- Missing `ondelete` on any ForeignKey is a bug, unless intentionally omitted (e.g., ErrorQuestion FKs preserve data when parent rows are deleted).

### Migrations (Alembic)
- **Forward-only** in MVP. No downgrade scripts.
- Auto-generate then review manually. Descriptive names. One concern per migration.
- Review: all indexes present, `ondelete` correct, ENUMs named, no destructive operations.
