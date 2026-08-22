# Phase X5 — 儿童编辑（Web）

**Status:** ✅ Complete (2026-08-22). No contract change — `contracts/openapi.yaml` v0.2.0 already carried `Child` `grade`/`note`/`avatar`. Backend X5 (migration `d6e7f8a9b0c1`, `Child.grade`/`note`/`avatar`, `POST/PUT /api/children` accepting `grade`/`note`) was already merged.

## What was built

- `packages/api-types/index.ts` — `Child` extended to mirror the contract: `grade: string`, `note: string | null`, `avatar: string | null` (added alongside existing `id`/`name`/`submission_count`/`created_at`).
- `src/pages/ChildrenPage.tsx` — added grade + note editing (aligns with the miniapp `/pages/children` capability planned in phase-plan-v2 X5):
  - Extracted a private `ChildForm` sub-component (name input + grade `<select>` + note `<textarea>`) reused by both the add form and the inline edit form, with `submitLabel` parameterizing 「确认」 vs 「保存修改」.
  - Grade enum `一年级…六年级` (`GRADES` const), default `五年级` on new/add; `ChildFormValues.grade` always initialized to `DEFAULT_GRADE`.
  - Note `maxLength=200`, live `N/200` counter in the field label, `placeholder` 「选填，最多 200 字」. Sent as `note.trim() || null` (empty → NULL, preserving nullable semantics).
  - List card now shows a grade badge (accent-subtle pill) next to the name + the note line (muted, truncated) below 「已批改 N 次」 when present.
  - `avatar` intentionally **not** edited/displayed (reserved field per contract).
  - Edit button relabeled 「保存」→「保存修改」 (brand copywriting rule).
- `src/pages/ChildrenPage.test.tsx` — rewritten to 5 tests: list renders grade + note, empty prompt, add with grade+note (asserts `POST` body), edit grade+note (asserts `PUT` body), logout.

## Key decisions

- **grade/note always sent explicitly on edit.** Backend `UpdateChildRequest` defaults `grade` to 五年级 and `note` to null when omitted, so the frontend always sends the current values to avoid silently resetting them on rename.
- **note is pure display, no business logic** (per task constraint): it's stored/rendered only — no filtering/sorting/derive behavior touches it.
- **avatar untouched** — reserved field, no upload/edit/display in this phase (contract `description: Reserved field; not implemented in v2`).
- **Grade uses `<select>`** (6 options), matching the existing child/subject `<select>` pattern in `ErrorGeneratePage` rather than a segmented control — six grades don't fit a 375px segmented row.

## Tests / infra

- `npx tsc --noEmit` clean; 34 vitest green; `npm run build` succeeds (KaTeX chunk size warning pre-existing from X3/X4).

## Cross-agent / miniapp note

- **Miniapp X5 (儿童编辑) is still outstanding.** `apps/miniapp` has no `/pages/children` management page yet — the miniapp agent still needs to build list/add/edit/delete with grade enum + note per phase-plan-v2 X5 (AC-X5.3, AC-X5.5).
- `apps/frontend/src/test/mocks/handlers.ts` still defines a local `Child` interface missing `grade`/`note`/`avatar`; it is **not wired into any test** (no `setupServer`) and can be refreshed or removed when MSW mocking is adopted.

## Contract deviations

None.
