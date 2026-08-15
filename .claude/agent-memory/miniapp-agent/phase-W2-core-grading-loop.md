# W2 — 核心批改闭环（拍照上传 → 批改中 → 结果查看）

**状态：** ✅ 完成（2026-08-15）

## 构建了什么

### 前端（`apps/miniapp/`，纯前端，后端/契约零改动）

- **`src/lib/image.ts`** — 图片压缩。`computeTargetSize`（纯函数，保持宽高比压最长边 ≤2048px）+ `compressImage`（`Taro.getImageInfo` 读尺寸 → 超界才 `Taro.compressImage{compressedWidth/Height, quality:80}`，否则原样返回）。质量用 wx.compressImage 的 0–100 刻度（**注意与 Web 端 canvas toBlob 0.8 的 0–1 刻度不同**）。
- **`src/lib/api.ts`** — 新增 `apiUpload(path, filePath, formData)`：`Taro.uploadFile`，`image` 走 filePath，phone 走 URL 查询参数（契约约定），其余表单字段放 formData。
- **`src/pages/index/index.tsx`（改造首页）** — 小朋友 `Picker`（读 `GET /api/children`，自动选第一个）+ 学科分段控件（英语/数学）→ `wx.showActionSheet`（拍照/相册）→ `wx.chooseMedia` → `compressImage` → 缩略图预览/移除 → `apiUpload` 202 → `navigateTo` 批改中。
- **`src/pages/processing/index.tsx`（新增）** — 轮播文案 + ✏️ bob 动画 + 不确定进度条；`useDidShow/useDidHide` 后台暂停/恢复；`setInterval` 2s 轮询 `GET /api/submissions/{id}`；completed→`redirectTo` 结果、failed→错误、30s 超时→黄色提示。
- **`src/pages/result/index.tsx`（新增）** — 得分概览卡片（等宽字体分数）+ `<Image mode="widthFix">` 全宽批改图（点击 `wx.previewImage` 原生缩放）+ 逐题明细（题号/题型/✓?/解题思路折叠/已修正 badge）+ 人工修正开关（乐观更新 + `PATCH .../questions/{qid}` + 失败回弹）。
- **`src/app.config.ts`** — 注册 `pages/processing/index`、`pages/result/index`（非 tab）。
- **测试 mocks**（`src/test/mocks/`）— 补 `showActionSheet/chooseMedia/compressImage/getImageInfo/uploadFile/previewImage/switchTab` + hooks `useRouter/useDidShow/useDidHide`（命名导出）+ `Image/Picker` 组件 mock。

## 验证结果

```bash
cd apps/miniapp && npx tsc --noEmit      # 0 error
cd apps/miniapp && npm test               # 24 passed（8 image + 5 result + 4 processing + 4 index + 3 login）
cd apps/miniapp && npm run build:weapp    # Compiled successfully
```

`lib/image.test.ts` 8 用例覆盖 `computeTargetSize`（不缩放/宽图/高图/边界/取整）+ `compressImage`（已小原样返回、超界压缩并传对参数）。result 页 5 用例覆盖 render/loading/error/empty/手动修正（PATCH + 乐观更新）。processing 页 4 用例覆盖渲染轮询/完成跳转/失败错误/30s 超时（fake timers）。

## 设计执行（design-enforcement 自检）

- 无禁用 Tailwind 灰（0 命中）；hex 仅 `#ffffff`、green 系列 `#16a34a/#dcfce7`、amber 系列 `#a16207/#fef9c3`，其余全部 `var(--color-*)` 品牌令牌。
- 每页 ≥3 字号、≥2 字重、≥3 间距；圆角按组件区分（按钮 24rpx/卡片 28rpx/输入 20rpx/上传区 32rpx/badge 9999rpx）。
- 分数用等宽字体（`SF Mono`/Menlo/Consolas）；按钮文案"开始批改""重新批改""返回首页"；UI 无 "AI/模型/prompt"。
- 触控目标：主按钮 ≥96rpx，处理页动作 ≥88rpx，结果页修正开关 88rpx。

## Known Limitations / Accepted Technical Debt

1. **小朋友管理（增删改）页未构建** — 本次 W2 切片范围（用户任务明确）仅含 3 屏（上传/处理中/结果）。首页只做**只读**小朋友 `Picker`（读默认小朋友1/2，W1 绑定即创建）；空小朋友态提示"请先在网页版添加小朋友"（无跳转，避免死链）。**待补：** 若需完整 F-10 CRUD，需新增 `/pages/children` 页。
2. **compressImage 依赖 `wx.compressImage` 的 compressedWidth/Height（基础库 2.26.0+）**；已 ≤2048px 的图片**不重编码**（原样返回，不强制 JPEG），Web 端语义是"总是重编码为 JPEG"——这里选择跳过无谓重编码，行为差异已记录。
3. **图片 URL 基址仍硬编码**（`http://localhost:8000`，继承 W1 已知限制，见 AD-17），`wx.previewImage` 内测需真机"打开调试"。
4. **登录页测试有 2 条 jsdom 警告**（`maxlength`/`placeholderClass` 非法 DOM 属性）——**W1 遗留**，非本次引入，登录测试仍绿；W4 打磨时可在 Input mock 里透传前剥离。

## Contract Deviations

- 无。本次纯前端，未改动 `contracts/openapi.yaml`。

## 技术决策偏差（非契约，已记录）

- **quality 刻度**：miniapp `JPEG_QUALITY = 80`（wx.compressImage 0–100），Web `JPEG_QUALITY = 0.8`（canvas 0–1）。已在 `lib/image.ts` 注释标注，避免移植时误抄。
- **`handleChildChange` 参数用宽联合类型**（`number | number[] | string | string[]`）而非 `any`，因 Taro `Picker.onChange` 的 `CommonEventFunction` 联合类型无法用窄签名匹配。
- **轮询用 `paused` 状态驱动 effect**（`useDidHide`→paused=true 清 interval，`useDidShow`→paused=false 立即查一次），避免 onShow 与 mount 双查。error/timedOut 也纳入 effect 依赖以停轮询。

## Cross-Agent Requests

- **frontend-agent（高优先级，W1 遗留回归）**：`docker compose build` 的 **frontend 镜像构建失败**——`apps/frontend/Dockerfile` 的 build context 是 `apps/frontend/`，但 `src/types.ts` 已 `export * from "@homework/api-types"`（W1 共享类型抽包），而 `packages/api-types/` 在 context 之外，Docker 内 `tsc -b` 报 `Cannot find module '@homework/api-types'`（及一系列 `'../types' has no exported member`）。**根因：** 前端 Docker 构建未包含共享类型包。**修复方向（择一）：** (a) 把 frontend 的 build context 提到仓库根并在 Dockerfile 里 `COPY packages/api-types`；(b) `apps/frontend/Dockerfile` 多阶段里 COPY 该包并设 `NODE_PATH`/别名。本地（monorepo 相对路径）正常，仅 Docker 断——W1 验收只跑了本地 build 未跑 Docker。
- **backend-agent**：无（复用现有 submissions/children 端点，零改动）。
- **（提醒自己）W3 历史浏览** 需复用 `GET /api/submissions`（列表）+ 结果/详情屏复用本阶段 result 页的逐题明细 + 人工修正逻辑，可抽公共组件。
