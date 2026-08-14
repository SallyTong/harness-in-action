---
paths:
  - "apps/miniapp/**"
---

# Miniapp Conventions

Rules that would cause real bugs or brand violations if forgotten. Full design system is in `docs/brand-identity.md`; miniapp architecture in `docs/architecture-wechat-miniapp.md`.

## Non-Negotiable

### Brand Compliance
- **Forbidden Tailwind classes**: `bg-gray-*`, `bg-zinc-*`, `bg-slate-*`, `bg-neutral-*`, `text-gray-*`, `text-zinc-*`, `text-slate-*`, `text-neutral-*`. Use project tokens or indigo/red/green/amber series.
- **Component-specific radii**: buttons `rounded-xl` (12px), cards `rounded-[14px]`, inputs `rounded-[10px]`, upload zone `rounded-2xl`, badges `rounded-full`, toasts `rounded-[10px]`. Uniform `rounded-lg` everywhere is forbidden.
- **Typography**: Minimum 3 different font sizes per page. Score numbers use `font-mono`. Map brand px tokens to rpx (1px = 2rpx).
- **Spacing**: Minimum 3 different spacing values per page. `p-4 gap-4` everywhere is forbidden.
- **Icons**: Lucide Icons via Taro icon component. Sizes: 44rpx nav, 32rpx inline, 96rpx empty state. Status check/cross use custom SVG.
- **Copywriting**: No "模型", "prompt", "AI 生成" in UI. Use "批改" not "AI 批改". Buttons: "开始批改", "重新批改", "保存修改", "移除".

### Mobile-First (rpx)
- Design at 375px → 750rpx width. Touch targets ≥ 88rpx (≈44px).
- Miniapp has **no desktop breakpoint**. Use `rpx` units, not px.

### API and State
- Every API call handles **loading + success + error** states.
- Loading states: skeleton screens matching content layout, not full-page spinners.
- Empty states: specific message + clear action button per `docs/ux-spec-wechat-miniapp.md`.
- `Taro.request` / `Taro.uploadFile` only, no axios. Phone from `Taro.getStorageSync`, sent as `?phone=` (or `X-Parent-Phone` header). Never log phone.
- Login: `wx.login()` → `POST /api/wechat-login` (bind on first use, silent login after). Cache phone via `Taro.setStorageSync`. Never cache `code`; never log `openid`.

### Image Upload
- Client-side compression: max 2048px longest edge, JPEG Q80% (`Taro.compressImage` or canvas).
- Use `wx.chooseMedia` (`sourceType: ['camera','album']`), never `<input capture>`.
- Show preview before upload. Progress via `wx.uploadFile` `onProgressUpdate`.

### Native Components (WeChat idioms)
- Toast: `wx.showToast`. Confirm dialog: `wx.showModal`. Action sheet: `wx.showActionSheet`. Image preview: `wx.previewImage` (native pinch zoom).
- Do NOT rebuild these with custom components.

### Routing (Taro pages)
`/pages/index/index`, `/pages/history/index` (tabBar), `/pages/login/index`, `/pages/children/index`, `/pages/processing/index`, `/pages/result/index`, `/pages/history-detail/index`.

### Polling & Background
- Poll `GET /api/submissions/{id}` every 2s; pause in `onHide`, resume + immediate re-query in `onShow`.
