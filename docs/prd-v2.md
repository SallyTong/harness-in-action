# AI 作业批改工具 — v2 新增功能附录（PRD）

## 文档信息

| 字段     | 值                                                                                         |
| -------- | ------------------------------------------------------------------------------------------ |
| 版本     | v0.1.0                                                                                     |
| 日期     | 2026-08-16                                                                                 |
| 作者     | sally                                                                                      |
| 依据     | `docs/prd.md` v1.1、`docs/prd-wechat-miniapp.md` v0.1.2、`docs/architecture.md` v1.1、`docs/architecture-wechat-miniapp.md` v0.1.0、`contracts/openapi.yaml` v0.1.1、作用域化访谈 |
| 变更说明 | 初始版本 — 5 个 v2 功能（登录/模型切换/小朋友编辑/错题文字/文字试卷）。 |

---

## 0. 范围与编号说明

本文档是 `docs/prd.md`（v1.1）与 `docs/prd-wechat-miniapp.md`（v0.1.2）的**增量附录**，记录 v2 阶段新增的 5 个功能。

现有功能编号已用到 **F-12**（小程序 PRD「手机号身份与跨端一致」），故本附录自 **F-13** 起：

| 编号 | 功能                                   | 主用端       | 优先级 |
| ---- | -------------------------------------- | ------------ | ------ |
| F-13 | 用户登录/登出（Web + 小程序统一短信登录） | Web + 小程序 | MUST   |
| F-14 | 视觉模型切换（GLM-4V / Qwen-VL）       | 后端         | MUST   |
| F-15 | 小程序编辑小朋友（含 Child 字段扩展）  | Web + 小程序 | MUST   |
| F-16 | 错题保存题目文字描述                   | 后端 + 两端  | MUST   |
| F-17 | 错题集文字试卷 + Word 导出             | Web + 小程序 | SHOULD |

---

## 1. 功能需求

### F-13: 用户登录/登出（Web + 小程序统一短信登录） [MUST]

以**手机号 + 短信验证码**登录取代现有的「phone 信任模型」（无验证、URL 携带 phone）。登录后签发 JWT，业务请求改用 Bearer 鉴权，业务 URL 与图片 URL 彻底移除 phone。Web 端与小程序端走**同一套**短信验证码登录逻辑。

- **AC-01:** 登录页输入 11 位手机号（前端格式校验 `^\d{11}$`），点击「获取验证码」经阿里云短信发送 6 位数字验证码。
- **AC-02:** 验证码有效期 5 分钟；同一手机号 60 秒内不可重发；校验失败不区分「验证码错误 / 已过期」，统一提示重新获取。
- **AC-03:** 输入验证码提交登录，校验通过后签发 JWT（`sub` = `Parent.id`、`exp` = 30 天、HS256）。`Parent` 不存在则自动创建（`phone` UNIQUE 就位），实现「首次登录即注册」。
- **AC-04:** 后续业务请求携带 `Authorization: Bearer <token>`；后端验签 + 校验 `exp`，从 `sub` 解出 userId（即 `Parent.id`）定位家长、做数据隔离。
- **AC-05:** 业务 URL 不再出现 `phone`（query 或 `X-Parent-Phone` 头均移除）；`phone` 仅出现在登录/发码两个环节。
- **AC-06:** 登出 = 前端清除本地 token 并返回登录页；**服务端不撤销**（纯 JWT，token 在 `exp` 前仍有效）。
- **AC-07:** 图片端点改为**签名 URL**：API 返回图片地址时附带 HMAC 短期签名 token（`?token=…&expires=…`，默认 1 小时有效），`<img>` / `<image>` 可直接加载，无需请求头。
- **AC-08:** 小程序登录与 Web **完全统一**（手机号 + 验证码），共用 `POST /api/auth/send-code` + `POST /api/auth/login`；不上 `getPhoneNumber`，**不保留** `wechat-login` / openid 静默登录路径；登录后 JWT 缓存于小程序本地存储，30 天有效期内免重复登录。
- **AC-09:** 无存量用户，无需数据迁移；`Parent.phone` UNIQUE 保留，JWT 无状态会话不要求 `Parent` 新增会话字段。

### F-14: 视觉模型切换（GLM-4V / Qwen-VL）[MUST]

将批改服务的模型调用从「写死 GLM」重构为可切换的**视觉模型抽象**，支持 GLM-4V 与 Qwen-VL 两家，DeepSeek 预留扩展点。切换为**运维层**行为（环境变量），前端不可见、不可选。不引入文本模型。

- **AC-01:** 定义 `VisionModel` 抽象接口：输入（试卷图片 + 学科）→ 输出（结构化批改结果 + 题干文字，见 F-16）。现有 GLM 调用重构为其中一个实现。
- **AC-02:** 新增 Qwen-VL 实现（调用阿里云百炼 OpenAI 兼容接口），与 GLM 实现共享同一接口，输出 schema 与 `GradedQuestion` 结构对齐。
- **AC-03:** 通过环境变量（如 `VISION_PROVIDER=glm|qwen` + 对应模型名）切换，改后重启生效；前端不可见、不可选。
- **AC-04:** DeepSeek 预留扩展点（接口设计到位，实现类待其官方视觉 API 明朗后补充，不做任何 DeepSeek 相关代码路径）。
- **AC-05:** token 消耗记录沿用现有机制（`prompt_tokens` / `completion_tokens` / `total_tokens`），每个 provider 独立记录，便于成本核算。
- **AC-06:** 切换 provider 不影响下游（批改标注、错题集同步、题干文字落库）——同一 `VisionModel` 接口保证替换透明。

### F-15: 小程序编辑小朋友（含 Child 字段扩展）[MUST]

为 `Child` 扩展年级 / 备注 / 头像（预留）字段，补齐小程序端的完整小朋友管理页（列表 / 添加 / 编辑 / 删除），Web 端 ChildrenPage 同步支持新字段编辑。后端 CRUD 复用现有 4 个端点并扩展其 schema。

- **AC-01:** `Child` 新增 `grade`（枚举 一年级~六年级）、`note`（VARCHAR(200) 可空）、`avatar`（VARCHAR(500) 可空，预留），Alembic forward-only 迁移。
- **AC-02:** `grade` 必填，默认「五年级」；新增小朋友时未选则落默认值。
- **AC-03:** `note` 可空，最长 200 字符，纯展示，不参与任何业务逻辑。
- **AC-04:** `avatar` 预留字段，本期**不实现图片上传、不展示、不可编辑**。
- **AC-05:** `POST /api/children` 与 `PUT /api/children/{id}` 请求体支持 `name` + `grade` + `note`（`avatar` 本期不接收）；`Child` schema 返回 `name` + `grade` + `note`（+ `avatar` 预留）。
- **AC-06:** 小程序新增 `/pages/children/index` 管理页：列表（名字 / 年级 / 已批改次数）、添加（名字 + 年级 + 备注）、编辑（改名 / 改年级 / 改备注）、删除（保留历史数据）。
- **AC-07:** Web `ChildrenPage` 同步支持年级 / 备注编辑，两端能力一致，避免「小程序能改年级、Web 只能改名字」的数据不一致。
- **AC-08:** 小程序首页小朋友选择区由「请先在网页版添加小朋友」改为可跳转管理页的入口。

### F-16: 错题保存题目文字描述 [MUST]

批改时由视觉模型**顺手输出完整题干文字**，随批改结果落库；错题集在截图之外多一份可检索、可复用的文字描述。英语题为纯文本，数学题为 LaTeX 题干。**不引入独立 OCR 引擎**，效果不足时再接 PaddleOCR / MinerU（预留）。

- **AC-01:** 批改 prompt 增加「题干文字」输出字段：英语题输出 `question_text`（纯文本题干），数学题输出 `question_latex`（LaTeX 题干，公式用 LaTeX 表达）。
- **AC-02:** `GradedQuestion` 新增 `question_text`（TEXT 可空）+ `question_latex`（TEXT 可空）。
- **AC-03:** `ErrorQuestion` 冗余 `question_text` + `question_latex`（沿用 `solution_note` / `error_category` 的物化缓存模式，错题集查询与试卷生成不回连批改表）。
- **AC-04:** 错题集列表 / 详情展示题干文字；Web 端数学 LaTeX 用 KaTeX 渲染。
- **AC-05:** 小程序端数学题以**截图为主、文字为辅**（小程序内不渲染 LaTeX，展示纯文本或「查看截图」）。
- **AC-06:** 题干文字**不支持人工修正**（本期仅自动转写 + 展示）。
- **AC-07:** 预留独立 OCR 引擎接入点（数学题文字质量不足时接 PaddleOCR / MinerU），不在本期实现。

### F-17: 错题集文字试卷 + Word 导出 [SHOULD]

生成错题试卷时，**默认输出文字试卷**（从错题集随机取题干文字拼装，无需 LLM），并支持导出 `.docx`；现有「图片拼图」方案保留为可切换格式。数学 LaTeX 公式渲染成 PNG 嵌入 Word。试卷不含标准答案。

- **AC-01:** 生成页新增「试卷格式」选项：**文字（默认）** / 图片，**生成时当场选、不持久化**。
- **AC-02:** 文字试卷 = 按筛选条件（学科 / 题型 / 时间 / 数量）从错题集随机取题干（`question_text` / `question_latex`）拼装为固定版式：标题栏（小朋友名字 + 学科 + 日期）+ 题干 + 作答空白区。
- **AC-03:** 图片试卷 = 保留现有截图拼图方案（`POST /api/error-collections/generate` 的图片输出路径不变）。
- **AC-04:** Word 导出用 python-docx；数学 `question_latex` 渲染成 PNG 嵌入；**不含标准答案**（学生重做用，答案家长看原卷即可）。
- **AC-05:** 文字试卷支持页面预览 + 下载 `.docx`。

---

## 2. 与现有系统的关系

### 2.1 复用（零改动）

- 数据模型主结构：`Parent` / `Submission` / 错题集一致性不变量（架构 §8）。
- 批改管线骨架：异步调度（202 + 轮询）、Pillow 图片标注、token 计费记录（F-14 仅替换模型调用实现，管线骨架复用）。
- 图片存储与路径约定（`data/images/` 及 §8 路径规范）。
- 错题集筛选 / 历史浏览 / 人工修正判定的现有端点与前端。
- 品牌设计系统与移动端优先规范（`.claude/rules/` 两套 conventions）。

### 2.2 改造

| 维度               | 现状                                   | v2 目标                                        |
| ------------------ | -------------------------------------- | ---------------------------------------------- |
| 身份机制           | `phone` 参数 / `X-Parent-Phone` 头      | `Authorization: Bearer <JWT>`（`sub`=Parent.id）|
| 图片鉴权           | `?phone=` 归属校验                     | 签名 URL（HMAC 短期 token）                     |
| 批改模型调用       | 写死 GLM-4V                            | `VisionModel` 抽象 + GLM/Qwen 实现              |
| `Child` 表         | 仅 `name`                              | + `grade` / `note` / `avatar`（预留）           |
| `children` 端点    | 仅 `name`                              | + `grade` / `note`                             |
| `GradedQuestion`   | 无题干文字                             | + `question_text` / `question_latex`           |
| `ErrorQuestion`    | 无题干文字                             | 冗余 + `question_text` / `question_latex`      |
| 错题试卷生成端点   | 仅输出图片                             | + `format`（text/image）+ docx 下载             |
| Web `ChildrenPage` | 仅改名                                 | + 年级 / 备注编辑                               |
| 小程序登录端点     | `POST /api/wechat-login`（openid 静默登录 + 设备绑定） | **移除**——小程序改用与 Web 统一的 SMS 登录 + 本地缓存 JWT |

### 2.3 新增

- 登录端点：`POST /api/auth/send-code`（发验证码）+ `POST /api/auth/login`（验证码换 JWT）。
- 短信服务集成（阿里云短信）。
- `VisionModel` 抽象 + Qwen-VL 实现。
- 签名 URL 生成与校验机制。
- 小程序 `/pages/children/index` 管理页。
- 文字试卷拼装 + `.docx` 导出（python-docx + LaTeX→PNG 渲染）。

---

## 3. 功能间依赖关系

| 依赖 | 说明 |
| ---- | ---- |
| **F-13 → 其余全部** | F-13 把身份从 phone 改为 JWT，是**全局前置**：F-15 的 children 端点改造、F-16 / F-17 的端点改造都建立在 JWT 鉴权之上。建议 F-13 先行。 |
| **F-14 ↔ F-16** | F-16 要求视觉模型多输出「题干文字」字段，应并入 `VisionModel` 接口设计。建议 F-14（抽象）与 F-16（输出扩展）**协同设计**，避免抽象完成后再改接口。 |
| **F-16 → F-17** | **核心依赖链**：F-17 文字试卷的原料是 F-16 存的 `question_text` / `question_latex`。没有 F-16 落库的题干文字，F-17 的文字试卷与 Word 导出「无米下锅」。 |
| F-15 | 相对独立，仅依赖 F-13 的 JWT 基础；与 F-16/F-17 无耦合。 |

**建议实施顺序**：F-13（认证地基）→ F-14 + F-16（模型抽象 + 题干落库，协同）→ F-17（消费题干文字）→ F-15（可与 F-16/F-17 并行）。

---

## 4. 数据模型变更汇总（详见架构附录）

| 表                | 变更                                                               |
| ----------------- | ------------------------------------------------------------------ |
| `Parent`          | 无结构变更（`id`/`phone` 已满足 JWT 无状态会话；`openid` 列保留但 v2 不再使用） |
| `Child`           | + `grade`（VARCHAR(20)，必填默认「五年级」）、`note`（VARCHAR(200) 可空）、`avatar`（VARCHAR(500) 可空，预留） |
| `GradedQuestion`  | + `question_text`（TEXT 可空）、`question_latex`（TEXT 可空）      |
| `ErrorQuestion`   | 冗余 + `question_text`、`question_latex`                           |
| 验证码            | 存内存或 DB（单机部署，实现时定）；不入核心表                      |

> 均以 Alembic forward-only 迁移落地，迁移文件需人工审核。

---

## 5. 契约变更点（**待人工审批**）

> ⚠️ 依 `contracts/README.md` 与 CLAUDE.md「契约治理」规则，子代理 / 实施者**无权单方面修改** `contracts/openapi.yaml`。以下为**草案**，须人工审核批准后写入契约。

1. **新增端点**：`POST /api/auth/send-code`、`POST /api/auth/login`。
2. **securitySchemes 替换**：`parentPhone` / `parentPhoneHeader` → `bearerAuth`（JWT，`sub`=userId）；`cookieAuth` 保留为历史迁移注记。
3. **现有端点去 phone**：所有业务端点移除 `phone` query 参数与 `X-Parent-Phone` 头，改走 `Authorization` 头。
4. **图片端点改签名 URL**：`GET /api/images/{kind}/{filename}` 由 `?phone=` 改为 `?token=…&expires=…` 签名校验。
5. **`Child` schema 与 `POST/PUT /api/children`**：请求体 + `grade`/`note`，响应 + `grade`/`note`/`avatar`。
6. **`GradedQuestion` / `ErrorQuestion` schema**：+ `question_text` / `question_latex`（可空）。
7. **`POST /api/error-collections/generate`**：请求体 + `format`（`text` 默认 / `image`）；响应在 `image_url` 外新增文字试卷与 `.docx` 下载地址。
8. **移除 `POST /api/wechat-login`**：小程序登录与 Web 统一为 SMS + JWT，不再保留 openid 静默登录 / 设备绑定路径（破坏性，小程序 transport 层移除该端点调用）。

---

## 6. 明确排除项（v2 之外）

- `getPhoneNumber` 一键登录（需企业主体资质）。
- 小程序 openid 静默登录 / `wechat-login` 端点（v2 改用与 Web 统一的 SMS 登录，JWT 本地缓存免重复登录）。
- 短信验证码之外的登录方式（密码、微信授权、第三方 OAuth）。
- 服务端会话撤销（黑名单 / redis / 强制下线）——纯 JWT，登出为前端行为。
- 文本模型 / LLM 生成试卷——文字试卷为模板拼装。
- DeepSeek 接入（官方视觉 API 存疑，仅留扩展点）。
- 独立 OCR 引擎（PaddleOCR / MinerU）——仅预留，本期不接。
- 头像图片上传与展示（`avatar` 仅预留字段）。
- 题干文字的人工修正。
- 试卷标准答案展示。
- 试卷格式的用户偏好持久化（每次生成时当场选）。
- 其余延续现有排除：图片脱敏、通知推送、云端存储、语文作文/报听写、多家长共享同一小孩、数据报表等。

---

## 7. 已知限制与后续

1. **纯 JWT 无法主动撤销**：手机号换绑、账号异常时，旧 token 在 `exp`（30 天）前仍有效。已接受为「家庭自用 + 30 天短有效期」的权衡；对外开放前升级为可撤销会话（session/redis）。
2. **视觉模型转写题干不精确**：手写体、复杂公式的题干文字可能有误，本期不支持人工修正。若实际质量不足，升级路径为 F-16 AC-07 的独立 OCR 引擎。
3. **数学题文字转写限制**：几何图形、竖式等纯图形内容无法转文字，数学题文字描述可能残缺；F-17 文字试卷对数学题依赖 LaTeX 转写，残缺处由截图 / 「查看原图」兜底。
4. **短信服务引入云依赖与成本**：阿里云短信按条计费，打破「除模型 API 外无外部云依赖」的现状；需在成本与预算（§约束）中纳入。
