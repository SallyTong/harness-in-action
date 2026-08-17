import Taro from '@tarojs/taro'

import { clearToken, getToken } from './storage'

// 内测阶段后端为本地/IP 部署（HTTP + IP:端口）。正式发布前需配置备案域名 + HTTPS
// 并改为可配置的 PUBLIC_BASE_URL（见 docs/architecture-wechat-miniapp.md AD-17）。
//
// 模拟器：localhost 指向电脑，默认即可。
// 真机：localhost 指向手机自己，须用电脑局域网 IP（手机与电脑同一 WiFi），构建时注入：
//   TARO_APP_API_BASE=http://192.168.x.x:8000 npm run dev:weapp
export const API_BASE = process.env.TARO_APP_API_BASE || 'http://localhost:8000'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

/** 会话过期：清 token 并回登录页（服务端无登出端点）。 */
export function redirectToLogin(): void {
  Taro.reLaunch({ url: '/pages/login/index' })
}

async function request<T>(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: unknown
  auth?: boolean
}): Promise<T> {
  const { url, method = 'GET', data, auth = true } = options
  const header: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) header.Authorization = `Bearer ${token}`
  }

  const res = await Taro.request({
    url: `${API_BASE}${url}`,
    method,
    data,
    header,
  })

  if (auth && res.statusCode === 401) {
    clearToken()
    redirectToLogin()
  }

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as T
  }
  const detail =
    (res.data as { detail?: string } | undefined)?.detail || `HTTP ${res.statusCode}`
  throw new ApiError(res.statusCode, detail)
}

export function apiGet<T = unknown>(path: string): Promise<T> {
  return request<T>({ url: path })
}

export function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>({ url: path, method: 'POST', data: body })
}

export function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>({ url: path, method: 'PUT', data: body })
}

export function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>({ url: path, method: 'PATCH', data: body })
}

export function apiDelete<T = void>(path: string): Promise<T> {
  return request<T>({ url: path, method: 'DELETE' })
}

/**
 * 公开端点（发码/登录）：不注入 Authorization，且 401 属于业务错误（验证码错误）
 * 而非会话过期，故不触发跳转登录。
 */
export function apiPostPublic<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>({ url: path, method: 'POST', data: body, auth: false })
}

/**
 * Multipart 上传（图片）。认证走 Authorization 头，`image` 文件经
 * `Taro.uploadFile` 的 filePath 传，其余表单字段放 formData。
 */
export function apiUpload<T = unknown>(
  path: string,
  filePath: string,
  formData: Record<string, string>,
): Promise<T> {
  const header: Record<string, string> = {}
  const token = getToken()
  if (token) header.Authorization = `Bearer ${token}`

  return Taro.uploadFile({
    url: `${API_BASE}${path}`,
    filePath,
    name: 'image',
    formData,
    header,
  }).then((res) => {
    if (res.statusCode === 401) {
      clearToken()
      redirectToLogin()
    }
    let data: unknown = {}
    try {
      data = JSON.parse(res.data)
    } catch {
      // 非 JSON 响应体（罕见），保留空对象
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return data as T
    }
    const detail =
      (data as { detail?: string } | undefined)?.detail || `HTTP ${res.statusCode}`
    throw new ApiError(res.statusCode, detail)
  })
}
