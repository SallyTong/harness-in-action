import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'

import Login from './index'

const mockApiPostPublic = vi.fn()
const mockIsAuthenticated = vi.fn(() => false)
const mockSetToken = vi.fn()

vi.mock('../../lib/api', () => ({
  apiPostPublic: (...args: unknown[]) => mockApiPostPublic(...args),
}))
vi.mock('../../lib/storage', () => ({
  isAuthenticated: () => mockIsAuthenticated(),
  setToken: (token: string) => mockSetToken(token),
}))

describe('Login > 登录页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockIsAuthenticated.mockReturnValue(false)
    mockApiPostPublic.mockResolvedValue({
      token: 'jwt-token',
      token_type: 'Bearer',
      expires_at: '2026-09-16T00:00:00Z',
      user_id: 1,
    })
  })

  it('renders brand, phone/code inputs and actions', () => {
    render(<Login />)
    expect(screen.getByText('欢迎使用')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入 11 位手机号')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('6 位验证码')).toBeInTheDocument()
    expect(screen.getByText('获取验证码')).toBeInTheDocument()
    expect(screen.getByText('登录')).toBeInTheDocument()
  })

  it('disables login until phone and code are both valid', () => {
    render(<Login />)
    expect(screen.getByRole('button', { name: '登录' })).toBeDisabled()
  })

  it('sends code and starts the resend countdown', async () => {
    mockApiPostPublic.mockResolvedValue({ retry_after: 60 })
    render(<Login />)

    fireEvent.change(screen.getByPlaceholderText('请输入 11 位手机号'), {
      target: { value: '13800138000' },
    })
    fireEvent.click(screen.getByText('获取验证码'))

    await waitFor(() => {
      expect(mockApiPostPublic).toHaveBeenCalledWith('/api/auth/send-code', {
        phone: '13800138000',
      })
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '验证码已发送' }),
      )
    })
    await waitFor(() => expect(screen.getByText(/后重发/)).toBeInTheDocument())
  })

  it('logs in, caches token and re-launches home', async () => {
    render(<Login />)

    fireEvent.change(screen.getByPlaceholderText('请输入 11 位手机号'), {
      target: { value: '13800138000' },
    })
    fireEvent.change(screen.getByPlaceholderText('6 位验证码'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByText('登录'))

    await waitFor(() => {
      expect(mockApiPostPublic).toHaveBeenCalledWith('/api/auth/login', {
        phone: '13800138000',
        code: '123456',
      })
      expect(mockSetToken).toHaveBeenCalledWith('jwt-token')
      expect(Taro.reLaunch).toHaveBeenCalledWith({ url: '/pages/index/index' })
    })
  })

  it('shows an error when login fails (wrong code)', async () => {
    mockApiPostPublic.mockRejectedValue(new Error('Invalid or expired code'))
    render(<Login />)

    fireEvent.change(screen.getByPlaceholderText('请输入 11 位手机号'), {
      target: { value: '13800138000' },
    })
    fireEvent.change(screen.getByPlaceholderText('6 位验证码'), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByText('登录'))

    await waitFor(() =>
      expect(screen.getByText('Invalid or expired code')).toBeInTheDocument(),
    )
  })

  it('skips to home when already authenticated', async () => {
    mockIsAuthenticated.mockReturnValue(true)
    render(<Login />)

    await waitFor(() =>
      expect(Taro.reLaunch).toHaveBeenCalledWith({ url: '/pages/index/index' }),
    )
  })
})
