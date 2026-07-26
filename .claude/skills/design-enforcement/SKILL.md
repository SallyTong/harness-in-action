---
name: "design-check"
description: "Anti-generic design enforcement for AI Homework Grader — catches AI-generated visual antipatterns and verifies brand compliance against docs/brand-identity.md. Run before committing any UI component or page."
---

# Design Enforcement — Brand Compliance Check

You have been asked to verify that UI code conforms to the AI Homework Grader brand identity
and design system. The brand is **warm, reliable, family education tool** — not a generic
SaaS dashboard.

---

## 1. Load Brand Identity

Read `docs/brand-identity.md` every time. The brand identity is the authoritative source.
Key references:

- **Section 3**: Color system — 14 CSS custom properties, validated contrast pairs, forbidden Tailwind grays
- **Section 4**: Typography — 6-token type scale, font stack (PingFang SC / Microsoft YaHei, monospace for scores)
- **Section 5**: Spacing — 9-value scale, minimum 3 different spacing values per page
- **Section 6**: Visual language — component-specific corner radii, 4 shadow levels, border types
- **Section 7**: Icon system — Lucide Icons, specific sizes per context
- **Section 8**: Empty states — 4 specific scenarios with icons and copy
- **Section 9**: Animation — timing, easing, `prefers-reduced-motion`
- **Section 10**: Copywriting tone — no AI jargon, specific button labels
- **Section 11**: Anti-generic checklist — 32 items, minimum pass 27/32

---

## 2. AI-Generated Antipatterns (Active Avoidance)

These are the five patterns that make AI-built UIs look identical. Scan for and flag every
instance.

### 2.1 Tailwind Default Syndrome
- `rounded-lg` on everything → FAIL. Radii must vary by component: 12px buttons (`rounded-xl`), 14px cards (`rounded-[14px]`), 10px inputs (`rounded-[10px]`), 16px upload zone, 9999px badges, 10px toasts.
- `bg-gray-50`, `bg-gray-100`, `bg-gray-200` → FAIL. These Tailwind classes are **forbidden**. Must use custom tokens or indigo/red/green/amber series.
- `text-gray-500`, `text-gray-600` → FAIL. Secondary text uses `--color-text-secondary: #6B6560`.
- `p-4 gap-4` everywhere → FAIL. At least 3 different spacing values per page.
- `shadow-sm` / `shadow-md` on every surface → FAIL. Shadow levels are contextual (0-3).

### 2.2 Typography Flatness
- Only two font sizes on a page → FAIL. Minimum 3 from the type scale.
- No weight variation → FAIL. Use font-semibold (headings) and font-medium (subheadings) plus font-normal (body).
- Score numbers not monospace → FAIL. Scores must use `font-mono`.
- Same line-height for headings and body → FAIL. Headings tighter, body looser.

### 2.3 Layout Monotony
- Everything in equal-width centered cards → FAIL. Content groups should vary in density.
- Desktop is just mobile squeezed → FAIL. Desktop: max-width 480px centered, but use the extra space intentionally.
- No visual grouping through spacing → FAIL. Related items compact (12px), sections separated (32px).

### 2.4 Missing Personality
- Generic button labels: "提交", "取消", "保存", "删除" → FAIL. Use "开始批改", "重新批改", "保存修改", "移除".
- Center spinner for all loading → FAIL. Use skeleton screens matching content shape, contextual spinners in buttons, animated ✏️ for grading wait.
- "暂无数据" + gray icon → FAIL. Use the 4 specific empty states from brand spec (§8.2).
- No micro-interactions → FAIL. At minimum: button hover color shift, active press scale (97%).

### 2.5 Brand Voice Violations
- "AI 批改", "模型", "prompt", "AI 生成" in UI text → FAIL. Strip "AI" prefix; use "批改" not "AI 批改".
- Corporate jargon: "赋能", "解决方案", "智能" → FAIL.
- Overly formal: "您的试卷已经成功完成批改" → FAIL. Use "批改完成".

---

## 3. Mechanical Code Checks

Run these against the changed files:

### 3.1 Forbidden Classes (instant FAIL)

Scan for these patterns and flag every occurrence:
```
\bbg-gray-\d+\b          → Replace with bg-bg-page / bg-bg-card / bg-bg-hover
\bbg-zinc-\d+\b          → Replace with custom tokens
\bbg-slate-\d+\b         → Replace with custom tokens
\bbg-neutral-\d+\b       → Replace with custom tokens
\btext-gray-\d+\b        → Replace with text-text-primary / text-text-secondary / text-text-tertiary
\btext-zinc-\d+\b        → Replace with custom tokens
\btext-slate-\d+\b       → Replace with custom tokens
\btext-neutral-\d+\b     → Replace with custom tokens
```

If the project's `index.css` doesn't yet define custom tokens, flag it as a prerequisite:
the `@theme` block must define all color tokens from brand §3.1.

### 3.2 Uniform Radii (check pattern)

If ≥ 80% of rounded corners in a file use the same class (e.g., all `rounded-lg`), that's an
antipattern. The brand specifies different radii for buttons, cards, inputs, upload zones,
badges, and toasts.

### 3.3 Spacing Uniformity (check pattern)

Count unique spacing values in a component file. If only 1-2 distinct values across all
`p-*`, `m-*`, `gap-*`, `space-*` classes, flag it. Minimum 3 per page.

### 3.4 Type Scale Usage (check pattern)

Count unique `text-*` classes. If only 1-2 sizes on a page, flag it. Minimum 3 from the
type scale.

### 3.5 Icon Consistency (check imports)

- Icons must import from `lucide-react`. Flag `@heroicons/react` or custom inline SVG.
- Correct/wrong status indicators (✓/?) are the exception — custom SVG allowed there per brand §7.
- No emoji as functional icons (emoji in empty state copy like "🎉" is fine per brand §8.2).

### 3.6 Button Label Check

Scan button text content for generic labels and suggest brand-approved alternatives:
- "提交" → "开始批改" (if submitting) or "保存修改" (if saving)
- "取消" → "返回" or keep if truly cancelling an action
- "删除" → "移除"
- "重试" → "重新批改" (if re-grading) or "再试一次" (if network retry)
- "保存" → "保存修改"

### 3.7 Animation Compliance

- Check for transitions > 400ms → FAIL. Max is 300ms for page transitions.
- Check for `prefers-reduced-motion` handling in any custom CSS/animations.
- Loading states: flag full-page centered spinners — should be skeleton screens.

---

## 4. Anti-Generic Checklist (32 items)

Run every item against the component or page. Each is PASS or FAIL.

### Typography (7 items)
1. [ ] At least 3 distinct font sizes used (from the 6-token scale)
2. [ ] At least 2 distinct font weights visible
3. [ ] Headings and body text have clearly distinct hierarchy
4. [ ] Headings and body text have different line-heights
5. [ ] No `text-gray-*` default Tailwind colors
6. [ ] Score numbers use monospace font (`font-mono`)
7. [ ] Chinese text uses system PingFang SC / Microsoft YaHei (no web font loaded)

### Color (6 items)
8. [ ] No forbidden Tailwind grays (gray/zinc/slate/neutral)
9. [ ] Accent color (indigo #6366F1) used at 1-2 focal points only, not everywhere
10. [ ] Body text contrast meets 4.5:1 minimum
11. [ ] Card background visibly distinct from page background (white vs warm white)
12. [ ] Interactive elements have hover / focus / active states
13. [ ] All text/background pairs are in the approved contrast table (brand §3.2)

### Layout (5 items)
14. [ ] At least 3 different spacing values on this page
15. [ ] Related content grouped tightly; different sections clearly separated
16. [ ] Layout is NOT a centered column of equal-width cards
17. [ ] Desktop (≥768px) uses max-width 480px centered
18. [ ] Intentional negative space / breathing room is visible

### Visual Language (4 items)
19. [ ] Corner radii vary by component type (buttons ≠ cards ≠ badges)
20. [ ] Shadow levels match the defined hierarchy (0-3)
21. [ ] Focus rings use `ring-2 ring-indigo-400`
22. [ ] Icons are from Lucide, sizes match spec (22px nav, 16px inline, 48px empty state, 14px status)

### Interaction (4 items)
23. [ ] Button labels are specific to the action (not generic Submit/Cancel)
24. [ ] At least one micro-interaction exists (hover color, press scale, transition)
25. [ ] Loading states match spec (skeleton screens, not full-page spinners)
26. [ ] Empty states have visual treatment + clear next action

### Copywriting (3 items)
27. [ ] No "模型", "prompt", "AI", or similar AI jargon in user-facing text
28. [ ] Error messages are specific and actionable
29. [ ] Placeholder text is genuinely helpful

### Visual Verification (3 items)
30. [ ] This page is visually distinct from competitors (小猿搜题, 一起作业)
31. [ ] Brand is recognizable even with logo hidden
32. [ ] No clipping or overflow at 375px or 768px viewports

**Scoring**: Count PASS items. Minimum passing: **27/32**.
Items 1-7 (Typography) and 8-13 (Color) are gate items: ≥ 5/7 and ≥ 5/6 respectively,
or the component DOES NOT SHIP regardless of total score.

---

## 5. Report Format

After checking, produce this report:

```
## Design Check: [Component/Page Name]

### Forbidden Classes: [count found / 0 expected]
(list each violation with file:line)

### Antipattern Flags:
- [list each flagged pattern]

### Checklist Score:
- Typography:   [X]/7  (gate: ≥5) — [PASS/FAIL]
- Color:        [X]/6  (gate: ≥5) — [PASS/FAIL]
- Layout:       [X]/5
- Visual Lang:  [X]/4
- Interaction:  [X]/4
- Copywriting:  [X]/3
- Verification: [X]/3
- **TOTAL: [X]/32**

### Verdict: PASS (≥27) / NEEDS FIX (list items to fix)

### Fix Suggestions:
- [concrete, actionable fix for each failure]
```

---

## 6. Severity Rules

- **BLOCKER**: Forbidden Tailwind gray classes, < 5/7 typography, < 5/6 color. Do not commit.
- **HIGH**: Uniform radii, uniform spacing, missing loading state, wrong button labels. Fix before PR.
- **MEDIUM**: Missing micro-interaction, generic empty state, wrong icon size. Fix in current phase.
- **LOW**: Missing `prefers-reduced-motion`, slightly off spacing value. Document and fix later.
