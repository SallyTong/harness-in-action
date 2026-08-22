---
name: release-backlog
description: Pre-release backlog — accepted technical debt and release blockers across v1 (W1~W4) + v2 (X1~X5)
metadata:
  type: project
  last_updated: 2026-08-22
---

# Release Backlog（正式发布前统一待办）

跨 v1（W1~W4）与 v2（X1~X5）积累的已接受技术债与发布前置项，按优先级分组；
每项标注来源与后续动作。**正式发布前逐条闭环。**

## A. 合规 / 部署（发布 blocker）

- [ ] **备案域名 + HTTPS + `PUBLIC_BASE_URL`**（AD-17，[W4 残留]）——小程序正式发布需 ICP 备案 + HTTPS；后端图片 / 文档 URL 基址须可配置。
- [ ] **纯 JWT 无法主动撤销**（AD-18，[arch-v2 §5]）——30 天 `exp` 内旧 token 有效；对外前升级可撤销会话（session / redis / 黑名单）。

## B. 安全增强

- [ ] **短信验证码内存存储**（[X1]）——单机内存 `_codes`，重启丢失；多机部署前迁 DB / Redis。
- [ ] **签名 URL TTL 内可被持有者访问**（[X1/X4]）——图片 + docx 签名 URL 1h 内可被任何持有 URL 者访问；家庭自用可接受，低优先级。

## C. 功能补全（v1 遗留，v2 未覆盖）

- [ ] **错题试卷「保存到相册」**（[W4 残留]）——小程序 `wx.saveImageToPhotosAlbum` + 相册权限。
- [ ] **Lucide 图标映射（Taro 版）**（[W4 残留]）——小程序当前 emoji 占位（📸✏️🔍📋🎉💡✨），品牌 §7 要求 Lucide。
- [ ] **`getPhoneNumber` 一键登录**（[AD-13]）——需企业主体资质；短信验证码已由 X1 引入。

## D. 质量 / 成本

- [ ] **题干文字转写不精确**（AD-24，[arch-v2 §5]）——手写 / 复杂公式可能出错；升级路径 `QuestionTextExtractor` 接独立 OCR（PaddleOCR / MinerU）。
- [ ] **短信服务成本核算**（[arch-v2 §5]）——阿里云短信按条计费，纳入 50 元/月预算之外的专项成本。

## E. 平台限制（无解，已接受）

- **小程序 docx 不落手机系统文件**（AD-26）——微信沙盒隔离，`wx.openDocument` 仅预览 / 分享；需长期保存走 Web 端下载。

## 已被 v2 解决（历史记录，非待办）

- ~~小程序小朋友 CRUD 页~~ → **X5 已建 `/pages/children` 管理页**。
- ~~短信手机号真实性校验（AD-13）~~ → **X1 已引入短信验证码登录**（真实性校验已解决；`getPhoneNumber` 一键登录见 C 组）。
