# Phase X3 — Question Text (Web)

**Status:** ✅ Complete (2026-08-18). No contract change — `contracts/openapi.yaml` v0.2.0 already carried the nullable `question_text`/`question_latex` fields.

## What was built

- `src/components/ui/QuestionText.tsx` — renders transcribed stem text on the error card. English → `question_text` plain text (React text node, auto-escaped). Math → `question_latex` via KaTeX (`trust: false`, `throwOnError: false`); returns `null` when no text so callers fall back to the question screenshot instead of an empty shell.
- `packages/api-types/index.ts` — `GradedQuestion` + `ErrorQuestionItem` each gain `question_text: string | null` + `question_latex: string | null` (shared source of truth mirroring the contract).
- `src/pages/ErrorBookPage.tsx` — error card renders `<QuestionText>` between the info bar and the solution note.
- `katex` dependency added (`^0.16.47`; ships its own TS types, no `@types/katex`).

## XSS safety

- KaTeX `trust: false` disables `\href`/`\htmlClass`/`\htmlId`/`\htmlStyle` and escapes text-mode `<>&`; the plain-text path uses React text nodes. No `dangerouslySetInnerHTML` with raw model output anywhere.

## Tests

`QuestionText.test.tsx` (English text, Math KaTeX, `\href` produces no anchor, raw-HTML escaped, empty → `null`); `ErrorBookPage.test.tsx` adds stem-text render. `npx tsc --noEmit` clean; 29 vitest green; `npm run build` succeeds.

## Notes / accepted debt

- KaTeX bundles ~270KB of fonts → build chunk ~565KB (gzip 169KB). Acceptable for MVP; could code-split by lazy-loading `QuestionText` later.
- Subject↔field mapping mirrors backend: English→`question_text`, Math→`question_latex`; Math falls back to `question_text` if LaTeX is absent.

## Contract deviations

None — implemented against `contracts/openapi.yaml` v0.2.0 (fields already present).
