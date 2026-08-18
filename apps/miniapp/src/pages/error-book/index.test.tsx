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
      question_image_path: 'http://test/api/images/questions/1_2.jpg?token=test-signed&expires=1893456000',
      question_text: 'Choose the correct word.',
      question_latex: null,
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
    expect(screen.getByText('题干')).toBeInTheDocument()
    expect(screen.getByText('Choose the correct word.')).toBeInTheDocument()
    expect(screen.getByText('💡 解题思路')).toBeInTheDocument()
    expect(screen.getByText('✨ 生成错题试卷')).toBeInTheDocument()
  })

  it('renders English stem text without KaTeX', async () => {
    render(<ErrorBook />)

    await waitFor(() => expect(screen.getByText('Choose the correct word.')).toBeInTheDocument())
    // 英语题为纯文本，直接渲染题干文字（无 LaTeX）
    expect(screen.getByText('题干')).toBeInTheDocument()
  })

  it('falls back to 查看截图 for math (no plain text, no LaTeX rendered)', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith('/api/children')) return Promise.resolve(CHILDREN)
      return Promise.resolve({
        items: [
          {
            id: 2,
            submission_id: 2,
            child_id: 1,
            child_name: '小明',
            subject: 'math',
            question_number: '5',
            question_type: 'calculation',
            question_image_path:
              'http://test/api/images/questions/2_5.jpg?token=test-signed&expires=1893456000',
            question_text: null,
            question_latex: '\\frac{1}{2}',
            solution_note: null,
            error_category: 'calculation',
            error_count: 1,
            error_timestamps: ['2026-08-09T10:00:00Z'],
            is_manually_fixed: false,
            last_error_at: '2026-08-09T10:00:00Z',
            created_at: '2026-08-09T10:00:00Z',
          },
        ],
        total: 1,
      })
    })
    render(<ErrorBook />)

    await waitFor(() => expect(screen.getByText('查看截图 ›')).toBeInTheDocument())
    // 数学题不渲染 LaTeX 原始代码
    expect(screen.queryByText('\\frac{1}{2}')).not.toBeInTheDocument()
    expect(screen.queryByText('题干')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('查看截图 ›'))
    expect(Taro.previewImage).toHaveBeenCalledWith({
      current: 'http://test/api/images/questions/2_5.jpg?token=test-signed&expires=1893456000',
      urls: ['http://test/api/images/questions/2_5.jpg?token=test-signed&expires=1893456000'],
    })
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

    await waitFor(() => expect(screen.getByText('✨ 生成错题试卷')).toBeInTheDocument())
    fireEvent.click(screen.getByText('✨ 生成错题试卷'))

    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/error-generate/index' })
  })
})
