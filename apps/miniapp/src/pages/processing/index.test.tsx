import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'

import Processing from './index'

const mockApiGet = vi.fn()
vi.mock('../../lib/api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}))

function setRouter(id: string) {
  vi.mocked(Taro.useRouter).mockReturnValue({ params: { id } } as never)
}

describe('Processing > 批改中页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setRouter('1')
  })

  it('renders processing state and polls on mount', async () => {
    mockApiGet.mockResolvedValue({ status: 'pending' })
    render(<Processing />)

    expect(screen.getByText('通常需要 5-15 秒')).toBeInTheDocument()
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/submissions/1'))
  })

  it('redirects to result when grading completes', async () => {
    mockApiGet.mockResolvedValue({ status: 'completed' })
    render(<Processing />)

    await waitFor(() => {
      expect(Taro.redirectTo).toHaveBeenCalledWith({ url: '/pages/result/index?id=1' })
    })
  })

  it('shows error state when grading fails', async () => {
    mockApiGet.mockResolvedValue({ status: 'failed' })
    render(<Processing />)

    await waitFor(() => expect(screen.getByText('批改失败，请重试')).toBeInTheDocument())
    expect(screen.getByText('重新批改')).toBeInTheDocument()
    expect(screen.getByText('返回首页')).toBeInTheDocument()
  })

  it('shows timeout warning after 30s of pending', async () => {
    vi.useFakeTimers()
    try {
      mockApiGet.mockResolvedValue({ status: 'pending' })
      render(<Processing />)

      await vi.advanceTimersByTimeAsync(40000)

      expect(screen.getByText('批改时间较长，请稍候或重试')).toBeInTheDocument()
      expect(screen.getByText('继续等待')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
