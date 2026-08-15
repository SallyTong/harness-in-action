import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'

import Login from './index'

describe('Login > 登录/绑定页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(Taro.getStorageSync).mockReturnValue('')
    vi.mocked(Taro.login).mockResolvedValue({ code: 'wx-code' })
    vi.mocked(Taro.request).mockResolvedValue({
      statusCode: 200,
      data: { phone: '13800138000' },
    })
  })

  it('renders brand, input, button and hint', () => {
    render(<Login />)
    expect(screen.getByText('AI 作业批改')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入家长手机号')).toBeInTheDocument()
    expect(screen.getByText('进入批改')).toBeInTheDocument()
    expect(screen.getByText('与网页版同一手机号，数据自动同步')).toBeInTheDocument()
  })

  it('disables submit until phone reaches 11 digits', () => {
    render(<Login />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('binds on submit: logs in, caches phone and re-launches home', async () => {
    render(<Login />)
    fireEvent.change(screen.getByPlaceholderText('请输入家长手机号'), {
      target: { value: '13800138000' },
    })
    expect(screen.getByRole('button')).toBeEnabled()

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(Taro.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://localhost:8000/api/wechat-login' }),
      )
      expect(Taro.setStorageSync).toHaveBeenCalledWith('parent_phone', '13800138000')
      expect(Taro.reLaunch).toHaveBeenCalledWith({ url: '/pages/index/index' })
    })
  })
})
