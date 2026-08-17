# Phase X1 — Auth Login (Web)

**Status:** ✅ Complete (2026-08-16).

## What was built

- `src/pages/LoginPage.tsx` — phone + 6-digit SMS code, 60s resend countdown, toast feedback; redirects to `/` when already authenticated.
- `src/lib/auth.ts` — token in `localStorage` key `auth_token`; `getToken`/`setToken`/`clearToken`/`isAuthenticated`/`redirectToLogin`.
- `src/lib/api.ts` — `request()` injects `Authorization: Bearer <token>`; 401 → `clearToken()` + `redirectToLogin()`; new `apiPostPublic` (auth=false) for send-code/login so a wrong code (401) does not trigger redirect.
- Removed `src/hooks/usePhone.ts` (phone no longer in localStorage).

## What changed across pages

- All pages read children/submissions via Bearer (no `?phone=`); image URLs rendered verbatim from the API (signed URLs), no hand-assembled `?phone=`.

## Tests

`LoginPage.test.tsx` (validation, send-code, login success/failure, authenticated redirect); updated `App.test.tsx` + page tests.

## Known limitations / accepted debt

1. Token in `localStorage` — XSS would leak it; acceptable for family self-use.
2. No logout button on every page — logout = `clearToken()`.

## Contract deviations

None.
