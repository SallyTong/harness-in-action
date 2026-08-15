# AI 作业批改工具 — 微信小程序扩展架构（增量附录）

## 文档信息

| 字段     | 值                                                                  |
| -------- | ------------------------------------------------------------------- |
| 版本     | v0.1.0                                                              |
| 日期     | 2026-08-14                                                          |
| 作者     | sally                                                               |
| 依据     | `docs/architecture.md` v1.1、`docs/prd-wechat-miniapp.md` v0.1.1、`contracts/openapi.yaml` v0.1.0、作用域化访谈 |
| 变更说明 | 初始版本 — 微信小程序平台扩展的增量架构决策。仅记录**新增决策（AD-12 起）**，不重复现有架构。 |

> 本文件是 `docs/architecture.md` 的**增量附录**。凡现有架构已覆盖的内容（技术栈、数据模型主结构、批改管线、图片标注、错题集一致性等）不再重复；本文只记录小程序平台带来的**新增决策与变更点**。

---

## 1. 架构决策记录（AD-12 起）

### AD-12: 小程序前端框架选型 Taro (React)

**决策：** 小程序前端采用 **Taro (React)**，编译输出到微信小程序；不采用原生小程序（WXML/WXSS）或 uni-app（Vue）。

**理由：**
- 现有前端为 React 19 + TypeScript，Taro 复用同一心智模型与技能栈，团队无 Vue/小程序原生 DSL 学习成本。
- 类型定义（`types.ts`，纯 TS、零平台依赖）可跨端复用，业务逻辑（得分计算、题号解析、筛选状态机等）多数可直接移植。
- Taro 对 React Hooks、组件化、路由的抽象与现有代码结构最接近；与现有架构 AD-01（Vite + CSR）的"后续迁移小程序技术栈接近"判断一致。
- 原生小程序性能更优但需全量重写 UI，复用率为零；uni-app 引入 Vue 造成技术栈割裂。二者均不及 Taro 的复用收益。

**代价：** Taro 与原生微信 API 存在适配层（部分 `wx.*` 能力需 `Taro.*` 封装或 `@tarojs/plugin` 桥接）；Tailwind v4 需改用 Taro 支持的样式方案（见 AD-15）。

---

### AD-13: 认证方案 — openid 绑定 phone（wx.login 静默登录 + 首登手动输手机号）

**决策：** 小程序用 `wx.login()` 静默换取 `openid`，后端将 `openid` **绑定到现有 `phone` 身份**；`phone` 仍是数据归属的唯一键，现有 11 个端点零改动。首登手动输入一次手机号完成绑定，之后静默登录。

**理由：**
- `wx.login()` 只返回 `openid`（不含手机号）；手机号只能通过 `getPhoneNumber`（需企业主体，已排除）或用户手动输入。故"静默登录"与"phone 归属"必须通过**绑定**桥接。
- `phone` 作为数据归属键已在数据模型（`Parent.phone` UNIQUE）、契约（所有端点 `phone` 参数）、以及现有 Web 端深度耦合。以 `openid` 替换 phone 会导致全部端点参数改造 + Web 历史数据迁移，代价远超收益。
- 绑定方案保留 F-08（同手机号多端一致）：Web 与小程序各自用 phone 归属，天然共享同一 Parent 数据。
- 与现有架构 AD-05/AD-08（phone 信任模型）不冲突——`openid` 是新增的"静默登录钥匙"，不是新的归属键。

**完整流程见 §3。**

**数据模型变更：** `Parent` 表新增可空字段 `openid`（见 §4 合约变更点）。

---

### AD-14: 项目结构 — apps/miniapp/ 独立工程

**决策：** 小程序代码放在 **`apps/miniapp/`**（Taro 独立工程），与 `apps/frontend/`（React Web）、`apps/backend/`（FastAPI）并列。

**理由：**
- Taro 工程有独立的构建工具链（`@tarojs/cli`）、配置（`app.config.ts`/`project.config.json`）与依赖（`@tarojs/plugin-*`），无法与 Vite 工程合并。
- 独立工程保持 `apps/frontend` 的 Web 构建与测试不受影响，符合"小程序为主、Web 降级维护"的演进（未来 Web 可独立收缩/下线，不动 miniapp）。
- 与现有 `apps/` 目录布局一致，Docker/脚本可并行编排。

**边界与领域归属：**
- `apps/miniapp/` 属**前端领域**（与 `apps/frontend/` 同侧）。实施阶段需将 CLAUDE.md「领域边界」与 `.claude/rules/frontend-conventions.md` 的触发路径扩展至 `apps/miniapp/**`。
- 共享类型若抽包（AD-15），目录建议 `packages/api-types/`（或 `apps/shared/`），同时被两个前端工程引用。

---

### AD-15: 代码复用策略 — 类型共享、transport 平台适配

**决策：** **类型共享，transport 独立。** `types.ts` 抽为单一来源的共享模块；`api.ts` 只共享接口签名，transport 按平台各自实现。

| 文件 | 现状（Web） | 小程序（Taro） | 结论 |
| ---- | ----------- | -------------- | ---- |
| `types.ts` | 纯 TS 类型，零平台依赖 | 完全相同 | **共享**（抽 `packages/api-types/`） |
| `lib/api.ts` | `fetch` + `localStorage` + `FormData` | `Taro.request` / `Taro.uploadFile` + `Taro.getStorageSync` | **不共享实现**，共享 `apiGet/apiPost/apiPut/apiPatch/apiDelete/apiUpload` 签名 |
| `hooks/usePhone.ts` | `localStorage` | `Taro.getStorageSync`/`setStorageSync` | 共享 hook 契约（`phone/setPhone/clearPhone/isReady`），存储层各自注入 |
| `lib/image.ts` | Canvas API（Web Worker 压缩） | `Taro.compressImage` / canvas 重绘 | 不共享，平台各自实现 |

**共享机制（推荐）：** `types.ts` 抽为 **`packages/api-types/`**（纯 TS、无构建步骤），两个前端工程经 tsconfig `paths` 或 npm workspace 引用。类型是 `contracts/openapi.yaml` 的镜像，单一来源避免两端漂移；契约变更后由该包统一同步。

**备选（不引入 monorepo 工具时）：** `apps/miniapp/src/types.ts` 从 `contracts/openapi.yaml` 重新生成（或复制并加同步注记），而非手工维护两份。

**理由：** 类型无平台依赖，共享零成本、收益高；transport 与存储受平台 API 硬约束（`wx.request` 不支持 `FormData` 语义、无 `localStorage`），强行统一抽象会引入无谓的适配层复杂度，违背"解决问题而非制造抽象"。

---

### AD-16: API 变更 — 新增 wechat-login，其余端点全部复用

**决策：** 新增 **1 个端点** `POST /api/wechat-login`（openid↔phone 登录/绑定）；现有 11 个端点**全部复用、零改动**。

**理由：**
- 现有端点以 `phone`（query 或 `X-Parent-Phone` 头）为身份，绑定后小程序仍以 phone 访问，故无需改动。
- `wechat-login` 是唯一新增需求：把 `wx.login()` 的 `code` 换成 `openid` 并解析/绑定到 phone。
- 后端新增一个领域 router（`routers/wechat.py` 或 `routers/auth.py`）承载该端点，调用微信 `jscode2session`（复用现有 `httpx` 异步客户端，与 GLM 调用同风格）。

**新增外部依赖：** 微信 `jscode2session` 接口（`GET https://api.weixin.qq.com/sns/jscode2session`）。这是后端 → 微信的出站 HTTPS 调用，**与小程序访问后端的域名备案无关**，内测阶段即可正常工作。

**新增环境变量（密钥，不入库）：** `WECHAT_APPID`、`WECHAT_APP_SECRET`（小程序注册时获得；`wx.login`/`code2session` 个人主体即可用，仅 `getPhoneNumber` 才需企业主体）。

---

### AD-17: 部署与合规 — HTTPS + ICP 备案的影响

**决策：** **暂不打破"无域名/HTTPS"约束**，内测期沿用本地/IP 部署；正式对外发布前再补域名备案 + HTTPS。这是硬门槛，内测只是延后而非替代。

**对现有部署架构的影响（分两阶段）：**

**内测阶段（当前）：**
- 后端继续本地/IP + HTTP，无变化。
- 开发者工具勾选"不校验合法域名"；家人体验版在真机上需**每台设备手动"打开调试"**（右上角 `···` → 打开调试）以绕过域名校验——"不校验合法域名"仅对开发者工具生效，对真机体验版不生效（已核实）。
- `jscode2session`（后端→微信）不受此影响，内测即可用。

**正式发布阶段（备案后，需完成）：**
1. 申请域名 + ICP 备案（个人或企业主体）；
2. 配置 TLS 证书，Nginx 终结 HTTPS 并反向代理 `/api`（复用 `infra/nginx.conf` 方案，架构 §7 已预留阿里云 ECS 部署）；
3. 后端部署至备案服务器（架构 §7 生产部署路径）；
4. 小程序后台"服务器域名"配置 `request`（`wx.request`）与 `downloadFile`（图片加载）合法域名；
5. **图片 URL 基址可配置化**：现有架构「API 返回时拼接完整 URL」（架构 §8）需改为由环境变量（如 `PUBLIC_BASE_URL`）决定，使批改图/缩略图/题目截图的 URL 在内测为 `http://IP:port`、正式为 `https://域名`。

---

## 2. 认证流程（展开 AD-13）

### 2.1 首次登录（绑定）

```
Miniapp                          Backend                      WeChat
  │                                │                            │
  │ (无本地 phone 缓存)            │                            │
  ├─ 显示手机号输入页              │                            │
  │  用户输入 phone                │                            │
  ├─ wx.login() ──→ code          │                            │
  ├─ POST /api/wechat-login ─────→│                            │
  │   {code, phone}               ├─ code2session(code) ──────→│
  │                               │←── {openid, session_key} ──┤
  │                               ├─ upsert Parent(phone)      │
  │                               ├─ Parent.openid = openid    │
  │                               ├─ (绑定/换绑)               │
  │←── 200 {phone} ───────────────┤                            │
  ├─ 缓存 phone 到本地存储         │                            │
  └─ 进入首页，后续请求照旧带 phone │                            │
```

### 2.2 静默登录（已绑定）

```
Miniapp                          Backend                      WeChat
  │                                │                            │
  ├─ 本地已有 phone 缓存           │                            │
  ├─ wx.login() ──→ code          │                            │
  ├─ POST /api/wechat-login ─────→│                            │
  │   {code}                       ├─ code2session(code) ──────→│
  │                               │←── {openid} ───────────────┤
  │                               ├─ 查 Parent.openid          │
  │                               ├─ 命中 → 200 {phone}        │
  │←── 200 {phone} ───────────────┤  (未命中 → 404，回退绑定)  │
  └─ 校验/刷新本地 phone 后继续     │                            │
```

### 2.3 关键约定

- `phone` 仍是所有业务端点（children/submissions/error-collections/images）的身份入参，`openid` 仅用于登录态解析，不出现在业务端点、不暴露给客户端（敏感信息，不进响应、不打日志）。
- `code` 为一次性凭证（约 5 分钟有效），每次登录重新 `wx.login()` 获取；不得缓存 `code`。
- `session_key`（code2session 返回）本方案不使用（`getPhoneNumber` 才需要），**不存储**，避免敏感信息落库。
- 换绑：同一 openid 重发 `{code, phone}` 可改绑到新 phone；同一 phone 被新 openid 绑定则覆盖旧绑定（MVP 信任模型，无多设备冲突处理）。

---

## 3. 合约变更点（**待人工审批**）

> ⚠️ 依 `contracts/README.md` 与 CLAUDE.md「契约治理」规则，**子代理/实施者无权单方面修改 `contracts/openapi.yaml`**。以下变更为**草案**，须由人工审核批准后写入契约。

### 3.1 新增端点：`POST /api/wechat-login`

```yaml
/api/wechat-login:
  post:
    operationId: wechatLogin
    tags: [Auth]
    summary: Exchange wx.login code for a bound parent phone
    description: |
      Exchanges a wx.login() code for the WeChat openid via jscode2session.
      If phone is provided, creates/binds the parent to this openid (first login).
      If phone is omitted, resolves the already-bound parent and returns its phone.
      This is a MINI-PROGRAM-only endpoint (not used by the Web client).
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [code]
            properties:
              code:
                type: string
                description: wx.login() temporary code (single-use, ~5 min TTL)
              phone:
                type: string
                pattern: '^\d{11}$'
                description: Optional. Parent phone to bind on first login.
    responses:
      "200":
        description: Bound parent phone
        content:
          application/json:
            schema:
              type: object
              required: [phone]
              properties:
                phone:
                  type: string
                  example: "13800138000"
      "401":
        description: Invalid or expired wx.login code
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Error"
      "404":
        description: openid not yet bound to a phone (client should prompt for phone)
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Error"
```

> 注：新增 `Auth` tag；或并入现有 tag，由人工审批时决定。

### 3.2 数据模型变更：`Parent` 表新增 `openid`

| 字段   | 类型        | 约束                            |
| ------ | ----------- | ------------------------------- |
| openid | VARCHAR(64) | NULLABLE, UNIQUE（Web 用户为空） |

- 对应 Alembic 迁移（forward-only，见架构 §8 迁移策略）。
- `openid` 为内部字段，**不进入任何 API 响应 schema**（现有契约无 Parent 资源端点，故无契约 schema 变更）。
- 索引：`UNIQUE(openid)` 支撑 `code2session` 后按 openid 反查 parent。

### 3.3 环境变量（新增）

| 变量                | 说明                     |
| ------------------- | ------------------------ |
| `WECHAT_APPID`      | 小程序 AppID（密钥）      |
| `WECHAT_APP_SECRET` | 小程序 AppSecret（密钥）  |
| `PUBLIC_BASE_URL`   | 图片 URL 基址（AD-17）    |

### 3.4 复用（无变更）的现有端点

`GET /api/health`、`GET/POST /api/children`、`PUT/DELETE /api/children/{child_id}`、`POST/GET /api/submissions`、`GET /api/submissions/{id}`、`PATCH /api/submissions/{id}/questions/{qid}`、`GET /api/images/{kind}/{filename}`、`GET /api/error-collections`、`POST /api/error-collections/generate` —— 全部以 `phone` 为身份，小程序绑定后照旧调用，**零改动**。

---

## 4. 已知限制与后续

1. **体验版真机调试门槛**：内测期家人需各自手动"打开调试"绕过域名校验；"不校验合法域名"对真机体验版不生效（已核实）。这是"暂不备案"的临时代价。
2. **会话凭证尚未落地**：当前 `wechat-login` 仅返回 `phone`，仍走 phone 信任模型；契约已预留 `cookieAuth` 作为对外开放时的会话迁移路径，届时 `openid` 绑定可升级为正式 session。
