# AI 作业批改工具 — 微信小程序扩展 PRD

## 文档信息

| 字段       | 值                                   |
| ---------- | ------------------------------------ |
| 版本       | v0.1.2                               |
| 日期       | 2026-08-15                           |
| 作者       | sally                                |
| 依据       | `docs/prd.md` v1.1、`docs/architecture.md` v1.1、`docs/ux-spec.md` v1.1、`docs/brand-identity.md` v1.0、`contracts/openapi.yaml` v0.1.0、`docs/architecture-wechat-miniapp.md` v0.1.0、作用域化访谈 |
| 变更说明   | v0.1.2：错题集（F-06）与错题试卷生成（F-07）纳入本期小程序范围，错题集为底部第三个 tab；屏幕 6→8。v0.1.1：认证方案对齐架构 AD-13——由"沿用手动输入、不引入 openid"调整为"openid 绑定 phone（wx.login 静默登录 + 首登手动输手机号）"，新增 `POST /api/wechat-login` 端点。 |

---

## 1. 目标平台说明

- **平台**：微信小程序（微信原生运行时环境）。
- **前端框架**：**Taro (React)**，复用现有 React + TypeScript 技能栈与业务逻辑，编译输出到微信小程序。
- **定位**：小程序上线后成为家长日常使用的**主入口**（拍照更顺、体验更符合微信习惯），现有 Web 应用降级为维护/备用。
- **移动端基准**：375px 宽度设计基准（与 Web 一致）。

---

## 2. 功能范围

本期小程序覆盖 **8 个屏幕**（核心闭环 + 历史 + 错题闭环），对应 Web 的 F-01~F-07：

| 小程序屏幕       | 对应 Web 屏幕（ux-spec） | 对应功能             | 主用端点 |
| ---------------- | ------------------------ | -------------------- | -------- |
| 批改上传（首页） | §2.1                     | F-01, F-02, F-04     | `POST /api/submissions`、`GET /api/children` |
| 小朋友管理       | §2.2                     | F-04, F-08           | `GET/POST/PUT/DELETE /api/children` |
| 批改中           | §2.3                     | F-01 异步            | `GET /api/submissions/{id}` |
| 批改结果         | §2.4                     | F-03                 | `GET /api/submissions/{id}`、`PATCH .../questions/{qid}` |
| 历史列表         | §2.5                     | F-05                 | `GET /api/submissions` |
| 历史详情         | §2.6                     | F-05, F-03           | `GET /api/submissions/{id}`、`PATCH .../questions/{qid}` |
| 错题集           | §2.7                     | F-06                 | `GET /api/error-collections` |
| 错题试卷生成     | §2.8                     | F-07                 | `POST /api/error-collections/generate` |

---

## 3. 新增功能需求

> 以下功能沿用 Web PRD 的 F-01~F-05 语义，在小程序端重新实现；编号自 **F-09** 起。现有 11 个端点全部复用，**新增 1 个 `POST /api/wechat-login` 端点**（见架构 AD-16）。

### F-09: 小程序核心批改闭环 [MUST]

覆盖 Web F-01（拍照上传）、F-02（AI 批改）、F-03（结果标注与人工修正）在小程序端的实现。

- **AC-01:** 支持 `wx.chooseMedia`（`sourceType: ['camera','album']`）调起后置摄像头拍照与从相册选图。
- **AC-02:** 上传前在端内压缩：最长边 ≤ 2048px，JPEG 质量 80%；用 `wx.compressImage` 或 canvas 重绘实现（`wx.compressImage` 质量参数不支持精确控制时用 canvas 兜底）。
- **AC-03:** 通过 `wx.uploadFile` 以 `multipart/form-data` 上传 `image + subject + child_id`，并携带家长身份（`X-Parent-Phone` 请求头或 `phone` 查询参数）。
- **AC-04:** 上传返回 202 后进入批改中页，每 2 秒轮询 `GET /api/submissions/{id}` 直至 `status == completed | failed`。
- **AC-05:** 批改完成展示批改后图片（`<image mode="widthFix">`），支持双指缩放预览。
- **AC-06:** 展示逐题明细（题号、题型、✓/？、错题解题思路），支持人工修正（`PATCH`），修正后得分与错题集同步。
- **AC-07:** 提供学科选择（英语/数学分段控件）与小朋友下拉（从当前家长列表选取）。

### F-10: 小程序小朋友管理 [MUST]

覆盖 Web F-04、F-08。

- **AC-01:** 列表展示当前家长（手机号）名下小朋友，含已批改次数。
- **AC-02:** 支持新增、编辑、删除小朋友；删除名字不删除对应历史试卷数据。
- **AC-03:** 首次使用预置"小朋友1""小朋友2"，可自由修改。
- **AC-04:** 复用 `GET/POST/PUT/DELETE /api/children`，端点零改动。

### F-11: 小程序历史记录浏览 [MUST]

覆盖 Web F-05。

- **AC-01:** 历史列表按当前家长手机号隔离，支持按小朋友、学科筛选，分页（默认每页 20 条）。
- **AC-02:** 每条记录卡片展示缩略图、学科、得分（正确数/总题数）、相对时间。
- **AC-03:** 点击进详情：原图/批改后图片对照、逐题明细、人工修正。
- **AC-04:** 复用 `GET /api/submissions`（列表）与 `GET /api/submissions/{id}`（详情）。

### F-12: 小程序手机号身份与跨端一致 [MUST]

认证方式决策落地（openid 绑定 phone，见架构 AD-13），覆盖 Web F-04 AC-01 与 F-08。

- **AC-01:** 首次使用手动输入家长手机号，经 `POST /api/wechat-login`（携带 `wx.login()` 的 `code` + 手机号）完成 openid↔phone 绑定；绑定后手机号本地缓存（`wx.setStorageSync`），后续业务请求自动携带（`X-Parent-Phone` 头或 `phone` 参数）。
- **AC-02:** 后续打开小程序静默 `wx.login()` → `POST /api/wechat-login`（仅 `code`）换取已绑定的 phone；`phone` 仍是数据归属唯一键（`Parent.phone` UNIQUE 不变，新增可空 `openid` 字段），业务端点零改动。
- **AC-03:** 同一手机号在小程序与 Web 看到相同的小朋友列表与历史数据（复用同一 Parent/Child/Submission 数据，天然满足 F-08）。
- **AC-04:** 用户在 Web 已录入的手机号与数据，在小程序绑定后直接可见，无需迁移或重新录入。
- **AC-05:** 不引入 `getPhoneNumber`（需企业主体资质）；`openid` 仅作登录态解析，不出现在业务端点、不暴露给客户端。

---

## 4. 与现有系统的关系

### 4.1 复用（零改动）

- 后端现有 **11 个端点**全部复用（`contracts/openapi.yaml` 现有端点零改动）；新增 1 个 `POST /api/wechat-login`（见 §3 与架构 AD-16，属待人工审批的契约变更）。
- 数据模型与数据库（`Parent`/`Child`/`Submission`/`GradedQuestion`/`ErrorQuestion`）。
- GLM-4V 批改管线（异步调度、图片标注、token 计费）。
- 图片标注与存储（`data/images/`：原图/批改/缩略图/题目截图）。
- 品牌令牌与设计系统（`docs/brand-identity.md` 色板、字号、间距、圆角、图标、文案语调）。
- 手机号身份模型（`phone` 仍是数据归属唯一标识；新增 `openid` 仅作小程序静默登录钥匙，绑定到 phone，见架构 AD-13）。

### 4.2 改造（前端重写 + 平台适配）

| 维度       | Web（现状）                          | 小程序（Taro）                                  |
| ---------- | ------------------------------------ | ---------------------------------------------- |
| 工程       | React 19 + Vite + Tailwind v4        | Taro (React)，独立工程                          |
| 图片压缩   | Canvas API（Web Worker）             | `wx.compressImage` / canvas 重绘               |
| 图片上传   | `fetch` multipart                    | `wx.uploadFile`                                |
| 图片展示   | `<img>` + lightbox                   | `<image mode>` + 预览能力                      |
| 路由       | React Router v7                      | Taro 路由（`app.json` 页面配置）                |
| 轮询       | `setInterval`                        | `setInterval`，需处理后台切换后前台恢复重查询    |
| 样式       | Tailwind v4 + CSS 变量               | Taro 版 Tailwind + 复用品牌 CSS 变量            |

### 4.3 新增

- 独立小程序前端工程（目录 `apps/miniapp/`，与 `apps/frontend`、`apps/backend` 并列，见架构 AD-14）。
- 小程序配置文件（`app.json`、`project.config.json` 等）。
- 手机号输入页 + `wx.login()` 静默登录流程 + 本地缓存（`wx.setStorageSync`）。
- 后端新增 `POST /api/wechat-login` 端点及 `Parent.openid` 字段（见架构 §3 合约变更点，待人工审批）。

---

## 5. 部署与合规（重要）

> 决策：**暂不打破"无域名/HTTPS"约束，先内测（家人体验版）**；正式对外发布前再补备案 + HTTPS。

- **内测阶段**：后端继续本地/IP 部署（HTTP + IP:端口）；开发者工具勾选"不校验合法域名"。
- **体验版真机限制（已核实）**：开发者工具的"不校验合法域名"**仅对开发者工具/真机调试生效，对真机体验版不生效**。体验版在真机上要绕过域名校验，必须**每台设备手动"打开调试"**（右上角 `···` → 打开调试）。
- **正式发布前置条件**（对外发布前必须完成，否则无法上线）：
  1. 申请域名；
  2. ICP 备案（个人或企业主体）；
  3. 配置 HTTPS 证书；
  4. 后端部署到备案服务器（架构文档已预留阿里云 ECS 方案）；
  5. 小程序后台"服务器域名"配置 `request` 合法域名（`wx.request`）与 `downloadFile` 合法域名（图片加载）。
- 备案 + HTTPS 是正式上线的**硬门槛**，内测只是延后而非替代。

---

## 6. 明确排除项（本期小程序 MVP 之外）

- `getPhoneNumber` 一键登录（需企业主体资质）—— `openid` 静默登录已纳入（见 F-12），仅排除 `getPhoneNumber`。
- 注册 / 登录 / 密码 / 验证码。
- 图片脱敏。
- 云端图片存储（仍本地文件系统）。
- 通知 / 提醒 / 推送（订阅消息）。
- 批改结果导出 PDF。
- 语文作文、报听写等学科（仅英语 + 数学）。
- 学习趋势分析等数据报表。
- 多家长共享同一小孩。
- 桌面端复杂布局（小程序即移动端）。
- 正式对外发布所需的域名备案 + HTTPS（内测后另行立项）。

---

## 7. 已知限制与后续

1. **体验版真机调试门槛**：内测期家人需各自手动"打开调试"绕过域名校验，体验不完整。这是"暂不备案"的临时代价，非长期方案。
