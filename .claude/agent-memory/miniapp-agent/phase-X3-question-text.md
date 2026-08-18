# Phase X3 — 错题题干文字（小程序）

**Status:** ✅ 完成（2026-08-18）。无契约变更 —— `contracts/openapi.yaml` v0.2.0 已含可空 `question_text`/`question_latex`；`packages/api-types/index.ts` 的 `ErrorQuestionItem` 已带这两字段（由前端 agent 在 X3 同步）。

## 交付

- `src/pages/error-book/index.tsx` — 错题卡片在信息区与「解题思路」之间新增「题干」区块：
  - 有 `question_text`（英语纯文本）→ 渲染「题干」标签 + 纯文本（`white-space: pre-wrap` 保留换行）。
  - 无文字（数学题 `question_text` 为 null、仅有 LaTeX）→ 不渲染 LaTeX 原始代码，改为「查看截图 ›」兜底，点击 `Taro.previewImage` 全屏预览题目截图（原生双指缩放）。
- `src/pages/error-book/index.scss` — 新增 `__stem` 系列样式（label 22rpx tertiary / 正文 26rpx primary / 兜底 accent 可点）。
- `src/test/mocks/components.tsx` — `View` mock 剥离 `hoverClass`（Taro 专属属性，非 DOM 属性），与 `Button` mock 一致，消除测试告警。

## 关键决策：小程序不渲染 LaTeX

- 不引入 KaTeX（小程序无 DOM/字体打包开销），数学题题干为 LaTeX 原始代码，直接渲染会显示 `\frac{1}{2}` 之类乱码，故**一律不读 `question_latex`**。
- 数学题「截图为主、文字为辅」：截图（`question_image_path`）已在卡片顶部全宽展示为主视图；无纯文本时「查看截图」兜底。
- 字段映射与后端一致：英语 → `question_text`、数学 → `question_latex`（小程序跳过）；任一字段缺失都回退截图，不渲染空壳。

## 测试

`pages/error-book/index.test.tsx` +3 用例：英语题干渲染（无 LaTeX）、数学无文字 →「查看截图」兜底且不渲染 LaTeX、点击兜底触发 `Taro.previewImage`。`npx tsc --noEmit` 干净；`npm test` 56 用例全绿；`npm run build:weapp` 编译通过。

## 已知限制 / 已接受技术债

- 数学题在小程序端看不到公式文字（只有截图），Web 端有 KaTeX 渲染。属 X3 明确取舍（小程序不引入 KaTeX，AC-X3.5），非遗留缺陷。

## 契约偏差

无（按 `contracts/openapi.yaml` v0.2.0 实现，字段已存在）。
