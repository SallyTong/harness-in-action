# Phase X4 — 文字试卷 + Word（小程序）

**Status:** ✅ 完成（2026-08-21）。无契约变更 —— `contracts/openapi.yaml` v0.2.0 已含 `generate` 的 `format` 参数 + `GeneratedSheet`（`questions[]` / `docx_url`）；`packages/api-types/index.ts` 的 `GenerateSheetResponse`/`SheetQuestion` 由前端 agent 在 X4 同步。

## 交付

- `src/pages/error-generate/index.tsx` — 生成页新增：
  - 「试卷格式」分段控件（文字试卷默认 / 图片试卷），复用现有「学科」`__seg` 视觉模式；`format` 状态默认 `'text'`，生成时**显式**传 `format=text`/`format=image`。
  - 文字试卷预览（`format === 'text'`）：头部「已生成 N 道错题试卷」+「预览 Word」按钮；每道题一张卡片（第 N 题 + 题型 badge + 学科）：
    - 英语题 `question_text` 纯文本渲染（`white-space: pre-wrap`）。
    - 数学题**截图为主、不渲染 LaTeX**：有 `question_image_path` 直接内联展示（点击 `Taro.previewImage` 全屏）；无截图才回退 `question_text` 文字。
    - 底部「作答区域」虚线分隔。
  - 图片试卷预览（`format === 'image'`）保持原样，仅在 `result.image_url` 非空时渲染。
  - docx 预览 `previewDocx`：`Taro.downloadFile(docx_url)` → 校验 `statusCode===200` → `Taro.openDocument({ filePath, fileType: 'docx', showMenu: true })`；`showLoading`/`hideLoading` 包裹；下载失败 toast「下载失败，请重试」，`errMsg` 命中 `exceed max size` 时提示「文件过大，请到网页端下载」。
- `src/pages/error-generate/index.scss` — 新增 `__result-head`/`__result-title--inline`/`__docx-btn`/`__sheet-list`/`__qcard` 系列（头/题干/截图/作答区）样式，沿用品牌 token（accent、radius 28rpx/20rpx/9999rpx、多字号 22/24/26/28rpx）。
- `src/test/mocks/taro.ts` — 补 `downloadFile`/`openDocument`/`showLoading`/`hideLoading` mock。

## 关键决策

- **小程序不渲染 LaTeX**（延续 X3）：数学题题干为 `question_latex`，直接渲染会显示 `\frac{1}{2}` 乱码，故一律不读。数学题「截图为主、文字为辅」：`question_image_path` 内联展示，无截图才回退文字。
- **docx 不落手机系统文件**：受微信沙盒隔离，`wx.openDocument` 仅能预览/分享（`showMenu: true` 允许转发），无法写入相册/文件管理器；需长期保存提示走 Web 端。AD-26 明确此取舍。
- 格式为「生成时当场选、不持久化」（AD-26），前端默认「文字」显式传 `format=text`，API 默认 `image` 仅用于向后兼容。

## 测试

`pages/error-generate/index.test.tsx` 重写为 9 用例：默认文字格式、文字试卷生成（断言 `format:"text"` + 英语题干 + 无 LaTeX）、数学截图兜底（不渲染 LaTeX）、切换图片（断言 `format:"image"` + 试卷图）、docx 下载+openDocument、docx 下载过大 toast、生成失败 toast、生成中状态、无小朋友禁用。

## 验证

`npx tsc --noEmit` 干净；`npm test` 60 用例全绿；`npm run build:weapp` 编译通过。

## 契约偏差

无（按 `contracts/openapi.yaml` v0.2.0 实现，`format`/`questions[]`/`docx_url` 已存在）。
