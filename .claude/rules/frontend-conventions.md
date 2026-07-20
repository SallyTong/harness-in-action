---
paths:
  - "apps/frontend/**"
---

# Frontend Code Conventions

## TypeScript

- Strict mode enabled. No `any` without a comment explaining why.
- Use `type` for props, `interface` only when extending.
- Derive types from API responses when possible; avoid duplicating shapes manually.

## React Components

- Functional components only. Use hooks for state and side effects.
- Keep components focused: if a component exceeds 150 lines, extract sub-components.
- Use `export default function` for page components, named exports for shared components.
- Co-locate component-specific types in the same file.

## Styling (Tailwind v4)

- Mobile-first: design at 375px, use `sm:`, `md:`, `lg:` breakpoints to scale up.
- Touch targets ≥ 44px (`min-h-11`, `min-w-11`).
- Use `min-h-dvh` for full-screen layouts (handles mobile browser chrome).
- No custom CSS files beyond `index.css`. No inline styles.

## File Naming & Organization

```
src/
  pages/           # One file per route (HomePage, HistoryPage, ErrorCollectionPage)
  components/
    ui/            # Shared primitives (Button, Card, LoadingSpinner)
    upload/        # Photo upload flow components
    result/        # Grading result display components
    history/       # Submission history components
```

File names: PascalCase for components, camelCase for utilities.

## API Calls

- All requests go to `/api/*` (proxied to backend by Vite).
- Use fetch with a thin wrapper that handles JSON parsing and error extraction.
- Every API call must handle three states: loading, success, error.
- Show loading indicators immediately. Show errors inline, never as alert().

## Image Upload

- Client-side compression before upload: resize to max 2048px, output JPEG at Q80%.
- Use `capture="environment"` on the file input to open rear camera on mobile.
- Show a preview before the user confirms upload.
- Display upload progress (XHR or fetch with progress events).
