import { vi } from 'vitest'

// Mock of `@tarojs/taro` for jsdom tests. Pages import `Taro` (default) and call
// these methods; each is a vi.fn() so tests can stub return values and assert calls.
// Hooks (`useRouter`/`useDidShow`/`useDidHide`) are exported as named bindings too,
// because Taro re-exports them that way.
const Taro = {
  login: vi.fn(),
  request: vi.fn(),
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  reLaunch: vi.fn(),
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  switchTab: vi.fn(),
  showToast: vi.fn(),
  showModal: vi.fn(),
  showActionSheet: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  downloadFile: vi.fn(),
  openDocument: vi.fn(),
  chooseMedia: vi.fn(),
  compressImage: vi.fn(),
  getImageInfo: vi.fn(),
  uploadFile: vi.fn(),
  previewImage: vi.fn(),
  getCurrentInstance: vi.fn(() => ({ router: { path: '/pages/index/index' } })),
  eventCenter: {
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    trigger: vi.fn(),
  },
  useRouter: vi.fn(() => ({ params: {} })),
  useDidShow: vi.fn(() => {}),
  useDidHide: vi.fn(() => {}),
  useReachBottom: vi.fn(() => {}),
}

export const useRouter = Taro.useRouter
export const useDidShow = Taro.useDidShow
export const useDidHide = Taro.useDidHide
export const useReachBottom = Taro.useReachBottom

export default Taro
