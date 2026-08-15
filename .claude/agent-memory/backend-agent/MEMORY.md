# Backend Agent Memory

- [Phase 1: Foundation](phase-1-foundation.md) — ✅ Complete. Project scaffold, health endpoint, DB models
- [Phase 2: Image Upload](phase-2-image-upload.md) — ✅ Complete. Children CRUD, image serving, submission upload
- [Phase 3: Grading Engine](phase-3-grading-engine.md) — ✅ Complete. GLM-4V prompts, annotation overlay, grading pipeline
- [Phase 4: History Records](phase-4-history-records.md) — ✅ Complete. History list, manual correction, error collections, practice sheets
- [Phase 5: Polish](phase-5-polish.md) — ✅ Complete. Rate limiting, cost logging, error hardening, input validation

## Miniapp W1 — WeChat login increment (2026-08-15)

- Added `POST /api/wechat-login` (`app/routers/wechat.py`) + `app/services/wechat_client.py` (jscode2session) + `Parent.openid` field (migration `a1b2c3d4e5f6`) + `WECHAT_APPID`/`WECHAT_APP_SECRET` env vars. Full detail in [miniapp W1](../miniapp-agent/phase-W1-scaffold-auth.md).

> Cross-cutting rules: [shared/cross-cutting.md](../shared/cross-cutting.md)
