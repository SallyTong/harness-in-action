---
paths:
  - "apps/frontend/**"
---

# Frontend Conventions

Rules that would cause real bugs or brand violations if forgotten. Full design system is in `docs/brand-identity.md`.

## Non-Negotiable

### Brand Compliance
- **Forbidden Tailwind classes**: `bg-gray-*`, `bg-zinc-*`, `bg-slate-*`, `bg-neutral-*`, `text-gray-*`, `text-zinc-*`, `text-slate-*`, `text-neutral-*`. Use project tokens or indigo/red/green/amber series.
- **Component-specific radii**: buttons `rounded-xl` (12px), cards `rounded-[14px]`, inputs `rounded-[10px]`, upload zone `rounded-2xl`, badges `rounded-full`, toasts `rounded-[10px]`. Uniform `rounded-lg` everywhere is forbidden.
- **Typography**: Minimum 3 different font sizes per page. Score numbers use `font-mono`.
- **Spacing**: Minimum 3 different spacing values per page. `p-4 gap-4` everywhere is forbidden.
- **Icons**: Lucide Icons only. Sizes: 22px nav, 16px inline, 48px empty state. Status check/cross use custom SVG.
- **Copywriting**: No "模型", "prompt", "AI 生成" in UI. Use "批改" not "AI 批改". Buttons: "开始批改", "重新批改", "保存修改", "移除".

### Mobile-First
- Design at 375px. Touch targets at least 44px (`min-h-11 min-w-11`). Use `min-h-dvh` for full-screen.
- Desktop: max-width 480px centered.

### API and State
- Every API call handles **loading + success + error** states.
- Loading states: skeleton screens matching content layout, not full-page spinners.
- Empty states: specific message + clear action button per UX spec.
- `fetch` only, no Axios. Auth via `Authorization: Bearer <token>` from `localStorage`; image URLs use the API-returned signed URL (never hand-assemble `?phone=`). Never log the phone or token.

### Image Upload
- Client-side compression: max 2048px longest edge, JPEG Q80%.
- Use `capture="environment"` for camera. HEIC detected and rejected with guidance message (conversion not yet implemented).
- Show preview before upload. Display progress.

### Routing (React Router v7)
`/`, `/children`, `/submissions/:id/processing`, `/submissions/:id/result`, `/submissions/:id`, `/history`, `/errors`, `/errors/generate`.
