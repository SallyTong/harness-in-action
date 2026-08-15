# W1 — 工程骨架 + 认证登录

**状态：** ✅ 完成（2026-08-15）

## 构建了什么

### 契约（人工授权）
- `contracts/openapi.yaml` 新增 `POST /api/wechat-login` + `Auth` tag + `WechatLoginRequest/Response` schema，版本 0.1.0 → 0.1.1。
  - 本次为**人工明确授权**的一次契约变更（用户选择"授权我更新契约并实现"）。

### 后端（`apps/backend/`）
- `app/models/parent.py` 新增 `openid VARCHAR(64) NULLABLE UNIQUE`。
- 迁移 `a1b2c3d4e5f6_add_openid_to_parents.py`（forward-only，已 `alembic upgrade head` 验证）。
- `app/services/wechat_client.py` — `code2session(code)` 调微信 `jscode2session` 换 openid；`WechatCodeError`（→401）、`WechatServiceError`（→502）。openid 从不落日志/响应。
- `app/routers/wechat.py` — 绑定（upsert Parent + 默认小朋友1/2，镜像 `get_parent`）/ 静默登录（openid 反查）/ 换绑。
- `app/schemas/wechat.py` — 请求 `{code, phone?}`（phone 校验 `^\d{11}$`）、响应 `{phone}`。
- `tests/test_wechat.py` — 9 个用例（绑定、静默、404、401、502、已绑 Web 手机号、换绑、缺 code 422、非法 phone 422）。全部 mock `code2session`。

### 前端（`apps/miniapp/`）
- Taro 4.2.1 + React 18.3.1 + TypeScript + Webpack5 + Sass 工程（`config/index.ts` 用 `tsconfig-paths-webpack-plugin` 解析 paths 别名）。
- 共享类型包 `packages/api-types/`（纯 TS 单一来源），`apps/frontend/src/types.ts` 改为 `export * from "@homework/api-types"`（tsconfig paths + vite alias，前端 tsc/vitest/build 均验证绿）。
- `src/lib/storage.ts`（`Taro.*StorageSync` 封装）、`src/lib/api.ts`（`Taro.request` transport，`wechatLogin` + `apiGet/Post/Put/Patch/Delete`，`API_BASE` 默认 `http://localhost:8000`）。
- 页面：`pages/login/index`（品牌区 + 手机号输入 + 静默登录 + 绑定 + 401 重试一次）、`pages/index/index` + `pages/history/index`（tabBar 2 项空态占位）。
- 测试：Vitest + @testing-library/react，`src/test/mocks/*` mock `@tarojs/components`/`@tarojs/taro`。4 个用例全绿。

## 验证结果

```bash
cd apps/backend && python -m ruff check . && python -m pytest tests/ -v   # 30 passed
cd apps/miniapp && npx tsc --noEmit && npm test && npm run build:weapp    # tsc 0 error / 4 tests / build 成功
```

## Known Limitations / Accepted Technical Debt

1. **openid↔phone 绑定无手机号真实性校验**（MVP 信任模型，见 AD-13）。正式发布前需 `getPhoneNumber`（企业主体）或短信验证。**已接受技术债。**
2. **`wechat-login` 无速率限制**（现有 middleware 按 phone 计，登录端点 phone 在 body 不在 query/header）。微信 `jscode2session` 自身限流兜底。**已接受技术债。**
3. **API 基址硬编码 `http://localhost:8000`**。内测 IP:端口可用；正式发布前需 `PUBLIC_BASE_URL` 可配置（AD-17）。
4. **真机体验版域名校验**：开发者工具 `urlCheck:false` 只对开发者工具生效，真机体验版仍需每台手动"打开调试"（AD-17）。

## Contract Deviations

- `contracts/openapi.yaml` 新增 wechat-login 端点：**人工授权**，非单方面修改。

## 技术决策偏差（非契约，已记录）

- **React 18.3.1（非 miniapp-agent.md 所写 React 19）**：Taro 4.2.1 的 `@tarojs/plugin-framework-react` peer 为 `react ^18`，React 19 会导致 peer 冲突。**必要时可后续升级 Taro 支持 React 19。**
- **测试用 Vitest（非 miniapp-agent.md 所写 Jest + @tarojs/test-utils-react）**：`@tarojs/test-utils-react` 停在 0.1.1（peer 为 Taro 3.6），与 Taro 4.2.1 不兼容；Vitest + RTL 与 Web 端统一。
- **npm 用 `legacy-peer-deps`（`.npmrc`）+ 显式 `ajv@8`**：`@tarojs/plugin-framework-react` 的 `peerOptional vite@^4` 与 vitest 的 `vite@^5+` 冲突；`ajv@8` 修复 webpack5-runner 的 `ajv/dist/compile/codegen` 缺失。

## Cross-Agent Requests

- **backend-agent**：无待办（wechat-login 端点 + 迁移已由本阶段完成并测试）。
- **frontend-agent**：`apps/frontend/src/types.ts` 已改为从 `packages/api-types/` 重导出，后续新增类型请改 `packages/api-types/index.ts`。
