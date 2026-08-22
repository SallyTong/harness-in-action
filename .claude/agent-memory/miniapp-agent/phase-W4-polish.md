# W4 — 内测打磨 + 完整集成验证 + 收尾

**状态：** ✅ 完成（2026-08-15）

## 范围说明

纯前端打磨阶段（`apps/miniapp/`），后端/契约零改动。遵循任务约束「不构建新功能」，只做设计一致性审查、交互打磨、响应式验证、集成冒烟补齐与已知限制逐条闭环。

## 构建了什么

### 设计打磨（design-enforcement）
1. **hover-class 按压反馈（关闭 W3 已知限制 #4）** — 新增全局 `.brand-hover`（`app.scss`，`opacity: 0.72`），替代微信默认灰蓝；8 页全部交互按钮（主按钮/次级/分段/chips/步进器/修正开关/展开/移除/上传）补 `hoverClass='brand-hover'`。
2. **图片懒加载（AC-W4.4 性能）** — history 缩略图、error-book 错题截图补 `lazyLoad`。
3. **登录测试 jsdom 警告消除（关闭 W2 已知限制 #4）** — `test/mocks/components.tsx` 的 Input mock 剥离 `maxlength`/`placeholderClass`（Taro 专属 prop 不落 DOM），Button mock 剥离 `hoverClass`。
4. **result 页去重** — 内联 `TYPE_LABELS`/`ERROR_CATEGORY_LABELS`/`formatRelativeTime` 改用 `lib/display.ts`（约 −35 行）；>30 天相对时间由 `toLocaleDateString('zh-CN')` 统一为 `M月D日`（与历史/详情/错题集一致，且不依赖 locale）。

### 集成冒烟测试
- `scripts/integration-smoke-test.sh` 新增 §10「Miniapp 全链路」：登录（静默已在 §9）→ 上传/批改/结果/历史/错题/练习表（复用 §5/§5b/§5d REST 端点）+ 补微信登录**绑定路径**（`{code, phone}` 401/502 wired + 非 11 位手机号 422）。

## 验证结果

```bash
# 小程序
cd apps/miniapp && npx tsc --noEmit      # 0 error
cd apps/miniapp && npm test               # 48 passed（登录 jsdom 警告已消除）
cd apps/miniapp && npm run build:weapp    # Compiled successfully

# 后端（Docker + MySQL，零代码改动，回归确认）
docker compose -f infra/docker-compose.yml run --rm backend pytest tests/ -q   # 31 passed
docker compose -f infra/docker-compose.yml run --rm backend ruff check . --ignore EXE002  # All checks passed

# Docker
docker compose -f infra/docker-compose.yml build   # 成功（backend + frontend）
```

> ruff 在 Docker 内报 39 条 `EXE002`（文件有 exec 位但无 shebang）——Windows 宿主机 `COPY . .` 进 Linux 镜像时文件默认 755 所致，**非代码问题**；原生（Windows）ruff 无此现象。`--ignore EXE002` 后全绿。

## Known Limitations → Accepted Technical Debt（逐条闭环）

### W1（4 条）
1. openid↔phone 无手机号真实性校验 → **已接受**（AD-13，正式发布前需 `getPhoneNumber`/短信）
2. `wechat-login` 无速率限制 → **已接受**（`jscode2session` 自身限流兜底）
3. API 基址硬编码 → **已解决**：`api.ts` 已用 `process.env.TARO_APP_API_BASE`（构建时注入，内测 IP:端口够用）；正式发布前仍需备案域名+HTTPS（AD-17）
4. 真机体验版域名校验 → **已接受**（需备案+HTTPS，每台手动「打开调试」）

### W2（4 条）
1. 小朋友管理（增删改）页未构建 → **升级为已接受技术债**：W4 明确「不构建新功能」，完整 CRUD 屏属功能而非打磨；MVP 小程序只读选择小朋友（Web 端创建），home 空小朋友态提示「请先在网页版添加小朋友」。理由：UX §2.3 children 屏超出 W4 打磨范围。
2. compressImage 已 ≤2048px 不重编码 → **已接受**（行为差异已记录，避免无谓重编码）
3. 图片 URL 基址 → 并入 W1#3
4. 登录测试 jsdom 警告 → **已修复**（见上）

### W3（4 条）
1. 错题试卷「保存到相册」未实现 → **升级为已接受技术债**：属新功能（`wx.saveImageToPhotosAlbum`+相册权限），超出 W4 打磨范围；验收仅要求「合成图预览」。
2. 历史 tab 不自动增量刷新 → **已接受**（切回 tab 用 `useDidShow` 刷第一页，预期行为）
3. 图片 URL phone 参数回归靠后端 → **已接受**（前端透传后端返回，不自行拼接）
4. hover-class 未加 → **已修复**（见上）

## Contract Deviations

无。纯前端，未改 `contracts/openapi.yaml`。

## 技术决策偏差（非契约）

- `.brand-hover` 用 `opacity`（0.72）而非 transform/transition：避免 hover-class 在部分基础库 transform 兼容差异；按压反馈即时生效，符合品牌 §9.1（≤100ms）。
- `lazyLoad` 仅加在滚动列表图片（history 缩略图 / error-book 错题截图），主内容图（result/detail 首屏、generate 合成图）不加，避免首屏延迟。

## 设计执行（design-enforcement 审计结论）

8 屏逐项核对 32 项反通用化清单，均 ≥27/32（通过线），字体/色彩两项门禁（≥5/7、≥5/6）全过：

- 禁用灰 0 命中；hex 仅 `#ffffff` + green `#16a34a/#dcfce7` + amber `#a16207/#fef9c3`，其余全 `var(--color-*)`。
- 每页 ≥3 字号、≥2 字重、≥3 间距；圆角按组件区分（按钮 24rpx / 卡片 28rpx / 输入 20rpx / 上传区 32rpx / badge 9999rpx）。
- 分数用 mono；按钮文案「开始批改/重新批改/再试一次/清除筛选/生成错题试卷」；UI 无「AI/模型/prompt」术语。
- 空状态有个性（历史 📋 / 错题 🎉 / 筛选后 🔍）。
- 小程序仅移动端、无桌面断点（`rpx` 天然适配），故清单 #17（桌面 480px 居中）与 #32 的 768px 分支不适用，按 N/A 计。

### 残留技术债（正式发布前统一待办）

> 已统一收敛至 [shared/release-backlog.md](../shared/release-backlog.md)，此处保留 v1 视角的原始记录。

- 备案域名 + HTTPS + `PUBLIC_BASE_URL`（AD-17，后端 + 小程序）
- `getPhoneNumber`/短信手机号真实性校验（AD-13）——**短信验证码已由 v2 X1 引入**（真实性校验已解决）；`getPhoneNumber` 一键登录仍排除（需企业主体）。
- ~~小程序小朋友 CRUD 页（UX §2.3）~~ —— **已由 v2 X5 完成**（`/pages/children` 管理页）。
- 错题试卷保存到相册
- Lucide 图标映射（Taro 版）：当前功能图标用 emoji（📸✏️🔍📋🎉💡✨），品牌 §7 要求 Lucide；小程序无现成 Taro 版 Lucide 组件，全量引入属新功能，超出 W4 打磨范围。

## Cross-Agent Requests

- **backend-agent / frontend-agent**：无待办（纯 miniapp，未动后端/契约/Web）。正式发布前统一待办见上「残留技术债」。
