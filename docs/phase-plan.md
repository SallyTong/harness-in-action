# AI 作业批改工具 — 实施阶段计划

## 文档信息

| 字段     | 值                           |
| -------- | ---------------------------- |
| 版本     | v1.0                         |
| 日期     | 2026-07-27                   |
| 依据     | `docs/prd.md`, `docs/architecture.md`, `docs/ux-spec.md` |

---

## 阶段总览

| 阶段 | 名称 | 核心交付 | 累计可用 |
|------|------|---------|---------|
| 1 | 基础建设 + 小朋友管理 | 数据库、路由框架、小朋友 CRUD | 全栈骨架可跑 |
| 2 | 核心批改链路 | 拍照上传 → AI 批改 → 标注结果 | 🎯 首次可用：能批改试卷 |
| 3 | 历史记录 + 人工修正 | 历史列表、详情、手动改判 | 批改结果可回溯修正 |
| 4 | 错题集 + 试卷生成 | 错题归集筛选、练习试卷生成 | 🎯 第二大价值：错题复习 |
| 5 | 多设备验证 + 打磨 | 跨设备一致性、全状态覆盖、性能 | 家庭试用就绪 |

每阶段产出**独立可验证的工作增量**——上一阶段不依赖下一阶段的任何代码。

---

## Phase 1: 基础建设 + 小朋友管理

**目标：** 搭建全栈骨架，完成数据库建模，实现家长手机号身份和小朋友 CRUD。结束后全栈可跑、数据可持久化。

**工期预期：** 1–1.5 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-04（家长与小朋友管理），F-08 的 phone 身份部分 |
| 数据模型 | Parent, Child |
| API 端点 | `GET /api/health`, `GET/POST/PUT/DELETE /api/children` |
| UX 屏幕 | §2.1 首页（框架 + 小朋友选择器）, §2.2 小朋友管理页 |
| 前端路由 | `/`, `/children` |

### 后端工作

1. **项目骨架完善**
   - FastAPI app factory, CORS, 异常处理器
   - SQLAlchemy async engine + session 工厂 (`Depends()`)
   - Alembic 初始化，创建初始迁移
2. **数据模型**
   - `Parent` 模型：`id`, `phone` (UNIQUE), `created_at`
   - `Child` 模型：`id`, `parent_id` (FK), `name`, `created_at`；UNIQUE(parent_id, name)
3. **Parent 依赖注入**
   - `get_parent(phone)` — 根据 phone 查找或创建 Parent，注入为 `Depends()`
4. **Children CRUD**
   - `GET /api/children?phone=` → 返回该家长的小朋友列表
   - `POST /api/children?phone=` → 新增小朋友（name 必填，1-50 字符）
   - `PUT /api/children/{id}?phone=` → 编辑名字（404 若不属于该家长）
   - `DELETE /api/children/{id}?phone=` → 删除（204，历史数据保留）
5. **端点测试**
   - 每个 children 端点：happy path + 参数校验 + 跨家长隔离（phone A 不能访问 phone B 的小朋友）

### 前端工作

1. **路由框架**
   - React Router v7 挂载：`/`, `/children`, `/history`, `/errors`, `/errors/generate`
   - 底部导航栏（3 项）—— 除当前阶段实现的页面外，其余 tab 显示占位
2. **首页骨架** (`/`)
   - 顶栏：标题 + 小朋友管理入口图标（👤）
   - 小朋友下拉选择器（从 `GET /api/children` 加载）
   - 拍照上传区占位（虚线边框，暂不接通，Phase 2 实现）
   - 学科分段控件占位
3. **小朋友管理页** (`/children`)
   - 列表展示：名字 + 已批改次数（当前为 0）
   - 添加：弹出输入框 → POST
   - 编辑：点击名字 → 内联编辑 → PUT
   - 删除：点击 🗑️ → 确认对话框 → DELETE
   - 默认预置"小朋友1"、"小朋友2"
4. **通用组件**
   - Toast 通知组件
   - 确认对话框组件
   - 底部导航栏组件

### 验收标准

- [ ] **AC-1.1:** Docker Compose 一键启动（`docker compose up -d`），health 返回 200
- [ ] **AC-1.2:** 首次使用输入手机号 `13800138000`，自动创建 Parent 记录
- [ ] **AC-1.3:** 可新增小朋友（name="小明"），返回 201 + 含 id 的 Child 对象
- [ ] **AC-1.4:** 可查看小朋友列表，包含预置的"小朋友1"、"小朋友2"
- [ ] **AC-1.5:** 可编辑小朋友名字（PUT → 200），删除小朋友（DELETE → 204）
- [ ] **AC-1.6:** 手机号 A 不能访问手机号 B 的小朋友（返回 404）
- [ ] **AC-1.7:** 前端首页正确显示小朋友下拉选择器
- [ ] **AC-1.8:** 前端小朋友管理页完整 CRUD 可用（含加载、空、错误状态）
- [ ] **AC-1.9:** Alembic 迁移可正向执行（`alembic upgrade head`），数据库表结构与架构 §3 一致
- [ ] **AC-1.10:** 所有后端端点测试通过（`pytest tests/ -v`）

### 完成标志

```bash
docker compose -f infra/docker-compose.yml up -d --build
curl -f http://localhost:8000/api/health                                    # → 200
curl "http://localhost:8000/api/children?phone=13800138000"                 # → 小朋友列表
cd apps/backend && python -m pytest tests/ -v                               # 全绿
cd apps/frontend && npx tsc --noEmit && npx vitest run                      # 类型+测试通过
```

---

## Phase 2: 核心批改链路

**目标：** 实现端到端批改——拍照上传 → GLM-4V 识别批改 → 图片标注 → 返回结果。这是产品的核心价值，结束后用户即可完成一次完整的试卷批改。

**工期预期：** 2–2.5 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-01（拍照上传）、F-02（AI 批改引擎）、F-03（标注与返回） |
| 数据模型 | Submission, GradedQuestion |
| API 端点 | `POST /api/submissions`, `GET /api/submissions/{id}` |
| UX 屏幕 | §2.1 首页（上传区激活）, §2.3 批改中, §2.4 批改结果 |
| 前端路由 | `/submissions/:id/processing`, `/submissions/:id/result` |

### 后端工作

1. **Submission + GradedQuestion 模型**
   - 所有字段按架构 §3 定义
   - 索引：`idx_submission_child_id`, `idx_submission_status`, `idx_submission_created_at`, `idx_submission_child_subject`
   - Alembic 迁移（forward-only）
2. **图片上传端点** `POST /api/submissions?phone=`
   - 接收 `image`（multipart/form-data）+ `subject` + `child_id`
   - 校验：文件类型（magic bytes → JPEG/PNG）、大小（< 20MB）、subject 枚举、child_id 归属验证
   - 保存原图至 `data/images/originals/{submission_id}.jpg`
   - 创建 Submission (status=pending)，启动 BackgroundTask
   - 返回 202 + `{submission_id, status: "pending"}`
3. **GLM-4V 服务** `app/services/glm_client.py`
   - 封装 httpx 异步调用智谱 API
   - System prompt 设计：逐题识别（题号 + 坐标 + 对错 + 解题思路 + 题型分类）
   - 返回结构化 JSON（与 GradedQuestion 字段对齐）
   - 超时 30s，失败重试 1 次
   - 记录 token_usage 到 Submission
4. **图片标注服务** `app/services/annotation.py`
   - 基于 GLM-4V 返回的百分比坐标，换算像素坐标
   - 正确题：绿色 ✓ (RGB 34,197,94)，使用打包的 Noto Sans SC 字体
   - 错误题：红色 ? (RGB 239,68,68) + 解题思路文字
   - 裁剪每道题的独立图片 `data/images/questions/{submission_id}_{qnum}.jpg`
   - 保存批改后图片 `data/images/annotated/{submission_id}.jpg`，JPEG Q85
   - 生成缩略图 `data/images/thumbnails/{submission_id}.jpg`（最长边 256px）
5. **批改流程编排** (BackgroundTask)
   - status → processing → 调用 GLM-4V → 解析 JSON → 存储 GradedQuestion → 标注图片 → status → completed
   - 失败：status → failed，记录错误信息
6. **查询端点** `GET /api/submissions/{id}?phone=`
   - 返回 Submission 完整详情（含 GradedQuestion 列表）
   - 跨资源归属校验：submission → child → parent 匹配当前 phone
   - status=pending/processing 时仅返回基本字段，completed 后返回完整 grading 数据
7. **端点测试**
   - 上传：happy path (202) + 缺少字段 (422) + 无效文件类型 (400) + 超大文件 (400) + child 归属校验 (404)
   - 查询：happy path + 归属校验 + 不存在的 submission (404)
   - GLM-4V 调用必须 mock（不消耗真实 API 额度）

### 前端工作

1. **首页上传区激活**
   - 点击上传区 → 底部 ActionSheet（拍照 / 从相册）
   - 拍照：`<input capture="environment" accept="image/*">`
   - 从相册：`<input type="file" accept="image/*">`
   - 图片压缩（Canvas API，最长边 2048px，JPEG Q80%）
   - HEIC 检测与转换（`heic2any`）
   - 压缩后预览缩略图，可移除重选
   - "开始批改"按钮 → POST /api/submissions → 跳转批改中
2. **批改中页面** (`/submissions/:id/processing`)
   - 旋转 ✏️ 动画 + 轮播文案
   - 不确定进度条
   - 每 2 秒轮询 `GET /api/submissions/{id}`
   - status=completed → 自动跳转结果页
   - status=failed → 错误提示 + "重新批改"/"返回首页"
   - 30 秒超时 → 超时提示
3. **批改结果页** (`/submissions/:id/result`)
   - 得分概览卡片（✅ 8/10）
   - 批改后图片展示（可点击全屏 lightbox 双指缩放）
   - 逐题明细列表（题号、题型标签、✓/？、解题思路）
   - 错题行红色左边框强调
   - 骨架屏加载态
4. **通用组件**
   - ActionSheet 底部弹出组件
   - ImageLightbox 全屏预览组件
   - Skeleton 骨架屏组件

### 验收标准

- [ ] **AC-2.1:** 可拍照/选图上传，前端压缩后 ≤ 2048px，格式 JPEG
- [ ] **AC-2.2:** 上传返回 202 + submission_id，前端自动跳转批改中页面
- [ ] **AC-2.3:** 批改中页面每 2 秒轮询，完成后自动跳转结果页
- [ ] **AC-2.4:** 批改后图片在原图上正确显示绿色 ✓ 和红色 ？标注
- [ ] **AC-2.5:** 错题旁有中文解题思路文字，字体清晰可读
- [ ] **AC-2.6:** 批改结果页显示得分概览 + 逐题明细
- [ ] **AC-2.7:** GLM-4V 调用失败时 status=failed，前端显示错误 + 重试按钮
- [ ] **AC-2.8:** 每道错题裁剪为独立图片存储
- [ ] **AC-2.9:** 每次 GLM-4V 调用的 token_usage 记录到数据库
- [ ] **AC-2.10:** 批改超时 30 秒后 status=failed
- [ ] **AC-2.11:** 所有端点测试通过，GLM-4V 调用全程 mock

### 完成标志

```bash
# 端到端验收：用测试图片上传，等待批改结果返回
curl -X POST "http://localhost:8000/api/submissions?phone=13800138000" \
  -F "image=@tests/fixtures/english_test.jpg" \
  -F "subject=english" -F "child_id=1"                          # → 202
# 轮询直到 completed
curl "http://localhost:8000/api/submissions/1?phone=13800138000" # → 含 grading 数据
# 验证图片文件存在
ls data/images/originals/1.jpg data/images/annotated/1.jpg data/images/thumbnails/1.jpg
cd apps/backend && python -m pytest tests/ -v                    # 全绿
```

---

## Phase 3: 历史记录 + 人工修正

**目标：** 批改结果可回溯浏览，支持家长手动纠正 AI 误判。结束后具备完整的批改→查看→修正闭环。

**工期预期：** 1–1.5 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-05（历史提交浏览）、F-03 AC-07（人工修正） |
| 数据模型 | GradedQuestion 增加修正字段（模型已预留，本阶段激活） |
| API 端点 | `GET /api/submissions`（列表）、`PATCH /api/submissions/{id}/questions/{qid}` |
| UX 屏幕 | §2.5 历史列表, §2.6 历史详情（含人工修正） |
| 前端路由 | `/history`, `/submissions/:id` |

### 后端工作

1. **提交列表端点** `GET /api/submissions?phone=`
   - 查询参数：`child_id`（可选）, `subject`（可选）, `limit`（默认 20，最大 100）, `offset`（默认 0）
   - 响应：`{items: [SubmissionSummary], total: N}`
   - 按 `created_at DESC` 排序
   - 按 parent 隔离（JOIN child → parent）
2. **人工修正端点** `PATCH /api/submissions/{id}/questions/{qid}?phone=`
   - 请求体：`{is_correct: boolean}`
   - 校验：question 归属（沿 FK 链到 Parent）
   - 更新 `GradedQuestion.is_correct` + `is_manually_fixed=true`
   - 重算 `Submission.correct_count`
   - **同一事务**同步 ErrorQuestion：错→对则删除 ErrorQuestion 记录；对→错则新增 ErrorQuestion 记录
3. **历史详情端点增强**
   - `GET /api/submissions/{id}` 已包含完整数据（Phase 2 已实现）
   - 本阶段确认响应中 `is_manually_fixed` 字段正确返回
4. **端点测试**
   - 列表：分页、多条件筛选、跨家长隔离、空列表
   - 修正：对→错（ErrorQuestion 新增）、错→对（ErrorQuestion 删除）、跨家长校验 (404)、不存在的 question (404)

### 前端工作

1. **历史列表页** (`/history`)
   - 筛选栏：小朋友下拉 + 学科下拉（顶部固定）
   - 记录卡片：缩略图（64×64）+ 小朋友名 + 学科标签 + 得分 + 相对时间
   - 点击卡片 → 跳转 `/submissions/:id`
   - 滚动加载更多（"加载更多…"按钮兜底）
   - 骨架屏加载态 × 5
   - 空状态："还没有批改记录。去批改一张试卷吧！"+"去批改"按钮
2. **历史详情页** (`/submissions/:id`)
   - 图片对比标签栏：原图 | 批改后（淡入切换）
   - 得分概览卡片（同结果页）
   - 逐题明细 + 人工修正开关
   - 修正：切换开关 → PATCH → 成功后得分实时更新
   - 修正失败：Toast + 开关回弹
3. **修正时间线**（详情页底部，如有修正记录）
   - 显示修正操作："将第 3 题由 ❌ 改为 ✅"
4. **组件测试**
   - 历史列表：渲染 + 空状态 + 加载更多
   - 历史详情：渲染 + 原图/批改后切换 + 修正开关交互

### 验收标准

- [ ] **AC-3.1:** 历史列表显示所有已完成的批改记录，按时间倒序
- [ ] **AC-3.2:** 可按小朋友、学科筛选历史记录
- [ ] **AC-3.3:** 分页正确（默认 20 条/页），可加载更多
- [ ] **AC-3.4:** 历史详情页可切换查看原图/批改后图片
- [ ] **AC-3.5:** 人工修正：将错题改为正确 → 得分更新 → ErrorQuestion 中该题被移除
- [ ] **AC-3.6:** 人工修正：将正确题改为错误 → 得分更新 → ErrorQuestion 新增记录
- [ ] **AC-3.7:** 修正保存失败时开关回弹到原值
- [ ] **AC-3.8:** 手机号 A 不能查看手机号 B 的提交记录（列表和详情均返回空/404）
- [ ] **AC-3.9:** 空状态（无历史记录时）显示引导文案和操作按钮

### 完成标志

```bash
# 列表 + 筛选
curl "http://localhost:8000/api/submissions?phone=13800138000&subject=english&limit=5"  # → 5 条内
# 人工修正：将第 3 题改为对
curl -X PATCH "http://localhost:8000/api/submissions/1/questions/3?phone=13800138000" \
  -H "Content-Type: application/json" -d '{"is_correct": true}'                          # → 200
# 验证错题集同步
curl "http://localhost:8000/api/error-collections?phone=13800138000"                      # 题 3 不在列表中
cd apps/backend && python -m pytest tests/ -v                                              # 全绿
cd apps/frontend && npx vitest run                                                         # 组件测试通过
```

---

## Phase 4: 错题集 + 试卷生成

**目标：** 错题自动归集、多维度筛选、一键生成错题练习试卷。结束后产品两大核心价值（批改 + 错题复习）全部可用。

**工期预期：** 1–1.5 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-06（错题集管理）、F-07（错题试卷生成） |
| 数据模型 | ErrorQuestion（模型已建，本阶段激活完整业务逻辑） |
| API 端点 | `GET /api/error-collections`, `POST /api/error-collections/generate` |
| UX 屏幕 | §2.7 错题集, §2.8 错题试卷生成 |
| 前端路由 | `/errors`, `/errors/generate` |

### 后端工作

1. **错题集同步逻辑完善**
   - Phase 2 中批改完成后已触发 ErrorQuestion 同步（单次提交内按 question_number 去重合并）
   - Phase 3 中人工修正已触发 ErrorQuestion 增删
   - 本阶段确认同步逻辑覆盖所有路径，加上集成测试验证
2. **错题集查询端点** `GET /api/error-collections?phone=`
   - 查询参数：`child_id`（可选）、`subject`（可选）、`question_type`（可选）、`from_date`/`to_date`（可选）、`limit`/`offset`
   - 响应：`{items: [ErrorQuestion], total: N}`
   - 按 `last_error_at DESC` 排序
   - 按 parent 隔离（ErrorQuestion.child_id → Child → Parent）
3. **错题试卷生成端点** `POST /api/error-collections/generate?phone=`
   - 请求体：`child_id`（必填）, `subject`（必填）, `question_types`（可选数组）, `from_date`/`to_date`（可选）, `count`（默认 10，1-50）
   - 从 ErrorQuestion 中按条件筛选，随机选取指定数量
   - 用 Pillow 排版合成：顶部标题栏（小朋友名 + 学科 + 日期）+ 每道错题图片 + 作答空白区
   - 返回：`{image_url, question_count}`
   - 若符合条件的错题不足 count，返回实际数量（不补空白题）
4. **端点测试**
   - 错题查询：多条件组合筛选、分页、跨家长隔离、空结果
   - 试卷生成：正常生成、题目不足、无符合条件的错题 (400)、参数校验

### 前端工作

1. **错题集页** (`/errors`)
   - 筛选栏：小朋友 + 学科 + 题型 + 时间范围（最近一周/一月/全部/自定义）
   - 统计摘要："共 X 道错题"
   - 错题卡片：题目截图（全宽）+ 题号 + 题型标签 + 所属试卷时间 + 解题思路（折叠）
   - 卡片点击 → 跳转对应提交的历史详情
   - 底部固定按钮："生成错题试卷"（全宽，主色）
   - 骨架屏加载态 × 3
   - 空状态区分："🎉 还没有错题。继续保持！"（无错题） vs "没有符合条件的错题"+"清除筛选"（筛选后）
2. **错题试卷生成页** (`/errors/generate`)
   - 参数设置区：小朋友、学科、题型（多选）、时间范围、题目数量滑块（1-50，默认 10）
   - 参数从错题集页筛选条件继承
   - "生成试卷"按钮 → POST → loading
   - 预览区：生成的试卷图片（全宽，可缩放）
   - 生成后按钮切换为"重新生成"+"保存/打印"
3. **组件测试**
   - 错题集列表：多筛选条件渲染 + 空状态 + 点击跳转
   - 试卷生成：参数交互 + 生成 loading + 结果预览

### 验收标准

- [ ] **AC-4.1:** 批改完成后错题自动归入错题集（同一提交内同题号合并为一条）
- [ ] **AC-4.2:** 错题集可按小朋友、学科、题型、时间范围筛选
- [ ] **AC-4.3:** 错题卡片显示题目截图、题号、题型、解题思路
- [ ] **AC-4.4:** 可生成错题试卷：包含标题栏 + 题目图片 + 作答空白区
- [ ] **AC-4.5:** 试卷题目数量可配置（1-50，默认 10），不足时返回实际数量
- [ ] **AC-4.6:** 生成的试卷图片可通过浏览器保存/打印
- [ ] **AC-4.7:** 错题集空状态正确区分"从未有错题"和"筛选结果为空"
- [ ] **AC-4.8:** 跨家长数据隔离：phone A 看不到 phone B 的错题

### 完成标志

```bash
# 错题集查询
curl "http://localhost:8000/api/error-collections?phone=13800138000&subject=math&question_type=calculation"  # → 筛选结果
# 生成错题试卷
curl -X POST "http://localhost:8000/api/error-collections/generate?phone=13800138000" \
  -H "Content-Type: application/json" \
  -d '{"child_id":1,"subject":"math","count":10}'                                                              # → 200 + image_url
cd apps/backend && python -m pytest tests/ -v                                                                  # 全绿
cd apps/frontend && npx vitest run                                                                             # 组件测试通过
```

---

## Phase 5: 多设备验证 + 打磨

**目标：** 验证跨设备数据一致性，补全所有页面的加载/空/错误状态，移动端+桌面端响应式验证，性能达标。结束后可交付家庭试用。

**工期预期：** 0.5–1 天

### 覆盖范围

| 维度 | 内容 |
|------|------|
| PRD 功能 | F-08（跨设备访问验证）、所有非功能需求 |
| 非功能 | N-01 性能、N-02 移动端适配、N-03 图片质量、N-04 成本控制、N-05 数据安全、N-06 可用性 |
| 全局 | 错误边界、loading/empty/error 状态全覆盖、响应式验证 |

### 后端工作

1. **跨设备一致性验证**
   - 同一 phone 在不同请求中看到相同的小朋友列表、历史记录、错题集
   - 编写端到端测试：模拟两个设备的请求序列，验证数据一致性
2. **错误处理与边界情况**
   - 全局异常处理器：未捕获异常 → 500 `{"detail": "Internal server error"}`（不暴露堆栈）
   - 输入校验补全：null byte 注入检测、超长字符串截断
   - GLM-4V 返回格式异常时的优雅降级（JSON 解析失败 → status=failed + 日志）
3. **性能**
   - 数据库查询优化：确认所有列表查询使用索引、无 N+1
   - 图片压缩验证：标注后图片 ≤ 原图尺寸
4. **安全基线确认**
   - 密钥全部来自环境变量（无硬编码）
   - SQL 全部参数化（无原始字符串拼接）
   - 归属校验覆盖所有端点（无越权访问路径）
   - `.env` 在 `.gitignore` 中
5. **成本日志**
   - 每次 GLM-4V 调用的 token 消耗记录到 Submission，提供汇总查询（可选脚本）

### 前端工作

1. **全状态覆盖审计**
   - 逐页审查 loading、empty、error、success 四种状态
   - 缺失状态补齐
2. **响应式验证**
   - 375px 移动端：所有页面功能完整，无溢出/遮挡
   - ≥768px 桌面端：480px 居中，底部导航可见
   - iOS Safari + Android Chrome 实测（或用 DevTools 设备模拟）
3. **错误边界**
   - React Error Boundary 包裹每个页面，捕获渲染异常
   - 全局网络错误拦截（fetch 封装层统一处理）
4. **触控体验**
   - 所有可点击元素 ≥ 44×44px (`min-h-11 min-w-11`)
   - 按钮有 hover/active 视觉反馈
   - 图片 lightbox 支持双指缩放手势
5. **首屏性能**
   - 首屏加载 < 2 秒（3G 模拟验证）
   - 图片懒加载

### 验收标准

- [ ] **AC-5.1:** 同一 phone 在两个浏览器标签页中看到相同数据（小朋友、历史、错题）
- [ ] **AC-5.2:** 所有页面在 375px 移动端视口下功能完整，无水平滚动
- [ ] **AC-5.3:** 所有页面在 768px+ 桌面端居中显示（max-width 480px）
- [ ] **AC-5.4:** 任何未捕获的前端异常不会白屏（Error Boundary 显示降级 UI）
- [ ] **AC-5.5:** 所有 API 调用失败时显示具体错误信息 + 恢复操作
- [ ] **AC-5.6:** 首屏加载时间 < 2 秒（Fast 3G 模拟）
- [ ] **AC-5.7:** 触控目标均 ≥ 44×44px，按钮有 hover/active 态
- [ ] **AC-5.8:** 图片上传到结果返回 < 30 秒（超时正常置 failed）
- [ ] **AC-5.9:** 无硬编码密钥；`.env` 在 `.gitignore`；归属校验无越权路径
- [ ] **AC-5.10:** `ruff check` + `npx tsc --noEmit` 零错误；全部测试通过

### 完成标志

```bash
# 全栈检查
docker compose -f infra/docker-compose.yml up -d --build               # 构建成功
cd apps/backend && ruff check . && python -m pytest tests/ -v           # 零错误 + 全绿
cd apps/frontend && npx tsc --noEmit && npx vitest run && npm run build # 类型+测试+构建通过
# 手动验证：两个浏览器标签页打开，输入同一 phone，数据一致
# 手动验证：375px / 768px 视口逐页检查
```

---

## 阶段依赖关系

```
Phase 1 (基础)
   └──→ Phase 2 (批改链路)
           ├──→ Phase 3 (历史+修正)
           │       └──→ Phase 4 (错题集) ──→ Phase 5 (打磨)
           └──→ Phase 4 (错题集) ──────────→ Phase 5 (打磨)
```

- Phase 2 依赖 Phase 1（需要 DB + Child CRUD）
- Phase 3 依赖 Phase 2（需要 Submission + GradedQuestion 数据）
- Phase 4 依赖 Phase 2（需要 GradedQuestion 产生错题）和 Phase 3（人工修正触发 ErrorQuestion 同步）
- Phase 5 依赖所有前序阶段的功能完整

Phase 3 和 Phase 4 **可部分并行**：Phase 3 的后端工作时 Phase 4 的前端可以开始（因为 Phase 2 已完成批改链路，错题数据已在数据库中）。

---

## 功能覆盖矩阵

| PRD 功能 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|----------|:-------:|:-------:|:-------:|:-------:|:-------:|
| F-01 拍照上传 | | ● | | | |
| F-02 AI 批改 | | ● | | | |
| F-03 标注与返回 | | ● | ● | | |
| F-04 小朋友管理 | ● | | | | |
| F-05 历史浏览 | | | ● | | |
| F-06 错题集 | | | | ● | |
| F-07 错题试卷 | | | | ● | |
| F-08 跨设备 | ● | | | | ● |

## API 端点覆盖矩阵

| 端点 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|------|:-------:|:-------:|:-------:|:-------:|:-------:|
| `GET /api/health` | ● | | | | |
| `GET /api/children` | ● | | | | |
| `POST /api/children` | ● | | | | |
| `PUT /api/children/{id}` | ● | | | | |
| `DELETE /api/children/{id}` | ● | | | | |
| `POST /api/submissions` | | ● | | | |
| `GET /api/submissions/{id}` | | ● | | | |
| `GET /api/submissions` | | | ● | | |
| `PATCH .../questions/{qid}` | | | ● | | |
| `GET /api/error-collections` | | | | ● | |
| `POST /api/error-collections/generate` | | | | ● | |

## UX 屏幕覆盖矩阵

| 屏幕 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|------|:-------:|:-------:|:-------:|:-------:|:-------:|
| 1. 批改上传（首页）| 框架 | ● | | | |
| 2. 小朋友管理 | ● | | | | |
| 3. 批改中 | | ● | | | |
| 4. 批改结果 | | ● | | | |
| 5. 历史列表 | | | ● | | |
| 6. 历史详情 | | | ● | | |
| 7. 错题集 | | | | ● | |
| 8. 错题试卷生成 | | | | ● | |

累计：Phase 1 (2 屏) → Phase 2 (4 屏) → Phase 3 (6 屏) → Phase 4 (8 屏) → Phase 5 (全部打磨)。
