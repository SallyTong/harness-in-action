import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'

import CustomTabBar from './index'

describe('CustomTabBar > 底部导航', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders three tab labels', () => {
    render(<CustomTabBar />)
    expect(screen.getByText('批改')).toBeInTheDocument()
    expect(screen.getByText('历史')).toBeInTheDocument()
    expect(screen.getByText('错题集')).toBeInTheDocument()
  })

  it('switches tab via switchTab on tap', () => {
    render(<CustomTabBar />)
    fireEvent.click(screen.getByText('历史'))
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/history/index' })

    fireEvent.click(screen.getByText('错题集'))
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/error-book/index' })
  })
})
