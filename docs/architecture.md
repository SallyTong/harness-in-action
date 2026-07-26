# AI 作业批改工具 — 架构文档

## 文档信息

| 字段     | 值                                    |
| -------- | ------------------------------------- |
| 版本     | v1.1                                  |
| 日期     | 2026-07-26                            |
| 依据     | `docs/prd.md`, `docs/interview-summary.md` |
| 变更说明 | ErrorQuestion 补冗余字段；Submission 补 thumbnail_path；§8 补跨资源归属校验与缩略图路径约定 |

---

## 1. 技术栈汇总

| 层级       | 技术            | 版本    | 备注                                     |
| ---------- | --------------- | ------- | ---------------------------------------- |
| 前端框架   | React           | 19.x    | 函数组件 + Hooks                          |
| 构建工具   | Vite            | 6.x     | Dev server 代理 /api → 后端               |
| 前端语言   | TypeScript      | 5.7     | Strict 模式                               |
| 样式方案   | Tailwind CSS    | v4      | `@tailwindcss/vite` 插件                  |
| 路由       | React Router    | v7      | 客户端路由                                |
| 后端框架   | FastAPI         | 0.115+  | Async 端点，Depends() 依赖注入             |
| 后端语言   | Python          | 3.12+   | `str \| None` 现代语法                    |
| ORM        | SQLAlchemy      | 2.0+    | 异步会话，声明式模型                       |
| 迁移       | Alembic         | Latest  | 自动生成，人工审核                         |
| 数据库     | MySQL           | 8.4     | InnoDB 引擎                               |
| AI 模型    | 智谱 GLM-4V     | Flash   | 多模态，直接读图批改；Plus 备选             |
| 图片处理   | Pillow          | 11.x    | 标注 overlay、缩放、格式转换               |
| 容器化     | Docker          | Latest  | docker-compose 编排                       |
| 图片存储   | 本地文件系统    | —       | `data/images/`；后续迁阿里云 OSS           |

## 2. 系统架构

```
[Mobile Browser] → [React SPA :5173] ──Vite Proxy──→ [FastAPI :8000] → [MySQL 8.4]
                         │                                  │
                         │  Static assets (Vite build)      ├── Pillow (图片标注)
                         │  Client-side image compression   ├── GLM-4V API (批改)
                         │                                  └── data/images/ (本地存储)
```

### 客户端层

- React SPA 由 Vite 构建并开发服务。
- 前端 API 调用通过 Vite dev server 的 proxy 转发到 FastAPI（`/api/*` → `http://localhost:8000`），避免 CORS 问题。
- 生产模式下，Nginx 提供静态文件服务和 `/api/` 反向代理。
- 图片压缩在浏览器端执行（Canvas API），不经过服务端。

### 应用层

- FastAPI 处理所有业务逻辑：试卷上传、AI 批改调度、图片标注、错题统计。
- 端点按领域划分：`routers/submissions.py`、`routers/error_collections.py`、`routers/children.py`。
- 依赖注入：`Depends()` 提供 DB 会话和配置。
- 无认证中间件——MVP 阶段通过 `phone` 参数（家长手机号）标识数据归属。一个 phone 下挂载多个小孩，跨设备同 phone 数据一致。

### 数据层

- MySQL 8.4 为唯一数据库。
- 图片文件存储在本地文件系统 `data/images/`，数据库仅存储文件路径。
- 错题去重逻辑在应用层实现（按题目特征合并记录，累加错误次数和时间戳）。

### 外部服务

- **GLM-4V API**：唯一外部依赖。通过 `httpx` 异步调用智谱 API。模型选择由环境变量 `GLM_MODEL` 控制（`glm-4v-flash` / `glm-4v-plus`）。

## 3. 数据模型

### Parent（家长）

| 字段       | 类型         | 约束                           |
| ---------- | ------------ | ------------------------------ |
| id         | INT          | PK, AUTO_INCREMENT             |
| phone      | VARCHAR(20)  | NOT NULL, UNIQUE（未来作为登录凭据）|
| created_at | TIMESTAMP    | NOT NULL, DEFAULT NOW()        |

### Child（小朋友）

| 字段       | 类型         | 约束                             |
| ---------- | ------------ | -------------------------------- |
| id         | INT          | PK, AUTO_INCREMENT               |
| parent_id  | INT          | FK → Parent, NOT NULL            |
| name       | VARCHAR(50)  | NOT NULL                         |
| created_at | TIMESTAMP    | NOT NULL, DEFAULT NOW()          |

**UNIQUE**: (parent_id, name) — 同一家长下名字不可重复

### Submission（提交记录）

| 字段                | 类型         | 约束                         |
| ------------------- | ------------ | ---------------------------- |
| id                  | INT          | PK, AUTO_INCREMENT           |
| child_id            | INT          | FK → Child, NOT NULL         |
| subject             | ENUM         | 'english', 'math', NOT NULL  |
| status              | ENUM         | 'pending','processing','completed','failed'; DEFAULT 'pending' |
| original_image_path | VARCHAR(500) | NOT NULL                     |
| annotated_image_path| VARCHAR(500) | NULLABLE（批改完成后填充）     |
| thumbnail_path      | VARCHAR(500) | NULLABLE（批改完成后生成缩略图，供列表展示）|
| total_questions     | INT          | NULLABLE（批改完成后填充）     |
| correct_count       | INT          | NULLABLE（批改完成后填充）     |
| grading_raw_json    | JSON         | NULLABLE（GLM-4V 原始返回）   |
| token_usage         | JSON         | NULLABLE（如 {"prompt_tokens":1200,"completion_tokens":800,"total_tokens":2000}，与 OpenAPI 契约一致）|
| created_at          | TIMESTAMP    | NOT NULL, DEFAULT NOW()      |
| updated_at          | TIMESTAMP    | NOT NULL, DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP |

**索引：**
- `idx_submission_child_id` ON (child_id)
- `idx_submission_status` ON (status)
- `idx_submission_created_at` ON (created_at)
- `idx_submission_child_subject` ON (child_id, subject)

### GradedQuestion（批改明细）

| 字段               | 类型         | 约束                              |
| ------------------ | ------------ | --------------------------------- |
| id                 | INT          | PK, AUTO_INCREMENT                |
| submission_id      | INT          | FK → Submission, NOT NULL, CASCADE|
| question_number    | VARCHAR(20)  | NOT NULL（支持"1a","II-3"等复合编号）|
| question_position  | JSON         | NULLABLE（百分比坐标 0-100，如 {"x":12.0,"y":34.0,"w":20.0,"h":8.0}，GLM-4V 返回）|
| question_image_path| VARCHAR(500) | NULLABLE（从原图按坐标裁剪的题目区域截图）|
| question_type      | ENUM         | 'choice','fill_blank','reading','composition','calculation','word_problem' |
| is_correct         | BOOLEAN      | NOT NULL                          |
| solution_note      | TEXT         | NULLABLE（仅错题有）               |
| error_category     | VARCHAR(50)  | NULLABLE（枚举：grammar, vocabulary, spelling, logic, calculation, careless, comprehension）|
| is_manually_fixed  | BOOLEAN      | DEFAULT FALSE                     |
| created_at         | TIMESTAMP    | NOT NULL, DEFAULT NOW()           |

**索引：**
- `idx_gq_submission_id` ON (submission_id)
- `idx_gq_submission_correct` ON (submission_id, is_correct)

### ErrorQuestion（错题集）

> 从 GradedQuestion 中 `is_correct = FALSE` 的记录生成。MVP 阶段不做跨试卷的相似题去重（需要内容匹配，属 v2 能力），每道错题保留独立记录。同一次提交内同一题号的错误合并为一条。

| 字段                 | 类型        | 约束                   |
| -------------------- | ----------- | ---------------------- |
| id                   | INT         | PK, AUTO_INCREMENT     |
| submission_id        | INT         | FK → Submission, NOT NULL |
| child_id             | INT         | FK → Child, NOT NULL   |
| subject              | ENUM        | 'english', 'math'      |
| question_number      | VARCHAR(20) | NOT NULL               |
| question_type        | ENUM        | 同 GradedQuestion       |
| question_image_path  | VARCHAR(500)| NOT NULL（错题区域截图）|
| solution_note        | TEXT        | NULLABLE（从 GradedQuestion 冗余，仅错题有）|
| error_category       | VARCHAR(50) | NULLABLE（同 GradedQuestion 枚举，冗余）|
| is_manually_fixed    | BOOLEAN     | NOT NULL, DEFAULT FALSE（冗余自 GradedQuestion）|
| error_count          | INT         | NOT NULL, DEFAULT 1    |
| error_timestamps     | JSON        | NOT NULL（出错时间列表） |
| last_error_at        | TIMESTAMP   | NOT NULL               |
| created_at           | TIMESTAMP   | NOT NULL               |
| updated_at           | TIMESTAMP   | ON UPDATE CURRENT_TIMESTAMP |

**UNIQUE**: (submission_id, question_number) — 同一提交内题号唯一
**索引：**
- `idx_eq_child_subject` ON (child_id, subject)
- `idx_eq_child_type` ON (child_id, question_type)
- `idx_eq_last_error` ON (last_error_at)

### 数据模型关系

```
Parent (1) ──→ (N) Child (1) ──→ (N) Submission (1) ──→ (N) GradedQuestion
                                    │
                                    └──→ (N) ErrorQuestion (去重聚合，is_correct = FALSE)
```

## 4. API 设计

完整的 API 契约定义在 `contracts/openapi.yaml`。本节仅列关键约定，不重复细节。

**约定：**
- 所有端点以 `/api/` 为前缀。
- MVP 阶段无会话认证。前端 localStorage 存储手机号，所有请求通过 `X-Parent-Phone` 请求头或 `phone` 查询参数携带家长身份。
- 分页：`limit` 和 `offset` 查询参数，响应含 `total` 计数。
- 错误响应：`{"detail": "描述信息"}` 配相应 HTTP 状态码。
- 时间戳统一使用 ISO 8601 UTC。

**端点速览：**（所有端点（除 health）需携带 `phone` 参数或 `X-Parent-Phone` 请求头）

| 方法   | 路径                              | 说明                |
| ------ | --------------------------------- | ------------------- |
| GET    | `/api/health`                     | 健康检查（无需 phone）|
| GET    | `/api/children?phone=`            | 当前家长的小朋友列表  |
| POST   | `/api/children?phone=`            | 新增小朋友           |
| PUT    | `/api/children/{id}?phone=`       | 编辑小朋友名字       |
| DELETE | `/api/children/{id}?phone=`       | 删除小朋友名字       |
| POST   | `/api/submissions?phone=`         | 上传试卷（202，异步） |
| GET    | `/api/submissions?phone=`         | 查询历史提交列表     |
| GET    | `/api/submissions/{id}?phone=`    | 获取提交详情（含状态）|
| PATCH  | `/api/submissions/{id}/questions/{qid}?phone=` | 人工修正某题判定 |
| GET    | `/api/error-collections?phone=`   | 错题集筛选查询       |
| POST   | `/api/error-collections/generate?phone=` | 生成错题试卷   |

## 5. 认证与授权

MVP 阶段采用**手机号作为简易身份标识**，无密码/验证码/会话。

- 家长首次使用输入手机号，系统创建 Parent 记录。`phone` 字段作为唯一键。
- 同一手机号在不同设备上看到相同数据（数据按 `parent_id` 隔离）。
- 一个家长（phone）可管理多个小朋友（Child），一个小朋友只属于一个家长。
- 信任模型：家庭内部使用，部署在本地网络。手机号不验证真伪（信任输入）。
- **未来登录方案**：手机号 + 验证码登录（对外开放时引入），届时 phone 的 UNIQUE 约束已就位，`parent` 表无需变更。

## 6. 核心处理管线

### 6.1 批改流程（异步）

```
Client                     Backend                    GLM-4V API
  │                           │                           │
  ├─ POST /api/submissions ──→│                           │
  │  (image + subject +       │                           │
  │   child_id + phone)       │                           │
  │                           ├─ Validate & save original │
  │                           ├─ Save Submission (status=pending)
  │                           │←── 202 {submission_id} ───┤
  │                           │                           │
  │  (polling)                │                           │
  ├─ GET /api/submissions/{id}→                           │
  │←── 200 {status: "processing"} ──┤                     │
  │                           │ (background task)         │
  │                           ├─ POST GLM-4V API ────────→│
  │                           │←── grading JSON ──────────┤
  │                           ├─ Parse & store questions  │
  │                           ├─ Pillow annotate image    │
  │                           ├─ Save annotated image     │
  │                           ├─ Sync update ErrorQuestion│
  │                           ├─ Update status=completed  │
  │                           │                           │
  ├─ GET /api/submissions/{id}→                           │
  │←── 200 {status:"completed", ...} ──┤                  │
```

- **202 Accepted**：上传成功，立即返回 `submission_id` 和 `status: "pending"`
- **后台处理**：FastAPI `BackgroundTasks` 执行 GLM-4V 调用 + 标注 + 错题集同步
- **失败处理**：GLM-4V 调用失败或超时（30s）后 `status` 置为 `"failed"`
- **前端轮询**：每 2 秒查询 `GET /api/submissions/{id}` 直到 `status == "completed" or "failed"`

### 6.2 GLM-4V Prompt 设计

系统提示词（System Prompt）将指示模型：

1. 识别试卷上每道题及其题号（含复合编号如 `1a`、`II-3`）
2. 对每道题返回在图片上的大致位置区域（bounding box：`{x, y, w, h}`，相对于图片宽度和高度的百分比）
3. 判断学生手写作答的正误
4. 对错题给出简短解题思路（中文）
5. 对每道题分类（题型）
6. 以结构化 JSON 格式返回

响应 JSON schema 与 `GradedQuestion` 表字段对齐，`question_position` 存储百分比坐标（前端/后端可据此换算为像素坐标进行标注和裁剪）。

### 6.3 图片标注策略

使用 Pillow 在原图上叠加标注，坐标基于 GLM-4V 返回的 `question_position` 百分比坐标换算为像素坐标：

- **正确题**：在题号区域附近绘制绿色 ✓（RGB: 34, 197, 94）
- **错误题**：在题号区域附近绘制红色 ？（RGB: 239, 68, 68），并在题目空白处叠加解题思路文字
- **文字渲染**：使用项目内打包的开源中文字体（如思源黑体 Noto Sans SC），确保跨平台一致
- **题目截图**：根据 `question_position` 坐标用 Pillow `crop()` 从原图裁出每道题的区域，保存为独立图片
- **输出格式**：与原图同尺寸 JPEG，质量 85%

### 6.4 错题集维护策略

- **去重范围**：同一 `submission_id` 内同一 `question_number` 的错题合并为一条（同一张试卷不会出现同一题号多道题）。
- **跨试卷**：不做相似题去重。不同试卷上的"第3题"内容不同，自动匹配需要题目图片/文本相似度比对，属于 v2 能力。
- **触发机制**：采用**同步触发**——每次批改完成后立即更新 ErrorQuestion；人工修正后同步刷新。
- **冗余字段同步**：`solution_note`、`error_category`、`is_manually_fixed` 从 GradedQuestion 冗余到 ErrorQuestion（物化缓存，避免错题列表查询时回连 GradedQuestion）。GradedQuestion 这些字段变更时，ErrorQuestion 对应记录必须同事务刷新。
- **删除逻辑**：人工将某题由"错"改为"对"时，从 ErrorQuestion 中删除对应记录；由"对"改为"错"时，新增记录。

## 7. 部署架构

### 本地开发

```bash
bash scripts/dev.sh           # 一键启动前后端（热重载）
# 或
docker compose -f infra/docker-compose.yml up -d  # 全栈容器化
```

- 前端：http://localhost:5173（Vite dev server，/api → localhost:8000）
- 后端：http://localhost:8000
- MySQL：localhost:3306（Docker 容器）

### 生产部署（后续）

- 容器镜像构建，部署至阿里云 ECS。
- Nginx 作为前端静态文件服务和 `/api/` 反向代理。Nginx 配置置于 `infra/nginx.conf`。
- MySQL 数据卷持久化。图片目录挂载至宿主机或 OSS。
- 环境变量通过 `.env` 注入：`GLM_API_KEY`、`GLM_MODEL`、`MYSQL_PASSWORD` 等。

## 8. 约束与不变量

跨系统不变量集中声明——违反其中任何一条会产出"看起来对、实际错"的行为。

### ID 策略
- 所有主键使用 `INT AUTO_INCREMENT`（非 UUID）。MVP 数据量小，自增更简单直观。
- 对外暴露的资源 ID（路径参数）一律为整数。前端不解析、不依赖 ID 格式。

### 时间戳格式
- 所有 `created_at` / `updated_at` / `last_error_at` 字段在数据库存 UTC，API 响应以 ISO 8601 UTC 字符串返回（如 `2026-07-26T12:34:56Z`）。
- 前端按用户本地时区展示。

### 数据归属隔离（不变量）
- **所有**返回用户数据的查询必须带 `parent_id`（由 phone 解析）过滤。phone→parent_id 的解析在每个请求的依赖注入中完成一次。
- 任何端点不得直接接受 `parent_id` 作为入参——只能接受 `phone`，由后端解析。防止越权。
- **跨资源 ID 归属校验**：所有以 `child_id` / `submission_id` / `question_id` 为路径或入参的端点，必须先校验该资源归属当前 phone 解析出的 `parent_id`（沿 FK 链向上追溯到 Parent）。校验失败一律返回 **404**（非 403，避免资源存在性探测）。例如 `POST /api/submissions` 传入的 `child_id` 必须属于当前家长，`PATCH .../questions/{question_id}` 的题目必须经由 Submission→Child 归属当前家长。

### 迁移策略
- Alembic 迁移**仅向前**（forward-only），不写回滚脚本（MVP 阶段简化）。生产前需补齐 downgrade。
- 模型变更后必须立即 `alembic revision --autogenerate` 并人工审核生成的迁移文件。

### 图片存储路径约定
- 原图：`data/images/originals/{submission_id}.jpg`
- 批改后：`data/images/annotated/{submission_id}.jpg`
- 缩略图：`data/images/thumbnails/{submission_id}.jpg`（批改完成后由 annotated 图缩放生成，最长边 ≤ 256px，供历史列表卡片展示）
- 题目截图：`data/images/questions/{submission_id}_{question_number}.jpg`
- 路径在数据库以相对路径存储；API 返回时拼接为完整 URL。

### 错题集一致性
- GradedQuestion 的 `is_correct` 变更（含人工修正）必须**在同一事务**内同步 ErrorQuestion。
- 不允许出现"题目已标记为正确但 ErrorQuestion 中仍存在"的不一致状态。

## 9. 架构决策记录

### AD-01: Vite SPA 而非 Next.js

**决策：** 使用 Vite + React SPA，不用 Next.js。
**理由：** MVP 无需 SSR/SSG，所有内容在客户端渲染。Vite 更轻量，与后续迁移小程序的技术栈接近（同为 CSR）。无服务端渲染开销。

### AD-02: Vite Proxy 开发代理

**决策：** 开发环境下通过 Vite proxy 转发 API 请求。生产环境下由 Nginx 代理。
**理由：** 避免 CORS 配置，前后端同源访问。开发和生产保持一致的路由 `/api/*`。

### AD-03: GLM-4V 直接批改（无独立 OCR）

**决策：** 不引入独立 OCR 服务，由多模态模型直接识别+批改。
**理由：** 减少管道环节，多模态模型对手写体+打印体混合场景优于传统 OCR。数学 OCR 预留为补充方案（OQ-05）。

### AD-04: MySQL 而非 PostgreSQL

**决策：** 使用 MySQL 8.4。
**理由：** 明确的用户偏好。MySQL 8.x 的 JSON 类型和窗口函数能力足以支撑 MVP 需求。后续无计划使用 PostgreSQL 特有扩展（PostGIS、全文搜索等）。

### AD-05: 无认证（MVP）

**决策：** 不实现用户注册/登录/会话管理。以 `phone`（家长手机号）作为数据归属标识。
**理由：** 本地部署 + 家庭内部使用，信任边界小。一个 phone 挂载该家长名下的多个小孩，数据按 phone 隔离。对外开放前必须引入完整认证体系。

### AD-06: 本地文件存储图片

**决策：** 图片存储于本地文件系统而非云存储。
**理由：** 减少外部依赖，部署简单。目录结构和命名规范设计为后续迁移 OSS 做好准备（`file_path` 字段可直接映射为 OSS key）。

### AD-07: 错题物化缓存表

**决策：** 使用 ErrorQuestion 表作为去重后的物化视图，而非每次实时查询去重。
**理由：** 错题查询是高频操作（筛选、生成试卷）。实时去重需要全表扫描 GradedQuestion，数据量大后性能下降。触发式刷新保证数据一致性。

### AD-08: 手机号作为家长标识（非验证码登录）

**决策：** MVP 以手机号作为 Parent 唯一标识，不验证真伪、不设密码。一个 phone 挂载该家长名下的多个小孩；同一 phone 跨设备数据一致。**不实现多家长共享同一小孩**（需授权机制，属未来能力）。
**理由：** `phone` 天然具有唯一性，且为未来的验证码登录预留了字段。MVP 信任输入是因为本地部署 + 家庭使用，无需防伪。对外开放时仅需在 phone 验证环节加码，数据模型无需迁移。

### AD-09: 异步批改流程

**决策：** 批改流程采用异步模式（202 Accepted + 前端轮询），而非同步阻塞。
**理由：** GLM-4V API 调用 + 图片标注总耗时可能超过 15 秒。移动端网络不稳定时同步 HTTP 请求极易超时。异步模式也便于后续扩展（如批量批改、失败重试）。

### AD-10: 前端处理 HEIC 转换

**决策：** HEIC 格式由前端在浏览器端转换为 JPEG，后端仅接收 JPEG/PNG。
**理由：** iOS 设备默认拍照格式为 HEIC。前端 `heic2any` 库转换避免后端依赖系统编解码器（如 ImageMagick），保持后端轻量。

### AD-11: 打包中文字体文件

**决策：** 将开源中文字体（如思源黑体 Noto Sans SC）打包到项目 `assets/fonts/`，Pillow 标注时加载。
**理由：** 系统默认字体跨平台不一致，且可能不支持中文渲染。打包字体文件确保开发/生产环境批注文字一致。

## 10. 安全考量

> MVP 阶段为家庭内网自用，安全要求较低。以下为对外开放前必须实施的基线。

### 当前（MVP）

- **无认证**：信任内网环境。
- **密钥管理**：GLM-4V API Key 和数据库密码通过环境变量注入，不进入代码仓库。
- **输入校验**：服务端校验上传文件类型（仅 JPEG/PNG）、大小（< 20MB）、学科枚举值。
- **SQL 注入防护**：SQLAlchemy ORM 参数化查询。

### 对外开放前必须实施

- 注册/登录/会话管理
- 图片脱敏（小朋友姓名、学校等个人信息）
- HTTPS（Let's Encrypt 或阿里云 SSL）
- 文件上传大小和频率限制
- 按会话的错题集数据隔离
- CSRF 保护
