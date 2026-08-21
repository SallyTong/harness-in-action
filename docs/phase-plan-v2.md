# AI 作业批改工具 — v2 实施阶段计划

## 文档信息

| 字段     | 值                                                                  |
| -------- | ------------------------------------------------------------------- |
| 版本     | v0.1.0                                                              |
| 日期     | 2026-08-16                                                          |
| 作者     | sally                                                               |
| 依据     | `docs/prd-v2.md` v0.1.0、`docs/architecture-v2.md` v0.1.0、`docs/contract-changes-v2.md` v0.1.0、`contracts/openapi.yaml` v0.1.1 |

---

## 阶段总览

| 阶段 | 名称 | 核心交付 | 累计可用 |
|------|------|---------|---------|
| X1 | 认证登录 | 短信验证码 + JWT + 去 phone 化 + 签名 URL | 全站 Bearer 鉴权可用 |
| X2 | 视觉模型抽象 | `VisionModel` + GLM/Qwen 实现 + 成本日志 | 模型可切换 |
| X3 | 错题题干文字 | prompt 输出题干 + 落库 + 展示 | 错题有文字描述 |
| X4 | 文字试卷 + Word | 模板拼装 + .docx 导出 + 格式切换 | 🎯 文字试卷可打印 |
| X5 | 儿童编辑 | Child 字段扩展 + 小程序管理页 + Web 同步 | 小朋友管理完整 |

每阶段产出**独立可验证的工作增量**——上一阶段不依赖下一阶段的任何代码。

> ⚠️ **契约审批前置**：X1 涉及 `contracts/openapi.yaml` 的破坏性变更（变更 2/3/4）、X3~X5 涉及字段扩展（变更 5/6/7）。依 CLAUDE.md「契约治理」规则，须先人工审批 `docs/contract-changes-v2.md`，再进入对应阶段的实现。X1 开工前至少需审批变更 1/2/3/4。

---

## X1: 认证登录

**目标：** 以「手机号 + 短信验证码 + 纯 JWT」取代 phone 信任模型；所有业务端点切换 Bearer 鉴权，图片改签名 URL。结束后 Web 与小程序统一走短信登录，业务 URL 不再携带 phone。

**工期预期：** 2–2.5 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-13（登录/登出） |
| 架构决策 | AD-18（JWT 会话）、AD-19（phone→userId）、AD-20（签名 URL） |
| 数据模型 | 无核心变更（验证码存内存/DB，实现时定） |
| API 端点 | `POST /api/auth/send-code`、`POST /api/auth/login`（**新增**）；现有端点全部去 phone 化 + 图片签名 URL（**破坏性变更**）；移除 `POST /api/wechat-login`（**破坏性**） |
| 前端 | Web 登录页、小程序登录页、transport 层切 Bearer、登出 |

### 后端工作

1. **验证码服务** `app/services/sms.py`
   - 阿里云短信发送 6 位验证码；内存（单机）或 DB 存储，5 分钟 TTL + 60 秒重发限流
   - 环境变量 `SMS_ACCESS_KEY_ID/SECRET`、`SMS_SIGN_NAME`、`SMS_TEMPLATE_CODE`
2. **auth 端点** `routers/auth.py`
   - `POST /api/auth/send-code {phone}` → 200 `{retry_after}` / 429（限流）
   - `POST /api/auth/login {phone, code}` → 校验 → 签发 JWT（sub=Parent.id, exp=30d, HS256）→ `{token, token_type, expires_at, user_id}`；Parent 不存在自动创建
3. **JWT 依赖注入** `app/deps/auth.py`
   - `get_current_parent_id(Authorization)` 验签 + exp → 返回 parent_id；替换现有 `get_parent(phone)` 依赖
   - 环境变量 `JWT_SECRET`
4. **去 phone 化**（所有业务端点）
   - 移除 `phone` query / `X-Parent-Phone` 头；依赖注入改从 token 取 parent_id；归属校验沿 FK 链不变
5. **签名 URL** `app/services/image_signing.py`
   - HMAC 签名 token + expires（默认 1h）；图片端点 `GET /api/images/{kind}/{filename}` 改验签名 + 归属
   - 环境变量 `IMAGE_SIGNING_SECRET`
6. **移除 `wechat-login`**（小程序登录与 Web 统一）
   - 移除后端 `POST /api/wechat-login` 端点及 `WechatLoginRequest`；既有 W1~W4 实现的端点 + 小程序调用一并清除
   - 小程序改用 SMS 登录（`send-code` + `login`，与 Web 完全一致），JWT 缓存本地存储；`Parent.openid` 列保留但不再读写
7. **端点测试**（mock 短信 + JWT）
   - 发码（200/429）、登录（200/401/首次注册）、去 phone 化后各端点鉴权（无 token→401、错误 token→401、跨用户→404）、图片签名（有效/过期/篡改→403）

### 前端工作（Web + 小程序）

1. **登录页**（Web `/login` 新增；小程序 `/pages/login` 改造）
   - 手机号输入 + 验证码输入 + 倒计时重发（60s）+ 「登录」
   - 成功后存 token（localStorage / `Taro.setStorageSync`）
2. **transport 层**（`lib/api.ts` 两端）
   - 统一注入 `Authorization: Bearer <token>`；移除 `?phone=` 拼接
   - 401 处理：清 token → 跳登录页
3. **登出**：登录页/个人入口的「登出」按钮 → 清 token → 回登录页（服务端无端点）
4. **图片渲染**：改用 API 返回的已签名 `image_url`/`thumbnail_url`（不再手工拼 phone）

### 验收标准

- [ ] **AC-X1.1:** `POST /api/auth/send-code` 发码成功，60s 内重发返回 429
- [ ] **AC-X1.2:** `POST /api/auth/login` 正确验证码 → 200 + JWT；错误/过期 → 401；新 phone 首次登录自动建 Parent
- [ ] **AC-X1.3:** 携带 JWT 访问 `GET /api/children` → 200；无 token → 401；跨用户资源 → 404
- [ ] **AC-X1.4:** 业务 URL 全程无 phone；JWT 验签失败/过期 → 401
- [ ] **AC-X1.5:** 图片签名 URL 有效期内 `<img>` 可加载；过期/篡改 → 403
- [ ] **AC-X1.6:** Web 登录页走通 手机号→验证码→进首页；登出清 token 回登录页
- [ ] **AC-X1.7:** 小程序登录页走通 手机号→验证码→进首页（与 Web 统一，无 `wechat-login`）；JWT 缓存本地、30 天内免重复登录
- [ ] **AC-X1.8:** 后端 `pytest` 全绿（短信/JWT 全程 mock）；Web/小程序 `tsc` + 测试 + 构建通过

### 完成标志

```bash
cd apps/backend && ruff check . && python -m pytest tests/ -v
# 登录流程：
curl -X POST localhost:8000/api/auth/send-code -H 'Content-Type: application/json' -d '{"phone":"13800138000"}'   # → 200
curl -X POST localhost:8000/api/auth/login -H 'Content-Type: application/json' -d '{"phone":"13800138000","code":"123456"}'  # → {token,...}
curl localhost:8000/api/children -H "Authorization: Bearer $TOKEN"     # → 200 列表（无 phone）
cd apps/frontend && npx tsc --noEmit && npx vitest run && npm run build
cd apps/miniapp && npx tsc --noEmit && npm test && npm run build:weapp
```

---

## X2: 视觉模型抽象

**目标：** 将写死 GLM 的批改调用重构为 `VisionModel` 抽象，新增 Qwen-VL 实现，环境变量切换，成本日志支持多供应商。

**工期预期：** 1–1.5 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-14（模型切换） |
| 架构决策 | AD-21（VisionModel 抽象）、AD-22（无文本模型 + 多供应商成本日志） |
| 数据模型 | `Submission.token_usage` 结构扩展（+ provider/model，向后兼容旧记录） |
| API 端点 | 无新增（内部重构） |
| 前端 | 无（切换前端不可见） |

### 后端工作

1. **`VisionModel` 接口** `app/services/vision/base.py`
   - `grade(image, subject) -> GradingResult`（含题干字段占位，X3 激活）
   - `GradedQuestionData` / `GradingResult` / `TokenUsage` 数据结构
2. **`GLMVisionModel`**：重构现有 `glm_client.py` 为实现类，行为不变
3. **`QwenVisionModel`**：新增，调阿里云百炼 OpenAI 兼容接口；prompt 与 GLM 对齐，输出 schema 对齐 `GradedQuestion`
4. **工厂 + 配置**：`VISION_PROVIDER=glm|qwen`、`VISION_MODEL`、`QWEN_API_KEY`
5. **成本日志**：`token_usage` 记录 `provider` + `model`
6. **测试**：两实现 mock 各自 API，断言输出 schema 一致；切换 provider 后批改流水线输出不变

### 验收标准

- [ ] **AC-X2.1:** `VisionModel` 接口定义清晰，GLM/Qwen 两实现共享同一接口
- [ ] **AC-X2.2:** `VISION_PROVIDER=glm` 走 GLM 路径、`=qwen` 走 Qwen 路径（mock 验证）
- [ ] **AC-X2.3:** 两实现输出 schema 与 `GradedQuestion` 对齐，切换不影响下游（标注/错题同步）
- [ ] **AC-X2.4:** `token_usage` 含 `provider` + `model`；旧记录读取兼容
- [ ] **AC-X2.5:** 后端 `pytest` 全绿（两 provider 全程 mock，不消耗真实额度）

### 完成标志

```bash
cd apps/backend && ruff check . && python -m pytest tests/ -v
# 手动：分别设 VISION_PROVIDER=glm / =qwen 上传测试图，批改结果结构一致
```

---

## X3: 错题题干文字

**目标：** 批改 prompt 输出完整题干（英语纯文本 / 数学 LaTeX），落库 `GradedQuestion` + 冗余 `ErrorQuestion`，错题集/详情展示文字。

**工期预期：** 1–1.5 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-16（错题文字描述） |
| 架构决策 | AD-23（题干落库）、AD-24（流水线扩展 + OCR 预留） |
| 数据模型 | `GradedQuestion` + `question_text`/`question_latex`；`ErrorQuestion` 冗余同字段（forward-only 迁移） |
| API 端点 | 无新增（`GradedQuestion`/`ErrorQuestion` schema 扩展，向后兼容） |
| 前端 | 错题集/详情展示题干；Web KaTeX 渲染数学题；小程序截图为主 |

### 后端工作

1. **迁移**：`GradedQuestion` / `ErrorQuestion` 加 `question_text` TEXT NULL + `question_latex` TEXT NULL
2. **prompt 扩展**：`VisionModel` 输出增加 `question_text`（英语）/ `question_latex`（数学）
3. **落库 + 冗余**：批改解析写 `GradedQuestion`；错题集同步时冗余到 `ErrorQuestion`（同事务）
4. **`QuestionTextExtractor` 预留点**：定义抽象，当前 `VisionModelExtractor` 实现；OCR 实现留空
5. **测试**：mock 批改返回含题干字段；断言 `GradedQuestion`/`ErrorQuestion` 两表字段一致落库

### 前端工作

1. **错题集/详情**：错题卡片加题干文字展示；数学题 Web 端 KaTeX 渲染 `question_latex`
2. **小程序**：错题详情数学题以截图为主、文字为辅（不渲染 LaTeX）

### 验收标准

- [ ] **AC-X3.1:** 批改后 `GradedQuestion.question_text`（英语）/ `question_latex`（数学）落库
- [ ] **AC-X3.2:** 错题同步后 `ErrorQuestion` 冗余同两字段，与 `GradedQuestion` 一致
- [ ] **AC-X3.3:** 错题集 API 返回题干字段（可空，向后兼容）
- [ ] **AC-X3.4:** Web 错题集/详情展示题干；数学 LaTeX 用 KaTeX 正确渲染
- [ ] **AC-X3.5:** 小程序数学题截图为主、文字为辅，不报错
- [ ] **AC-X3.6:** 后端 `pytest` 全绿；Web/小程序 `tsc` + 测试通过

### 完成标志

```bash
cd apps/backend && ruff check . && python -m pytest tests/ -v
cd apps/frontend && npx tsc --noEmit && npx vitest run
cd apps/miniapp && npx tsc --noEmit && npm test
```

---

## X4: 文字试卷 + Word 导出

**目标：** 错题试卷默认文字试卷（模板拼装），支持 .docx 导出；图片方案保留为可切换格式。

**工期预期：** 2–2.5 天（含小程序）

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-17（文字试卷 + Word） |
| 架构决策 | AD-25（模板拼装）、AD-26（python-docx + LaTeX→PNG） |
| 数据模型 | 无新增（复用 `ErrorQuestion.question_text/question_latex`） |
| API 端点 | `POST /api/error-collections/generate` + `format`（**向后兼容**）；响应 `GeneratedSheet` |
| 前端 | Web：格式切换、文字预览（KaTeX）、docx 下载；小程序：格式切换、文字预览（截图兜底）、docx 预览 |

### 后端工作

1. **文字试卷拼装** `app/services/sheet_text.py`
   - 按筛选条件从 `ErrorQuestion` 随机取题干（`question_text`/`question_latex`）
   - 标题栏（小朋友名 + 学科 + 日期）+ 题干 + 作答空白区；残缺题干回退题目截图
2. **`.docx` 导出** `app/services/sheet_docx.py`
   - python-docx 生成；数学 `question_latex` 渲染 PNG（matplotlib mathtext / MathJax 离线）嵌入；不含标准答案
3. **`generate` 端点**：+ `format`（默认 `image` 兼容）；`format=text` 返回 `{format, question_count, questions[], docx_url}`；`image` 保持现有 `{image_url, question_count}`
4. **测试**：文字试卷拼装（随机取/数量不足/残缺回退）、docx 生成（含 LaTeX→PNG）、format 参数（默认 image 兼容、text 新结构）

### 前端工作（Web）

1. **生成页**：+ 「试卷格式」分段控件（文字默认 / 图片）
2. **文字试卷预览**：拿到 `questions` 后 HTML 渲染题干（数学 KaTeX）
3. **下载**：`.docx` 下载按钮

### 前端工作（小程序）

1. **生成页**（`/pages/error-generate`）：+ 「试卷格式」分段控件（文字默认 / 图片）
2. **文字试卷预览**：题干文字为主、数学题截图兜底（小程序内不渲染 LaTeX）
3. **docx 预览**：`wx.downloadFile` 下载 → `wx.openDocument({ fileType: 'docx' })` 预览（不落手机系统文件）

### 验收标准

- [ ] **AC-X4.1:** `format=text` 返回结构化题目列表 + `docx_url`；`format=image`（或不传）返回现有 `image_url`（向后兼容）
- [ ] **AC-X4.2:** 文字试卷含标题栏 + 题干 + 作答空白区，题干来自 `question_text`/`question_latex`
- [ ] **AC-X4.3:** .docx 可下载打开，数学公式以 PNG 嵌入，不含标准答案
- [ ] **AC-X4.4:** 生成页默认「文字」，可切「图片」
- [ ] **AC-X4.5:** 符合条件的错题不足 count 时返回实际数量（不补空白题）
- [ ] **AC-X4.6:** 后端 `pytest` 全绿；Web/小程序 `tsc` + 测试通过
- [ ] **AC-X4.7:** 小程序生成页「文字/图片」切换；文字预览数学题截图兜底不渲染 LaTeX；docx 经 `wx.openDocument` 预览

### 完成标志

```bash
cd apps/backend && ruff check . && python -m pytest tests/ -v
# 生成文字试卷 + 下载 docx：
curl -X POST localhost:8000/api/error-collections/generate -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"child_id":1,"subject":"math","count":10,"format":"text"}'  # → {questions[], docx_url}
cd apps/frontend && npx tsc --noEmit && npx vitest run && npm run build
cd apps/miniapp && npx tsc --noEmit && npm test && npm run build:weapp
```

---

## X5: 儿童编辑

**目标：** `Child` 扩展年级/备注/头像（预留）字段，补齐小程序完整管理页，Web 端同步支持新字段编辑。

**工期预期：** 1–1.5 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-15（小程序编辑小朋友） |
| 数据模型 | `Child` + `grade`（必填默认「五年级」）/ `note`（可空）/ `avatar`（预留可空） |
| API 端点 | `POST/PUT /api/children` 请求体 + `grade`/`note`；`Child` schema + 字段（向后兼容） |
| 前端 | 小程序 `/pages/children` 管理页；Web `ChildrenPage` 同步 |

### 后端工作

1. **迁移**：`Child` + `grade` VARCHAR(20) NOT NULL DEFAULT '五年级'、`note` VARCHAR(200) NULL、`avatar` VARCHAR(500) NULL
2. **children 端点**：`POST/PUT` 接收 `grade`（缺省默认五年级）+ `note`（可选）；`Child` 响应 + `grade`/`note`/`avatar`
3. **测试**：创建带年级/备注、默认年级、年级枚举校验、跨家长隔离

### 前端工作

1. **小程序管理页** `/pages/children/index`（新增）
   - 列表（名字/年级/批改次数）、添加（名字+年级+备注）、编辑（改名/改年级/改备注）、删除（`wx.showModal` 确认，保留历史）
2. **首页入口**：小朋友选择区由「请先在网页版添加」改为跳转管理页
3. **Web `ChildrenPage`**：+ 年级/备注编辑（对齐小程序能力）

### 验收标准

- [ ] **AC-X5.1:** `Child` 迁移后含 `grade`（默认五年级）/`note`/`avatar`
- [ ] **AC-X5.2:** 创建小朋友可不传年级（落默认五年级）、可传年级+备注
- [ ] **AC-X5.3:** 小程序管理页完整增删改可用（含加载/空/错误状态），年级枚举选择
- [ ] **AC-X5.4:** Web `ChildrenPage` 支持年级/备注编辑，两端能力一致
- [ ] **AC-X5.5:** 首页小朋友选择区可跳转管理页
- [ ] **AC-X5.6:** 后端 `pytest` 全绿；Web/小程序 `tsc` + 测试 + 构建通过

### 完成标志

```bash
cd apps/backend && ruff check . && python -m pytest tests/ -v
cd apps/miniapp && npx tsc --noEmit && npm test && npm run build:weapp
cd apps/frontend && npx tsc --noEmit && npx vitest run
```

---

## 阶段依赖关系

```
X1 (认证)
  ├──→ X2 (模型抽象) ──→ X3 (错题文本) ──→ X4 (文字试卷)
  └──→ X5 (儿童编辑，可与 X2–X4 并行)
```

- **X2 依赖 X1**：模型抽象虽不直接依赖认证，但流水线改造在 JWT 地基上更顺；且 X1 后全站鉴权稳定，便于 X2 重构。
- **X3 依赖 X2**：题干输出字段要建立在 `VisionModel` 接口之上（协同设计，见 AD-24）。
- **X4 依赖 X3**：文字试卷原料是 X3 落库的 `question_text`/`question_latex`（核心依赖链）。
- **X5 依赖 X1**（children 端点已去 phone 化），相对独立，可与 X2–X4 并行。

---

## 功能覆盖矩阵

| PRD 功能 | X1 | X2 | X3 | X4 | X5 |
|----------|:--:|:--:|:--:|:--:|:--:|
| F-13 登录/登出 | ● | | | | |
| F-14 模型切换 | | ● | | | |
| F-15 儿童编辑 | | | | | ● |
| F-16 错题文字 | | | ● | | |
| F-17 文字试卷 + Word | | | | ● | |

## API 端点覆盖矩阵

| 端点 | X1 | X2 | X3 | X4 | X5 |
|------|:--:|:--:|:--:|:--:|:--:|
| `POST /api/auth/send-code`（新增） | ● | | | | |
| `POST /api/auth/login`（新增） | ● | | | | |
| 全部现有端点去 phone 化 + Bearer | ● | | | | |
| `GET /api/images/{kind}/{filename}` 签名 URL | ● | | | | |
| 移除 `POST /api/wechat-login` | ● | | | | |
| `POST/GET /api/submissions`（内部 VisionModel） | | ● | | | |
| `GradedQuestion`/`ErrorQuestion` schema（题干） | | | ● | | |
| `POST /api/error-collections/generate`（format） | | | | ● | |
| `POST/PUT /api/children`（grade/note） | | | | | ● |
