import Taro from '@tarojs/taro'

// JWT 本地缓存（与 Web 端 apps/frontend/src/lib/auth.ts 同 key）。登录成功后写入，
// 30 天有效期内免重复登录；业务请求 401 时清空并回登录页。
const TOKEN_KEY = 'auth_token'

export function getToken(): string {
  return Taro.getStorageSync(TOKEN_KEY) || ''
}

export function setToken(token: string): void {
  Taro.setStorageSync(TOKEN_KEY, token)
}

export function clearToken(): void {
  Taro.removeStorageSync(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return getToken().length > 0
}
