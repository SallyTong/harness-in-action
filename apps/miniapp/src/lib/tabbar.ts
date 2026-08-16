import Taro from '@tarojs/taro'

/** 自定义 tabBar 选中态同步事件名（页面 useDidShow 触发，custom-tab-bar 订阅）。 */
export const TAB_BAR_EVENT = 'tabbar:select'

export interface TabItem {
  path: string
  label: string
  icon: string
}

/** 底部 tabBar 三项（对齐 UX §1：🏠 批改 · 📋 历史 · 📕 错题集）。 */
export const TAB_ITEMS: TabItem[] = [
  { path: '/pages/index/index', label: '批改', icon: '🏠' },
  { path: '/pages/history/index', label: '历史', icon: '📋' },
  { path: '/pages/error-book/index', label: '错题集', icon: '📕' },
]

/** 页面 useDidShow 时调用，通知自定义 tabBar 更新选中态。 */
export function notifyTabBarSelected(index: number): void {
  Taro.eventCenter.trigger(TAB_BAR_EVENT, index)
}
