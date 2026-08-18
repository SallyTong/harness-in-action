# Backend Agent Memory

- [Phase 1: Foundation](phase-1-foundation.md) — ✅ Complete. Project scaffold, health endpoint, DB models
- [Phase 2: Image Upload](phase-2-image-upload.md) — ✅ Complete. Children CRUD, image serving, submission upload
- [Phase 3: Grading Engine](phase-3-grading-engine.md) — ✅ Complete. GLM-4V prompts, annotation overlay, grading pipeline
- [Phase 4: History Records](phase-4-history-records.md) — ✅ Complete. History list, manual correction, error collections, practice sheets
- [Phase 5: Polish](phase-5-polish.md) — ✅ Complete. Rate limiting, cost logging, error hardening, input validation
- [Phase X1: Auth Login](phase-X1-auth-jwt.md) — ✅ Complete. SMS + JWT, de-phone, signed URLs, wechat-login removed
- [Phase X2: Vision Model Abstraction](phase-X2-vision-model-abstraction.md) — ✅ Complete. VisionModel GLM/Qwen providers, factory, multi-provider cost log
- [Phase X3: Question Text](phase-X3-question-text.md) — ✅ Complete. Vision model emits question_text/question_latex, persisted + redundant to ErrorQuestion

## Miniapp W1 — WeChat login increment (2026-08-15, removed in X1)

- ~~Added `POST /api/wechat-login` + `wechat_client.py` + `Parent.openid`~~ — **removed in X1 (2026-08-16)**: endpoint, client, and `WECHAT_APPID`/`WECHAT_APP_SECRET` are gone; mini-program login unified with Web (SMS + JWT). `Parent.openid` column retained but unread. See [X1](phase-X1-auth-jwt.md).

> Cross-cutting rules: [shared/cross-cutting.md](../shared/cross-cutting.md)
