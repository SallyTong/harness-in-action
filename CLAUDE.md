# AI 作业批改工具 (AI Homework Grader)

## 项目概要

AI 驱动的作业批改 SaaS，帮助家长高效检查孩子的试卷和作业。拍照上传后，多模态大模型（GLM-4V）直接在原图上标注批改结果（打勾、打问号、错题解题思路），返回批改后的图片。支持错题统计和错题集试卷生成。MVP 覆盖英语和数学两门学科。

详见 [`docs/interview-summary.md`](docs/interview-summary.md)。

## 技术栈

| 层级     | 选型                                          |
| -------- | --------------------------------------------- |
| 前端     | React 19, Vite 6, TypeScript 5.7, Tailwind v4 |
| 后端     | FastAPI, Python 3.12+                         |
| 数据库   | MySQL 8.4                                     |
| AI 模型  | 智谱 GLM-4V-Flash（免费版先行）                |
| 图片存储 | 本地文件系统（`data/images/`）                 |
| 部署     | Docker Compose                                |

## 项目结构

```
apps/backend/          FastAPI 后端
  app/main.py          应用入口
  app/routers/         API 路由（按领域拆分）
  app/services/        业务逻辑（OCR、批改、图片标注）
  tests/               后端测试
apps/frontend/         React 前端（移动端优先）
  src/pages/           页面组件
  src/components/      可复用组件（按功能域分文件夹）
infra/                 Docker Compose 及部署配置
data/images/           本地图片存储（gitignore 中排除实际文件）
docs/                  设计文档（只读，实施阶段不修改）
contracts/             API 契约（OpenAPI 3.x）
scripts/               开发及集成脚本
```

## 常用命令

```bash
# Docker 全栈运行
docker compose -f infra/docker-compose.yml up -d --build

# 后端
cd apps/backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pytest tests/ -v
ruff check .          # 代码检查
ruff format --check . # 格式检查

# 前端
cd apps/frontend
npm install
npm run dev          # :5173, /api → 代理到后端 :8000
npm run build        # 生产构建
npx tsc --noEmit     # 类型检查

# 开发模式一键启动
bash scripts/dev.sh
```

## 设计文档

- `docs/interview-summary.md` — 访谈摘要（用户意图源头，规范阶段只读）
- `docs/prd.md` — 产品需求文档（8 功能块、非功能需求、约束）
- `docs/architecture.md` — 架构与技术决策（数据模型、API 设计、ADR）
- `docs/ux-spec.md` — UX 规范（8 屏幕清单与交互）
- `docs/brand-identity.md` — 品牌与设计系统（色板、字体、反通用清单）
- `contracts/openapi.yaml` — API 契约（前后端实现的唯一标准）

实施阶段所有 `docs/` 与 `contracts/` 文档为只读；如需变更，先在 PRD/架构提出。

## 项目 Harness

### 路径作用域规则（`.claude/rules/`）

编辑匹配路径时自动加载。详见各规则文件。

| 规则 | 触发路径 |
|------|----------|
| [backend-conventions.md](.claude/rules/backend-conventions.md) | `apps/backend/**`, `infra/**`, `scripts/**` |
| [frontend-conventions.md](.claude/rules/frontend-conventions.md) | `apps/frontend/**` |
| [testing-conventions.md](.claude/rules/testing-conventions.md) | `**/*.test.*`, `**/*.spec.*` |
| [database-conventions.md](.claude/rules/database-conventions.md) | `**/models/**`, `**/migrations/**` |

### 强制技能调用

以下技能在特定类型的工作中**必须**调用，不可跳过：

- **`/design-check`** — 创建或修改任何 UI 组件/页面**之前**必须调用。
- **`/security-review`** — 实现或修改任何 API 端点**之后**必须调用。

其他技能按需调用：[doc-review](.claude/skills/doc-review/SKILL.md)。

### 自动化 Hooks（`.claude/settings.json`）

- **PreToolUse**: 写入文件前自动扫描硬编码密钥，命中则阻止写入。
- **PostToolUse**: 编辑后端 Python 文件后运行 ruff + pytest；编辑前端 TSX 文件后运行 tsc + vitest；编辑模型文件后提醒执行 Alembic 迁移。

### 子代理

#### 项目自定义

- [backend-agent](.claude/agents/backend-agent.md) — `apps/backend/`、`infra/`、`scripts/`、`data/`
- [frontend-agent](.claude/agents/frontend-agent.md) — `apps/frontend/`

#### 内置子代理（无需配置）

Claude Code 内置三个子代理，适用于不需要领域专有定义的快速任务：

| 代理 | 用途 | 何时使用 |
|------|------|----------|
| **Explore** | 只读搜索（Haiku 模型，快速便宜） | 跨多文件搜索模式、总结代码结构、追踪引用链 |
| **Plan** | 只读设计推理 | 实现前评估方案、比较架构决策 |
| **General-purpose** | 完整工具访问 | 需读写但不需要领域专属 system prompt 的任务 |

首选内置代理。仅在需要特定工具限制、持久化 memory 或专属领域指令时才委派给项目自定义子代理。

## 领域边界

- **后端拥有**: `apps/backend/`、`infra/`、`scripts/`、`data/`
- **前端拥有**: `apps/frontend/`
- **共享契约**: `contracts/openapi.yaml`——前后端均以此为准实现，不得单方面偏离
- **设计文档**: `docs/` 在实施阶段为只读

## 关键规则

### 无硬编码密钥

GLM-4V API Key、数据库密码等通过环境变量注入。若发现 `.env` 或含密钥文件，提示用户补充 `.gitignore`。

### 图片处理管线

```
拍照 → Web端压缩（最长边2048px, JPEG Q80%） → 上传 → GLM-4V 识别+批改 → 标注回原图 → 存储+返回
```

采用多模态大模型直接理解图片，无需独立 OCR 步骤。手写+打印混合识别由模型内置能力完成。

### API 调用预算

GLM-4V API 月度预算 50 元。MVP 阶段优先使用免费模型 `GLM-4V-Flash`，确认效果不足后再切换付费版本。每次调用需记录 token 消耗，便于后续成本核算。

### 测试要求

每个后端 endpoint 必须有对应的测试用例。前端关键交互需有组件测试。合并前通过全部测试。

### 移动端优先

所有页面以移动端（375px 宽度基准）设计并验证，拍照上传为核心交互。使用 Tailwind 响应式断点确保后续适配桌面端。

## MVP 范围（v0.1.0）

**包含**: 英语+数学试卷的拍照上传、AI 批改标注、结果图片预览、历史记录浏览、错题集（按时间/题型筛选）、错题试卷生成、一个家长手机号管理并查看自己挂载的多个小孩（跨设备同手机号数据一致）

**明确排除**: 注册/登录系统、图片脱敏、小程序/App、通知提醒、PDF 导出、语文作文、报听写、多家长共享同一小孩（需授权机制，属未来）
