# AI 作业批改工具 — 微信小程序 UX 规范（增量）

## 文档信息

| 字段     | 值                                                                  |
| -------- | ------------------------------------------------------------------- |
| 版本     | v0.1.1                                                              |
| 日期     | 2026-08-15                                                          |
| 作者     | sally                                                               |
| 依据     | `docs/ux-spec.md` v1.1、`docs/prd-wechat-miniapp.md` v0.1.1、`docs/architecture-wechat-miniapp.md` v0.1.0、`docs/brand-identity.md` v1.0 |
| 变更说明 | v0.1.1：错题集（F-06）与错题试卷生成（F-07）纳入本期，错题集提升为底部第三个 tab；新增 §2.8/§2.9 屏幕规格，屏幕清单 7→9 屏。 |

> **品牌令牌引用约定**：本规范复用 `docs/brand-identity.md` 定义的令牌（如 `--color-accent`、`--color-success`、`--color-error`、字号层级、间距尺度、圆角 12px/14px/16px）。文中"主色"=`--color-accent`（Indigo `#6366F1`），"绿色勾"=`--color-success`，"红色问号"=`--color-error`。
>
> 本文件是 `docs/ux-spec.md` 的**增量附录**。屏幕的 route / layout / content / behavior / loading-empty-error 状态 / 响应式均沿用现有格式，但适配微信小程序交互习惯（原生 tabBar、navigationBar、`wx.*` 能力）。与 Web 完全一致的细节不再重述，标"同 Web §x"。

---

## 1. 导航与布局

### 全局布局

- **顶部**：小程序原生 `navigationBar`（标题 + 自动返回箭头），不自定义 Web 顶栏。
- **底部 tabBar**（3 项）：🏠 批改 · 📋 历史 · 📕 错题集。
- **无侧边栏**：移动端单列，页面级滚动。

### 响应式策略

- 小程序仅移动端，**无桌面断点**。以 `750rpx`（屏宽）为基准，天然适配不同屏宽。
- 内容区左右留白 `--space-4`（32rpx）；触控目标 ≥ `88rpx`（≈44px）。

### 导航结构

```
批改（首页，tab）  ←── 默认入口
  ├── 手机号登录/绑定（未绑定或首次进入时拦截）
  ├── 小朋友管理（顶栏入口）
  ├── 拍照上传 → 批改中 → 批改结果 →（人工修正）

历史（tab）
  └── 历史列表 → 历史详情 →（人工修正）

错题集（tab）
  └── 错题列表（筛选/统计）→ 生成错题试卷
```

---

## 2. 屏幕规格

### 2.1 手机号登录 / 绑定页（新增，实现 F-12）

**路由：** `/pages/login/index`

**触发：** 首次进入小程序（无本地 phone 缓存），或静默登录返回 404（openid 未绑定）。

**布局（从上到下）：**

1. **品牌区**：产品名"AI 作业批改" + 一句话说明"拍照批改，几分钟检查完作业"
2. **手机号输入框**：`type="number"`，占位"请输入家长手机号"，11 位
3. **主按钮**："进入批改"（全宽，主色；手机号未填满 11 位时置灰）
4. **辅助说明**（`--text-tertiary`）："与网页版同一手机号，数据自动同步"

**交互：**

- 点击"进入批改" → `wx.login()` 取 `code` → `POST /api/wechat-login {code, phone}` → 成功缓存 phone（`Taro.setStorageSync`）→ `Taro.reLaunch` 首页。
- 已绑定用户重进：静默 `wx.login()` → `POST {code}` → 200 刷新 phone 直接进首页；404 → 清缓存停留本页提示重新绑定。

**状态：**

- **绑定中**：按钮内 spinner + "绑定中…"（禁用）
- **code 过期/无效（401）**：Toast"登录已过期，请重试"，重新 `wx.login()` 后自动重试 1 次
- **手机号格式错误**：输入框下方红色提示"请输入 11 位手机号"
- **网络失败**：Toast"网络异常，请重试"，按钮恢复可点击

---

### 2.2 批改上传（首页）（改造，实现 F-09, F-10）

**路由：** `/pages/index/index`（tab）

**布局：** 同 Web §2.1，差异仅在交互（`wx.chooseMedia` 替代 `<input>`）。

1. **当前选择区**：小朋友下拉（`picker` 组件）+ 学科分段控件（英语 | 数学）
2. **拍照上传区**：虚线边框大矩形（`border-2 border-dashed`），图标 📸 + "拍照上传试卷" + "支持英语 · 数学 · 打印体 + 手写"
3. **已选图片预览**：缩略图 + 右上角 ✕ 移除
4. **提交按钮**："开始批改"（全宽主色，已选图片后激活）

**交互：**

- 点击上传区 → `wx.showActionSheet({itemList: ['📷 拍照', '🖼️ 从相册选择']})`
  - 拍照 → `wx.chooseMedia({sourceType:['camera'], count:1})`
  - 相册 → `wx.chooseMedia({sourceType:['album'], count:1})`
- 选图后静默压缩（`Taro.compressImage` 或 canvas，最长边 ≤2048px、JPEG Q80%）
- 点"开始批改" → `wx.uploadFile`（`image + subject + child_id` + phone）→ `202` → `Taro.navigateTo` 批改中

**状态：** 同 Web §2.1（空小朋友引导、预览、网络错误 Toast）。

---

### 2.3 小朋友管理（改造，实现 F-10, F-08）

**路由：** `/pages/children/index`（非 tab，原生返回）

**布局：** 同 Web §2.2。

**交互差异：**

- 确认对话框用 `wx.showModal`（原生）替代自定义 ConfirmDialog
- 添加/编辑用底部弹层输入框（自定义，品牌样式）或 `wx.showModal({editable:true})`

**状态：** 同 Web §2.2。

---

### 2.4 批改中（改造，实现 F-09 异步）

**路由：** `/pages/processing/index?id={submission_id}`

**布局：** 同 Web §2.3（旋转 ✏️ + 轮播文案 + 不确定进度条 + "通常需要 5-15 秒"）。

**交互：**

- `setInterval` 每 2 秒轮询 `GET /api/submissions/{id}`
- **后台切换处理**：`onHide` 暂停轮询，`onShow` 恢复并立即查询一次（避免后台空转）
- `completed` → `Taro.redirectTo` 结果页；`failed` → 错误 + "重新批改"/"返回首页"
- 30 秒超时 → 黄色提示 + "继续等待"/"重试"

**状态：** 同 Web §2.3（轮询中 / 失败 / 超时）。

---

### 2.5 批改结果（改造，实现 F-09, 人工修正）

**路由：** `/pages/result/index?id={submission_id}`

**布局：** 同 Web §2.4（得分概览卡片 + 批改后图片 + 逐题明细 + 人工修正开关）。

**交互差异：**

- 批改后图片用 `<image mode="widthFix">` 全宽展示；点击调 `wx.previewImage`（原生全屏双指缩放），替代自定义 lightbox
- 人工修正开关：切换 → `PATCH` → 成功后得分实时更新、Toast"已更新"；失败回弹

**状态：** 同 Web §2.4（骨架屏、图片加载失败、修正保存失败回弹）。

---

### 2.6 历史列表（改造，实现 F-11）

**路由：** `/pages/history/index`（tab）

**布局：** 同 Web §2.5（筛选栏 + 记录卡片 + 相对时间）。

**交互差异：**

- 筛选栏小朋友/学科用 `picker` 组件
- 分页用页面 `onReachBottom`（上拉触底加载更多），底部"加载更多…"兜底
- 点击卡片 → `Taro.navigateTo` 历史详情

**状态：** 同 Web §2.5（骨架卡片 ×5、空状态"还没有批改记录…"、加载更多、加载完毕）。

---

### 2.7 历史详情（改造，实现 F-11, 人工修正）

**路由：** `/pages/history-detail/index?id={submission_id}`

**布局：** 同 Web §2.6（原图 | 批改后 标签切换 + 得分 + 逐题明细 + 人工修正）。

**交互差异：**

- 图片标签切换用分段控件；图片点击 `wx.previewImage`
- 人工修正同 §2.5

**状态：** 同 Web §2.6。

---

### 2.8 错题集（改造，实现 F-06）

**路由：** `/pages/error-book/index`（tab）

**布局：** 同 Web §2.7（可折叠筛选 + 错题统计 + 错题卡片 + 展开解题思路 + 生成按钮）。

**交互差异：**

- 筛选（小朋友/学科/题型/时间）用 `picker` 组件，可折叠；筛选后统计「共 N 道错题」同步更新
- 分页用 `onReachBottom`（上拉触底）+ 底部「加载更多」兜底
- 底部固定「生成错题试卷」按钮 → `Taro.navigateTo` 生成页（携带当前筛选参数）
- 错题卡片题目截图点击 `wx.previewImage`；解题思路展开/收起

**状态：** 同 Web §2.7（骨架屏、错误重试、空状态「还没有错题，继续保持！」/筛选后「没有符合条件的错题」）。

---

### 2.9 错题试卷生成（改造，实现 F-07）

**路由：** `/pages/error-generate/index`（非 tab）

**布局：** 同 Web §2.8（参数表单 + 生成按钮 + 合成图预览）。

**交互差异：**

- 小朋友用 `picker`（必选）、学科用分段控件、题型多选 chips（按学科过滤）、题数用步进器（1~50）
- 生成成功后合成图预览，点击 `wx.previewImage` 放大

**状态：** 同 Web §2.8（生成中按钮 spinner、失败 Toast、重新生成）。

---

## 3. 交互模式（微信习惯适配）

| 能力 | Web（现状） | 小程序（Taro） |
| ---- | ----------- | -------------- |
| 拍照/相册 | `<input capture>` / `<input file>` | `wx.chooseMedia` + `wx.showActionSheet` |
| 图片预览 | 自定义 ImageLightbox | `wx.previewImage`（原生全屏缩放） |
| 提示 Toast | 自定义 Toast 组件 | `wx.showToast`（原生） |
| 确认对话框 | 自定义 ConfirmDialog | `wx.showModal`（原生） |
| 上传进度 | fetch 进度 | `wx.uploadFile` 自带 `onProgressUpdate` |
| 列表加载 | 滚动监听 | `onReachBottom` / `scroll-view` |
| 轮询 | `setInterval` | `setInterval` + `onShow`/`onHide` 暂停恢复 |
| 加载状态 | 骨架屏（自定义） | 骨架屏（Taro 组件，脉冲动画） |

**空状态**：沿用品牌空状态（图标 + 标题 + 下一步操作按钮），图标用 Taro 版 Lucide 映射。

---

## 4. 辅助功能

- 触控目标 ≥ `88rpx`（≈44px），按钮有 `hover-class` 按压反馈（替代 hover 态）。
- 图片有 `aria-label` / 替代文本；得分不以颜色为唯一传达（同 Web §4）。
- 输入框 `type="number"` 调起数字键盘；`maxlength=11`。
- 尊重系统字体大小（小程序大字模式），关键文字不写死高度。

---

## 5. 屏幕清单

| # | 屏幕 | 路由 | 实现 PRD 功能 | 主用端点 |
|---|------|------|---------------|----------|
| 1 | 手机号登录/绑定（新增）| `/pages/login/index` | F-12 | `POST /api/wechat-login` |
| 2 | 批改上传（首页）| `/pages/index/index` | F-09, F-10 | `POST /api/submissions`、`GET /api/children` |
| 3 | 小朋友管理 | `/pages/children/index` | F-10, F-08 | `GET/POST/PUT/DELETE /api/children` |
| 4 | 批改中 | `/pages/processing/index` | F-09 异步 | `GET /api/submissions/{id}` |
| 5 | 批改结果 | `/pages/result/index` | F-09, 人工修正 | `GET /api/submissions/{id}`、`PATCH .../questions/{qid}` |
| 6 | 历史列表 | `/pages/history/index` | F-11 | `GET /api/submissions` |
| 7 | 历史详情 | `/pages/history-detail/index` | F-11, 人工修正 | `GET /api/submissions/{id}`、`PATCH .../questions/{qid}` |
| 8 | 错题集 | `/pages/error-book/index` | F-06 | `GET /api/error-collections` |
| 9 | 错题试卷生成 | `/pages/error-generate/index` | F-07 | `POST /api/error-collections/generate` |

累计：小程序 9 屏（登录 + 8 功能屏）。
