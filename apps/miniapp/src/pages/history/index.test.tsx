import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'

import History from './index'

const mockApiGet = vi.fn()
vi.mock('../../lib/api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}))

const CHILDREN = [
  { id: 1, name: '小朋友1', submission_count: 2, created_at: '2026-08-01T00:00:00Z' },
  { id: 2, name: '小朋友2', submission_count: 1, created_at: '2026-08-02T00:00:00Z' },
]

const PAGE1 = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  child_id: 1,
  child_name: i === 0 ? '小明' : `小朋友${i}`,
  subject: i % 2 === 0 ? 'english' : 'math',
  status: 'completed',
  score: { correct: 3, total: 4 },
  thumbnail_url: `http://test/api/images/thumbnails/${i + 1}.jpg?token=test-signed&expires=1893456000`,
  created_at: '2026-08-15T10:00:00Z',
}))

describe('History > 历史列表页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith('/api/children')) return Promise.resolve(CHILDREN)
      if (path.includes('offset=20')) {
        return Promise.resolve({
          items: [
            {
              id: 21,
              child_id: 1,
              child_name: '小红',
              subject: 'english',
              status: 'completed',
              score: { correct: 4, total: 5 },
              thumbnail_url: null,
              created_at: '2026-08-14T10:00:00Z',
            },
          ],
          total: 21,
        })
      }
      return Promise.resolve({ items: PAGE1, total: 21 })
    })
  })

  it('renders header, filters and cards', async () => {
    render(<History />)

    await waitFor(() => expect(screen.getByText('批改历史')).toBeInTheDocument())
    expect(screen.getByText('小明')).toBeInTheDocument()
    expect(screen.getAllByText('3/4').length).toBeGreaterThan(0)
    expect(screen.getAllByText('英语').length).toBeGreaterThan(0)
  })

  it('shows a skeleton while loading', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    render(<History />)

    expect(screen.getByTestId('history-skeleton')).toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith('/api/children')) return Promise.resolve(CHILDREN)
      return Promise.reject(new Error('加载失败'))
    })
    render(<History />)

    await waitFor(() => expect(screen.getByText('加载失败')).toBeInTheDocument())
    expect(screen.getByText('再试一次')).toBeInTheDocument()
  })

  it('shows an empty state with 去批改 action', async () => {
    mockApiGet.mockImplementation((path: string) => {
      if (path.startsWith('/api/children')) return Promise.resolve(CHILDREN)
      return Promise.resolve({ items: [], total: 0 })
    })
    render(<History />)

    await waitFor(() => expect(screen.getByText('还没有批改记录')).toBeInTheDocument())
    fireEvent.click(screen.getByText('去批改'))
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' })
  })

  it('loads more records and appends to the list', async () => {
    render(<History />)

    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument())
    expect(screen.getByText('加载更多')).toBeInTheDocument()

    fireEvent.click(screen.getByText('加载更多'))

    await waitFor(() => expect(screen.getByText('小红')).toBeInTheDocument())
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('offset=20'))
  })

  it('navigates to a submission detail', async () => {
    render(<History />)

    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument())
    fireEvent.click(screen.getByText('小明'))
    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/history-detail/index?id=1' })
  })
})
