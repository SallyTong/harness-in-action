import { vi } from 'vitest'

// Mock of `@tarojs/taro` for jsdom tests. Pages import `Taro` (default) and call
// these methods; each is a vi.fn() so tests can stub return values and assert calls.
const Taro = {
  login: vi.fn(),
  request: vi.fn(),
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  reLaunch: vi.fn(),
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  showToast: vi.fn(),
}

export default Taro
