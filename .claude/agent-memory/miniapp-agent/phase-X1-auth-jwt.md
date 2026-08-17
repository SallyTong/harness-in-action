# Phase X1 — 认证登录（SMS + JWT，去 phone 化，移除 wechat-login）

**Status:** ✅ 完成（2026-08-16）。

## 交付

- `src/pages/login/index.tsx` — 改造为 手机号 + 6 位验证码 + 60s 倒计时；已登录（JWT 缓存）直接 `reLaunch` 首页。
- `src/lib/storage.ts` — JWT 存 `Taro.*StorageSync`（key `auth_token`，与 Web 同 key）；`getToken`/`setToken`/`clearToken`/`isAuthenticated`。
- `src/lib/api.ts` — `request()` 注入 `Authorization: Bearer <token>`；401 → 清 token → `redirectToLogin`；新增 `apiPostPublic`（auth=false，发码/登录 401 不触发跳转）；`apiUpload` 走 Bearer 头 + `Taro.uploadFile`。
- 移除 `wechat-login`：删除 `wx.login()` + `POST /api/wechat-login` 调用与相关逻辑；小程序登录与 Web 统一走 SMS。

## 变更

- 各页面图片 URL 直接透传后端返回的签名 URL（不手工拼 `?phone=`）。
- 首页入口：已登录才进入，否则跳登录页。

## 测试

`pages/login/index.test.tsx` 更新（发码/登录/倒计时/已登录跳转）；各页面测试适配 Bearer。

## 已知限制 / 已接受技术债

1. 纯 JWT 无撤销，30 天内旧 token 有效（AD-18）。
2. 短信验证码内存存储，重启丢失（单机）。
3. 图片签名 URL 在 TTL（1h）内可被持有者访问。

## 契约偏差

无（按 `contracts/openapi.yaml` v0.2.0 实现）。
