# W3 — 次要页面改造（历史列表/详情 + 错题集 + 错题试卷）

**状态：** ✅ 完成（2026-08-15）

## 范围说明（重要：偏离 phase-plan，人工确认）

`docs/phase-plan-wechat-miniapp.md` 的 W3 原定义仅为「历史浏览」（历史列表 + 详情 2 屏）；PRD §2/§6、
架构 §4、UX §5 均写「错题集(F-06) / 错题试卷生成(F-07) 本期不搬入小程序」。本阶段任务清单要求额外构建
**错题集 + 错题试卷生成**，与上述文档冲突。已向用户确认：**建全 4 页**（扩展范围）。导航历经两次确认：
先「错题集为非 tab 页、从历史页进入」，后改为**错题集提升为底部第三个 tab**（对齐「批改|历史」）。
本次经用户授权更新了 PRD/架构/UX/phase-plan 四份 docs（版本 + 范围 + 屏幕清单 + 导航），使其与实现一致。

## 构建了什么

### 前端（`apps/miniapp/`，纯前端，后端/契约零改动）

- **`src/lib/display.ts`（新增）** — 共享展示层：`TYPE_LABELS`/`ERROR_CATEGORY_LABELS`/`SUBJECT_LABELS`
  中文映射 + `formatRelativeTime`/`formatMonthDay`。历史/详情/错题集/错题试卷复用；result 页保留内联副本（未动，避免触碰 W2 完成代码）。
- **`src/pages/history/index.tsx`（重写占位页）** — 历史列表：小朋友/学科 `Picker` 筛选 + 缩略图卡片
  （得分 mono + 学科 badge + 相对时间）+ `useReachBottom` 上拉 + 「加载更多」兜底按钮 + 骨架/空/错误态。
  切回 tab 用 `useDidShow` 刷第一页（`initialShown` ref 避免与 mount 双查）。
- **`src/pages/history-detail/index.tsx`（新增）** — 历史详情：得分概览 + 「批改后|原图」分段切换
  （`wx.previewImage` 全屏缩放）+ 逐题明细 + 人工修正（PATCH + 乐观更新 + 失败回弹，复用 result 页逻辑）。
- **`src/pages/error-book/index.tsx`（新增，底部第三个 tab）** — 错题集：可折叠筛选（小朋友/学科/题型/时间 `Picker`）
  + 「共 N 道错题」统计 + 错题卡片（题目截图 + 题号/题型 badge + 展开解题思路 + 错误分类）+ 底部固定「生成错题试卷」。
  切回 tab 用 `useDidShow` 刷第一页（同 history）。
- **`src/pages/error-generate/index.tsx`（新增）** — 错题试卷生成：小朋友 `Picker`（必选）+ 学科分段 +
  题型多选 chips（按学科过滤）+ 题目数量步进器（1~50）+ `POST /api/error-collections/generate` + 合成图预览 + 重新生成。
- **`src/app.config.ts`** — tabBar 扩为 3 项（批改|历史|错题集）；注册 `history-detail`/`error-generate` 2 个非 tab 页。
- **测试 mocks** — `taro.ts` 补 `useReachBottom`；`components.tsx` 补 `Slider`（当前页改用步进器，Slider mock 保留备用）。

### 根因修复（非本阶段需求，顺带）

- **`src/app.scss` 补齐 6 个缺失品牌令牌** — `--color-error-bg`/`--color-success-bg`/`--color-warning`/
  `--color-warning-bg`/`--color-bg-hover`/`--color-bg-overlay`。W2 的 result 页 `var(--color-error-bg)`、
  processing 页 `var(--color-warning)` 引用了 app.scss 未定义的变量（渲染为透明/继承色），属潜在 bug；
  本次新增页也依赖这些令牌，一并补齐（对齐 brand-identity §3.1）。

## 验证结果

```bash
cd apps/miniapp && npx tsc --noEmit      # 0 error
cd apps/miniapp && npm test               # 48 passed（新增 24：history 6 + history-detail 6 + error-book 7 + error-generate 5）
cd apps/miniapp && npm run build:weapp    # Compiled successfully
```

每页覆盖 render/loading/error/empty（error-generate 为表单页，empty 用「无小朋友」态代替），另覆盖
分页加载更多、图片切换、人工修正 PATCH、筛选折叠、展开解析、生成成功/失败。

## 设计执行（design-enforcement 自检）

- 无禁用灰（`grep gray|zinc|slate|neutral` 0 命中）；hex 仅 `#ffffff` + green `#16a34a/#dcfce7` + amber `#a16207/#fef9c3`，其余全 `var(--color-*)`。
- 圆角按组件区分（按钮 24rpx / 卡片 28rpx / field 20rpx / 分段·note 16rpx / badge 9999rpx）。
- 每页 ≥3 字号、≥2 字重、≥3 间距；得分用 mono（`SF Mono`/Menlo/Consolas）。
- 空状态有个性：历史「📋 还没有批改记录→去批改」；错题「🎉 还没有错题，继续保持！」/「🔍 没有符合条件的错题→清除筛选」。
- 按钮文案「去批改/再试一次/清除筛选/生成错题试卷/重新生成」，无「提交/取消/删除」；UI 无「AI/模型/prompt」。
- 触控目标：主按钮 96rpx、分段/筛选/入口/chips 88rpx、步进器 88rpx（本阶段把 72/80rpx 的次级按钮统一提到 88rpx）。

## Known Limitations / Accepted Technical Debt

1. **错题试卷「保存到相册」未实现** — 生成页仅预览（`wx.previewImage`），Web「保存图片」对应能力
   （`wx.downloadFile`+`wx.saveImageToPhotosAlbum`+相册权限）未做，任务验收只列「合成图预览」。W4 或正式发布前可补。
2. **历史列表 tab 内不自动增量刷新** — 首次进入/切回 tab 用 `useDidShow` 刷第一页；停留在 tab 内不轮询。
   批改完成后切回 tab 即刷新，属预期行为。
3. **图片 URL phone 参数回归靠后端** — 小程序不自行拼接图片 URL，直接透传后端返回（已带 `?phone=`），
   测试用带 `?phone=` 的 URL 断言 src 原样透传；若后端 URL 拼错则小程序无法兜底。
4. **hover-class 未加** — 沿用 W1/W2 现状（无 `hover-class` 按压态），属品牌微交互缺口，W4 可统一补。

## Contract Deviations

- 无。纯前端，未改动 `contracts/openapi.yaml`。错题集/错题试卷复用现有 `GET /api/error-collections`、
  `POST /api/error-collections/generate` 端点，零契约变更。

## 技术决策偏差（非契约，已记录）

- **术语「错题试卷」（最终）** — 初版按任务清单误用「练习表」，经用户确认统一改回「错题试卷」以对齐
  Web/PRD F-07：按钮「生成错题试卷」、页标题「错题试卷」。契约端点 summary 仍为 "practice sheet"。
- **导航（最终）** — tabBar 3 项「批改|历史|错题集」；错题试卷生成为非 tab 页，入口：错题集底部「生成错题试卷」→ error-generate。
  初版「非 tab、从历史页进入」已改为本方案（用户二次确认），历史页顶栏「错题集」入口已移除。
- **错题试卷数量用步进器（+/-）而非 Slider** — 更易测试、触控目标达 88rpx；Web 用 range slider，行为等价。
- **result 页与 history-detail 页共享逐题明细+修正逻辑但未抽组件** — 为避免触碰 W2 已完成的 result 页，
  history-detail 内联复刻（约 60 行）。W4 可考虑抽 `QuestionList` 公共组件统一两处。

## Cross-Agent Requests

- **backend-agent / frontend-agent**：无待办（纯 miniapp，未动后端/契约/Web）。若 `packages/api-types`
  的 `ErrorQuestionItem`/`GenerateSheetResponse` 结构变动，需同步核对本阶段 error-book/error-generate 的字段使用。
- **（提醒自己 W4）** 全量 design-enforcement 审计时，错题集/错题试卷两屏（现已写入 docs §2.8/§2.9）需一并核对空状态/触控/品牌。
