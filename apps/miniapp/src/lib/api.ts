import Taro from '@tarojs/taro'

import type { WechatLoginRequest, WechatLoginResponse } from '@homework/api-types'

import { getPhone } from './storage'

// 内测阶段后端为本地/IP 部署（HTTP + IP:端口）。正式发布前需配置备案域名 + HTTPS
// 并改为可配置的 PUBLIC_BASE_URL（见 docs/architecture-wechat-miniapp.md AD-17）。
export const API_BASE = 'http://localhost:8000'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

function joinPhone(path: string): string {
  const phone = getPhone()
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}phone=${encodeURIComponent(phone)}`
}

async function request<T>(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: unknown
  withPhone?: boolean
}): Promise<T> {
  const { url, method = 'GET', data, withPhone = true } = options
  const finalUrl = withPhone ? joinPhone(url) : url

  const res = await Taro.request({
    url: `${API_BASE}${finalUrl}`,
    method,
    data,
    header: { 'Content-Type': 'application/json' },
  })

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as T
  }
  const detail =
    (res.data as { detail?: string } | undefined)?.detail || `HTTP ${res.statusCode}`
  throw new ApiError(res.statusCode, detail)
}

/** 微信登录/绑定：code 换取 openid，绑定或反查 phone。不携带 phone 查询参数。 */
export function wechatLogin(code: string, phone?: string): Promise<WechatLoginResponse> {
  const data: WechatLoginRequest = phone ? { code, phone } : { code }
  return request<WechatLoginResponse>({
    url: '/api/wechat-login',
    method: 'POST',
    data,
    withPhone: false,
  })
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
 * Multipart 上传（图片）。phone 走 URL 查询参数（契约约定），`image` 文件经
 * `Taro.uploadFile` 的 filePath 传，其余表单字段放 formData。
 */
export function apiUpload<T = unknown>(
  path: string,
  filePath: string,
  formData: Record<string, string>,
): Promise<T> {
  const url = `${API_BASE}${joinPhone(path)}`
  return Taro.uploadFile({
    url,
    filePath,
    name: 'image',
    formData,
  }).then((res) => {
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
