# AI 作业批改工具 — 微信小程序实施阶段计划

## 文档信息

| 字段     | 值                                                                  |
| -------- | ------------------------------------------------------------------- |
| 版本     | v0.1.1                                                              |
| 日期     | 2026-08-15                                                          |
| 作者     | sally                                                               |
| 依据     | `docs/prd-wechat-miniapp.md` v0.1.2、`docs/architecture-wechat-miniapp.md` v0.1.0、`docs/ux-spec-wechat-miniapp.md` v0.1.1、`contracts/openapi.yaml` v0.1.0 |

---

## 阶段总览

| 阶段 | 名称 | 核心交付 | 累计可用 |
|------|------|---------|---------|
| W1 | 工程骨架 + 认证登录 | Taro 工程、共享类型、`wechat-login` 端点、登录/绑定页 | 能登录进入首页 |
| W2 | 核心批改闭环 | 小朋友管理、拍照上传 → 批改 → 结果 | 🎯 首次可用：能批改试卷 |
| W3 | 历史浏览 + 错题集 | 历史列表、详情、人工修正、错题集、错题试卷生成 | 批改结果可回溯 + 错题闭环 |
| W4 | 内测打磨 | 真机体验版、状态/性能、品牌合规 | 家人可试用 |

每阶段产出**独立可验证的工作增量**——上一阶段不依赖下一阶段的任何代码。W2/W3 为纯前端工作（复用现有 11 个后端端点）。

> 后端增量仅 W1 的 `wechat-login` + `Parent.openid`；`contracts/openapi.yaml` 的新增端点须**人工审批后**方可实现（见 `docs/architecture-wechat-miniapp.md` §3）。

---

## W1: 工程骨架 + 认证登录

**目标：** 搭建 Taro 工程与共享类型包，实现后端 `wechat-login` 端点 + `Parent.openid` 迁移，完成登录/绑定页。结束后小程序可完成 openid↔phone 绑定并进入首页。

**工期预期：** 1.5–2 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-12（手机号身份与跨端一致） |
| 数据模型 | `Parent.openid`（新增可空字段 + Alembic 迁移） |
| API 端点 | `POST /api/wechat-login`（**新增，待契约审批**） |
| UX 屏幕 | §2.1 登录/绑定页（新增） |
| 前端路由 | `/pages/index/index`（占位）、`/pages/login/index` |

### 后端工作

1. **`Parent.openid` 字段**
   - `Parent` 模型加 `openid VARCHAR(64) NULLABLE UNIQUE`
   - Alembic 迁移（forward-only，见架构 §8）
2. **`wechat-login` 端点** `routers/wechat.py`
   - 请求 `{code, phone?}`；`httpx` 调 `jscode2session` 换 openid
   - 有 phone：upsert `Parent(phone)` + 绑定 `Parent.openid`，返回 `{phone}`
   - 无 phone：按 openid 反查 → 200 `{phone}` 或 404（未绑定）
   - code 无效/过期 → 401
3. **环境变量**
   - `WECHAT_APPID`、`WECHAT_APP_SECRET`（密钥，不入库）
4. **端点测试**（mock `code2session`）
   - 绑定、查询、401（code 无效）、404（未绑定）、openid 换绑

### 前端工作

1. **Taro 工程初始化**（`apps/miniapp/`）
   - `@tarojs/cli` + React + TypeScript，`app.config.ts` 注册 2 个 tab + 登录页
   - `project.config.json`（appid 占位，内测用测试号）
2. **共享类型包** `packages/api-types/`
   - 从 `apps/frontend/src/types.ts` 抽取，tsconfig `paths` 引用
   - 新增 `WechatLoginRequest`/`WechatLoginResponse` 类型
3. **transport 层**（`apps/miniapp/src/lib/api.ts`）
   - `Taro.request`/`Taro.uploadFile` + `Taro.getStorageSync` 实现
   - 签名对齐 Web（`apiGet/apiPost/apiPut/apiPatch/apiDelete/apiUpload`）
4. **登录/绑定页** `/pages/login/index`
   - 手机号输入 + `wx.login()` + `POST /api/wechat-login` + 缓存 phone
   - 静默登录：有缓存则 `wx.login()` → `POST {code}` → 200 进首页 / 404 回登录
5. **首页占位**（tabBar 2 项，空态"功能建设中"）

### 验收标准

- [ ] **AC-W1.1:** `npm run build:weapp` 构建成功，开发者工具可打开
- [ ] **AC-W1.2:** `alembic upgrade head` 后 `Parent` 表含 `openid` 字段
- [ ] **AC-W1.3:** 首次绑定：`POST /api/wechat-login {code, phone}` → 200 `{phone}`，openid 落库
- [ ] **AC-W1.4:** 静默登录：`POST {code}` → 200 返回已绑定 phone；未绑定 → 404
- [ ] **AC-W1.5:** code 无效 → 401
- [ ] **AC-W1.6:** 登录页输入手机号 → 绑定成功 → 缓存 phone → 进首页
- [ ] **AC-W1.7:** 已有缓存时静默登录无感知进首页
- [ ] **AC-W1.8:** 后端 `pytest tests/ -v` 全绿（wechat-login 测试 mock code2session）

### 完成标志

```bash
cd apps/backend && python -m pytest tests/ -v                 # 全绿
cd apps/miniapp && npm install && npm run build:weapp          # 构建成功
# 开发者工具：真机/模拟器走通 输入手机号 → 绑定 → 进首页
```

---

## W2: 核心批改闭环

**目标：** 小朋友管理 + 拍照上传 → 批改中 → 批改结果（含人工修正）。结束后用户在微信内即可完成一次完整试卷批改。

**工期预期：** 2–2.5 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-09（核心批改闭环）、F-10（小朋友管理） |
| 数据模型 | 无新增（复用 `Child`/`Submission`/`GradedQuestion`） |
| API 端点 | 复用 `POST /api/submissions`、`GET /api/submissions/{id}`、`PATCH .../questions/{qid}`、`GET/POST/PUT/DELETE /api/children` |
| UX 屏幕 | §2.2 首页、§2.3 小朋友管理、§2.4 批改中、§2.5 批改结果 |
| 前端路由 | `/pages/index`、`/pages/children`、`/pages/processing`、`/pages/result` |

### 后端工作

- 无新增（复用现有 11 端点）。确认图片 URL 由请求 host 自动拼接正确（内测 IP:port 场景可用；正式 HTTPS 域名前需 `PUBLIC_BASE_URL`，见 W4）。

### 前端工作

1. **小朋友管理页** `/pages/children`
   - 列表（名字 + 已批改次数）、新增/编辑/删除（`wx.showModal` 确认）、预置"小朋友1/2"
2. **首页激活** `/pages/index`
   - `wx.chooseMedia` + `wx.showActionSheet`（拍照/相册）
   - `Taro.compressImage`/canvas 压缩（≤2048px，Q80%）
   - `wx.uploadFile`（image + subject + child_id + phone）→ 202 → 跳批改中
3. **批改中页** `/pages/processing`
   - 旋转 ✏️ 动画 + 轮播文案 + 不确定进度条
   - `setInterval` 2s 轮询；`onHide` 暂停、`onShow` 恢复并立即查询
   - completed → redirectTo 结果；failed → 错误 + 重试；30s 超时提示
4. **批改结果页** `/pages/result`
   - 得分概览卡片 + `<image mode="widthFix">` + `wx.previewImage` 缩放
   - 逐题明细（题号/题型/✓/？/解题思路）+ 人工修正开关（PATCH）
5. **组件测试**：上传选择、批改中轮询、结果渲染、修正开关

### 验收标准

- [ ] **AC-W2.1:** 可拍照/相册选图，压缩后 ≤2048px JPEG
- [ ] **AC-W2.2:** 上传返回 202，自动跳批改中
- [ ] **AC-W2.3:** 批改中每 2s 轮询，完成后自动跳结果页
- [ ] **AC-W2.4:** 结果页显示批改后图片（绿勾/红问号标注）+ 得分 + 逐题明细
- [ ] **AC-W2.5:** 点图片进 `wx.previewImage` 全屏缩放
- [ ] **AC-W2.6:** 人工修正：改判 → 得分实时更新；失败回弹
- [ ] **AC-W2.7:** 小朋友 CRUD 完整可用（含加载/空/错误状态）
- [ ] **AC-W2.8:** 批改失败/超时正确显示错误与重试

### 完成标志

```bash
cd apps/miniapp && npm run build:weapp && npm test        # 构建 + 组件测试通过
# 开发者工具/真机：拍照 → 批改 → 结果 → 人工修正，端到端走通
```

---

## W3: 历史浏览 + 错题集

**目标：** 历史列表 + 历史详情（含人工修正）+ 错题集 + 错题试卷生成。结束后家长可回溯过往批改并整理错题。

**工期预期：** 1–1.5 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-11（历史记录浏览）、F-06（错题集）、F-07（错题试卷生成） |
| 数据模型 | 无新增 |
| API 端点 | 复用 `GET /api/submissions`、`GET /api/submissions/{id}`、`PATCH .../questions/{qid}`、`GET /api/error-collections`、`POST /api/error-collections/generate` |
| UX 屏幕 | §2.6 历史列表、§2.7 历史详情、§2.8 错题集、§2.9 错题试卷生成 |
| 前端路由 | `/pages/history`、`/pages/history-detail`、`/pages/error-book`、`/pages/error-generate` |

### 后端工作

- 无新增。

### 前端工作

1. **历史列表页** `/pages/history`
   - 筛选栏（小朋友/学科 `picker`）+ 记录卡片（缩略图 + 学科 + 得分 + 相对时间）
   - `onReachBottom` 上拉加载更多（默认 20 条/页）
   - 点击卡片 → navigateTo 详情
2. **历史详情页** `/pages/history-detail`
   - 原图 | 批改后 分段切换 + 得分 + 逐题明细 + 人工修正
3. **错题集页** `/pages/error-book`（底部第三个 tab）
   - 可折叠筛选（小朋友/学科/题型/时间 `picker`）+ 错题统计 + 错题卡片 + 展开解题思路
   - 底部固定「生成错题试卷」→ navigateTo 生成页
4. **错题试卷生成页** `/pages/error-generate`
   - 参数表单（小朋友/学科/题型多选/题数）+ 生成按钮 + 合成图预览
5. **组件测试**：列表渲染 + 空状态 + 加载更多、详情切换 + 修正、错题筛选/展开、生成成功/失败

### 验收标准

- [ ] **AC-W3.1:** 历史列表按时间倒序展示，可按小朋友/学科筛选
- [ ] **AC-W3.2:** 上拉加载更多正确分页
- [ ] **AC-W3.3:** 详情页可切换原图/批改后，逐题明细 + 人工修正可用
- [ ] **AC-W3.4:** 空状态显示"还没有批改记录…"+"去批改"按钮
- [ ] **AC-W3.5:** 跨手机号数据隔离（列表与详情）
- [ ] **AC-W3.6:** 错题集可折叠筛选 + 统计 + 展开解题思路，底部「生成错题试卷」跳转生成页
- [ ] **AC-W3.7:** 错题试卷生成页参数表单可生成并预览合成图

### 完成标志

```bash
cd apps/miniapp && npm run build:weapp && npm test        # 构建 + 组件测试通过
# 真机：历史 tab → 列表 → 详情 → 人工修正 走通
```

---

## W4: 内测打磨

**目标：** 真机体验版验证（含"打开调试"流程）、全状态覆盖、品牌合规、性能达标。结束后可交付家人体验版试用。

**工期预期：** 0.5–1 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-09~F-12 全部 + 非功能 |
| 全局 | 状态覆盖审计、品牌合规（design-enforcement）、真机体验版、密钥/归属校验确认 |

### 后端工作

1. **归属校验确认**：复用现有跨资源归属校验，无越权路径
2. **密钥与配置**：`WECHAT_APPID/SECRET`、`GLM_API_KEY` 均来自环境变量；`.env` 在 `.gitignore`
3. **图片 URL 基址**：确认内测请求 host 自动正确；记录正式发布前需 `PUBLIC_BASE_URL`（见 AD-17）

### 前端工作

1. **全状态覆盖审计**：逐屏核对 loading/empty/error/success，补齐缺失状态
2. **品牌合规**：跑 `design-enforcement`，通过反通用化检查清单（禁灰色、圆角区分、3 字号/间距）
3. **真机体验版**：上传代码设为体验版，家人各机手动"打开调试"验证域名绕过
4. **性能**：首屏 < 2s、图片懒加载、`<image lazy-load>`
5. **触控**：目标 ≥88rpx，按钮 `hover-class` 反馈

### 验收标准

- [ ] **AC-W4.1:** 7 屏全状态覆盖，无白屏/无反馈死角
- [ ] **AC-W4.2:** 品牌合规通过（design-enforcement，≥ 27/32）
- [ ] **AC-W4.3:** 真机体验版走通"打开调试"后拍照→批改→历史全流程
- [ ] **AC-W4.4:** 首屏 < 2s，图片懒加载生效
- [ ] **AC-W4.5:** 无硬编码密钥；归属校验无越权
- [ ] **AC-W4.6:** `npx tsc --noEmit` + `npm test` + 后端 `pytest`/`ruff` 全绿

### 完成标志

```bash
cd apps/backend && ruff check . && python -m pytest tests/ -v        # 零错误 + 全绿
cd apps/miniapp && npx tsc --noEmit && npm test && npm run build:weapp  # 类型+测试+构建
# 真机体验版：家人各机"打开调试"验证；记录备案+HTTPS 为正式发布待办
```

---

## 阶段依赖关系

```
W1 (骨架+认证)
  └──→ W2 (核心批改闭环)
          └──→ W3 (历史浏览)
                  └──→ W4 (内测打磨)
```

- W2 依赖 W1（需 Taro 工程 + 登录态 + 共享类型 + transport）
- W3 依赖 W2（需 Submission 数据与批改结果）
- W4 依赖所有前序功能完整

W2 与 W3 可部分并行：W2 完成批改链路后，W3 的历史列表/详情（纯前端 + 复用端点）即可开始。

---

## 功能覆盖矩阵

| PRD 功能 | W1 | W2 | W3 | W4 |
|----------|:--:|:--:|:--:|:--:|
| F-09 核心批改闭环 | | ● | | |
| F-10 小朋友管理 | | ● | | |
| F-11 历史浏览 | | | ● | |
| F-12 身份与跨端一致 | ● | | | ● |
| F-06 错题集（复用 Web） | | | ● | |
| F-07 错题试卷生成（复用 Web） | | | ● | |

## API 端点覆盖矩阵

| 端点 | W1 | W2 | W3 | W4 |
|------|:--:|:--:|:--:|:--:|
| `POST /api/wechat-login`（新增） | ● | | | |
| `GET/POST/PUT/DELETE /api/children` | | ● | | |
| `POST /api/submissions` | | ● | | |
| `GET /api/submissions/{id}` | | ● | ● | |
| `PATCH .../questions/{qid}` | | ● | ● | |
| `GET /api/submissions` | | | ● | |
| `GET /api/error-collections` | | | ● | |
| `POST /api/error-collections/generate` | | | ● | |

## UX 屏幕覆盖矩阵

| 屏幕 | W1 | W2 | W3 | W4 |
|------|:--:|:--:|:--:|:--:|
| 1. 登录/绑定 | ● | | | |
| 2. 批改上传（首页）| 占位 | ● | | |
| 3. 小朋友管理 | | ● | | |
| 4. 批改中 | | ● | | |
| 5. 批改结果 | | ● | | |
| 6. 历史列表 | | | ● | |
| 7. 历史详情 | | | ● | |
| 8. 错题集 | | | ● | |
| 9. 错题试卷生成 | | | ● | |

累计：W1 (1 屏) → W2 (新增 4 屏) → W3 (新增 4 屏) → W4 (9 屏全量打磨)。
