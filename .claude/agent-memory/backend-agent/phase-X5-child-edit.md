---
name: phase-X5-child-edit
description: Backend X5 status — Child grade/note/avatar fields + POST/PUT children grade/note (child edit)
metadata:
  type: project
  phase: X5 — Child Edit (儿童编辑)
  status: complete
  last_updated: 2026-08-22
---

# Phase X5 — Child Edit (儿童编辑)

**Status:** ✅ Complete (2026-08-22). No contract change — `contracts/openapi.yaml` v0.2.0 already carried `Child.grade`/`note`/`avatar` and `POST/PUT /api/children` `grade`/`note` (change 5). `grade` enum (一年级~六年级) + `default: 五年级`; `note` maxLength 200; `avatar` reserved.

## What was built

- `app/models/child.py` — `Child` + `grade VARCHAR(20) NOT NULL DEFAULT '五年级'` (Python `default` + `server_default`), `note VARCHAR(200) NULL`, `avatar VARCHAR(500) NULL` (reserved).
- `app/schemas/children.py` — `Grade = Literal["一年级", …, "六年级"]`; `ChildResponse` + `grade`/`note`/`avatar`; `CreateChildRequest`/`UpdateChildRequest` both `name` (required) + `grade` (default 五年级) + `note` (optional, maxLength 200). `avatar` never accepted in request bodies.
- `app/routers/children.py` — POST/PUT persist `grade`/`note`; list/create/update responses include `grade`/`note`/`avatar` (avatar always null).
- `migrations/versions/d6e7f8a9b0c1_add_grade_note_avatar_to_children.py` — forward-only `op.add_column` ×3 (head was `c3d4e5f6a7b8`).

## Key decisions

- **PUT = full replace of grade/note** (contract-changes-v2 变更 5: "PUT 请求体同 POST", so `grade` also defaults 五年级 when omitted). The edit form always sends name+grade+note, so default-on-omit is inert in practice. Documented as-is; if a "keep existing when omitted" partial-update semantic is wanted, that's a contract decision, not backend.
- **Delete untouched** — per instruction, no soft-delete, no FK `ondelete` change. `submissions`/`error_questions` keep their no-`ondelete` FK (history preserved, no cascade). If deleting a child that has submissions raises a DB FK error, that's a pre-existing behaviour outside X5 — flag to human if it surfaces.
- **`grade` is an API-layer enum, DB is plain VARCHAR(20)** (contract-changes-v2 变更 5 已批注「契约层字符串枚举，DB 层 VARCHAR」). No DB CHECK constraint.

## Tests

`tests/test_children.py` extended (5 new + 1 assertion on list defaults): create with grade/note (avatar null), grade defaults to 五年级, invalid grade → 422, note >200 → 422, update grade/note; list asserts default grade 五年级 + null note/avatar. Cross-parent isolation already covered (`test_ownership_isolation`, `test_parent_b_list_is_independent`). 71 backend tests green; `ruff check` + `ruff format --check` clean.

## Security review

`/security-review` run — **PASS, no HIGH+**. `grade` Literal enum + `note` max_length 200 give strict input validation; all queries parameterized ORM; ownership via `get_current_parent_id` → 404 on mismatch; `parent_id` never a request param. `note` returned as plain JSON string — no server-side HTML rendering; frontend React/Taro auto-escape (verified no `dangerouslySetInnerHTML` for note). Cross-agent note: render `note` as text only.

## Cross-Agent Requests

X5 frontend (Web `ChildrenPage` grade/note edit) and mini-program (`/pages/children` 管理页) are frontend-agent / miniapp-agent territory (AC-X5.3~X5.5). They consume:

- `Child` response now carries `grade` (enum 一年级~六年级), `note` (nullable ≤200), `avatar` (always null in v2).
- `POST/PUT /api/children` accept optional `grade` (default 五年级) + `note`; `name` still required.
- `avatar` reserved — do **not** build upload/edit/display UI for it this phase.

## Contract deviations

None. Implemented against `contracts/openapi.yaml` v0.2.0 change 5 as-is.
