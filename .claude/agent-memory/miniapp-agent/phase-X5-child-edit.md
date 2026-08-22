# Phase X5 — 儿童编辑（小程序）

**Status:** ✅ 完成（2026-08-22）。无契约变更 —— `contracts/openapi.yaml` v0.2.0 已含 `Child` 的 `grade`/`note`/`avatar` 字段及 `POST/PUT /api/children` 的 `grade`/`note` 请求体；`packages/api-types/index.ts` 的 `Child` 已含 `grade`/`note`/`avatar`/`submission_count`（由前端 agent 在 X5 同步）。

## 交付

- `src/pages/children/index.tsx`（新增）— 小朋友管理页：
  - 列表卡片：名字首字圆形占位头像（非 `avatar` 字段，avatar 本期不展示/编辑）、名字 + 年级 badge、已批改次数（等宽字体）、备注（有则显示）。
  - 增删改：底部「+ 添加小朋友」按钮 + 底部弹层表单（名字 input / 年级 Picker 枚举 一年级~六年级 / 备注 Textarea 200 字带计数器）。编辑态标题「编辑小朋友」、保存按钮「保存修改」；添加态按钮「添加」。
  - 删除：行内「移除」→ `Taro.showModal` 确认（明示「历史批改记录会保留」）→ `apiDelete`（204）→ 刷新列表。
  - 状态：骨架屏加载、错误态（再试一次）、空状态（还没有小朋友）。
- `src/pages/children/index.config.ts` — 导航标题「小朋友管理」。
- `src/pages/children/index.scss` — 品牌 token（卡片 28rpx / 按钮 24rpx / 输入 20rpx / 头像 9999rpx、多字号、多间距）。
- `src/pages/index/index.tsx`（首页）— 小朋友选择区：
  - 无小朋友/加载失败时由「请先在网页版添加小朋友」改为可点击「去添加小朋友 →」跳转管理页。
  - 有小朋友时，选择区右侧新增「管理」入口跳转管理页。
  - `useDidShow` 静默刷新（`loadChildren(false)`）——从管理页返回后反映新增/改名/移除。
- `src/app.config.ts` — 注册 `pages/children/index`。
- `src/test/mocks/components.tsx` — 补 `Textarea` mock（映射 `<textarea>`，onInput 载荷与 Input 一致）。

## 关键决策

- **note 空值语义**：后端 `UpdateChildRequest.note` 缺省为 `None`（清空）；前端保存时 `note: note.trim() || null`，空备注落 `null`（而非空串），与后端默认一致，编辑时清空备注能真正清掉。
- **grade 枚举仅选择器**：grade 必填默认「五年级」，前端仅在 Picker 提供 一年级~六年级，无自由输入。
- **avatar 不触碰**：列表用名字首字生成占位头像，与预留 `avatar` 字段无关（不展示、不编辑）。
- **删除用「移除」文案 + showModal 确认**：符合品牌按钮文案（移除 而非 删除），弹层明示「历史批改记录会保留」。

## 测试

`pages/children/index.test.tsx` 9 用例：列表渲染、骨架屏、错误态重试、空状态、添加（断言 POST 载荷 grade 默认五年级 + note）、编辑预填 + 保存（PUT）、删除确认、删除取消不调 API、空名字校验。`pages/index/index.test.tsx` 更新空状态断言 + 新增 2 个跳转管理页用例。

## 验证

`npx tsc --noEmit` 干净；`npm test` 71 用例全绿；`npm run build:weapp` 编译通过。

## 契约偏差

无（按 `contracts/openapi.yaml` v0.2.0 实现，`Child` 字段与 children CRUD 已存在）。
