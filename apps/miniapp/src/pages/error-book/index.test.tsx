import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'

import ErrorBook from './index'

const mockApiGet = vi.fn()
vi.mock('../../lib/api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}))

const CHILDREN = [
  { id: 1, name: '小朋友1', submission_count: 2, created_at: '2026-08-01T00:00:00Z' },
]

const ERRORS = {
  items: [
    {
      id: 1,
      submission_id: 1,
      child_id: 1,
      child_name: '小明',
      subject: 'english',
      question_number: '2',
      question_type: 'fill_blank',
      question_image_path: 'http://test/api/images/questions/1_2.jpg?phone=13800138000',
      solution_note: "正确答案应为 'have gone'。",
      error_category: 'grammar',
      error_count: 1,
      error_timestamps: ['2026-08-09T10:00:00Z'],
      is_manually_fixed: false,
      last_error_at: '2026-08-09T10:00:00Z',
      created_at: '2026-08-09T10:00:00Z',
    },
  ],
  total: 1,
}

describe('ErrorBook > 错题集页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith('/api/children')) return Promise.resolve(CHILDREN)
      return Promise.resolve(ERRORS)
    })
  })

  it('renders stats, error cards and note', async () => {
    render(<ErrorBook />)

    await waitFor(() => expect(screen.getByText('共 1 道错题')).toBeInTheDocument())
    expect(screen.getByText('第 2 题')).toBeInTheDocument()
    expect(screen.getByText('填空题')).toBeInTheDocument()
    expect(screen.getByText('💡 解题思路')).toBeInTheDocument()
    expect(screen.getByText('✨ 生成练习表')).toBeInTheDocument()
  })

  it('shows a skeleton while loading', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    render(<ErrorBook />)

    expect(screen.getByTestId('errorbook-skeleton')).toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith('/api/children')) return Promise.resolve(CHILDREN)
      return Promise.reject(new Error('加载失败'))
    })
    render(<ErrorBook />)

    await waitFor(() => expect(screen.getByText('加载失败')).toBeInTheDocument())
    expect(screen.getByText('再试一次')).toBeInTheDocument()
  })

  it('shows an empty state with 去批改 action', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith('/api/children')) return Promise.resolve(CHILDREN)
      return Promise.resolve({ items: [], total: 0 })
    })
    render(<ErrorBook />)

    await waitFor(() => expect(screen.getByText('还没有错题，继续保持！')).toBeInTheDocument())
    fireEvent.click(screen.getByText('去批改'))
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' })
  })

  it('toggles the filter panel', async () => {
    render(<ErrorBook />)

    await waitFor(() => expect(screen.getByText('共 1 道错题')).toBeInTheDocument())
    fireEvent.click(screen.getByText('筛选'))

    await waitFor(() => expect(screen.getByText('小朋友')).toBeInTheDocument())
    expect(screen.queryByText('清除筛选')).not.toBeInTheDocument() // 无筛选时不显示清除

    fireEvent.click(screen.getByText('收起'))
    expect(screen.queryByText('小朋友')).not.toBeInTheDocument()
  })

  it('expands the solution note', async () => {
    render(<ErrorBook />)

    await waitFor(() => expect(screen.getByText('💡 解题思路')).toBeInTheDocument())
    expect(screen.queryByText("正确答案应为 'have gone'。")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('💡 解题思路'))

    await waitFor(() =>
      expect(screen.getByText("正确答案应为 'have gone'。")).toBeInTheDocument(),
    )
  })

  it('navigates to the generate page with current filters', async () => {
    render(<ErrorBook />)

    await waitFor(() => expect(screen.getByText('✨ 生成练习表')).toBeInTheDocument())
    fireEvent.click(screen.getByText('✨ 生成练习表'))

    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/error-generate/index' })
  })
})
