import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'

import Children from './index'

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
const mockApiPut = vi.fn()
const mockApiDelete = vi.fn()

vi.mock('../../lib/api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
  apiDelete: (...args: unknown[]) => mockApiDelete(...args),
}))

const CHILDREN = [
  {
    id: 1,
    name: '小明',
    grade: '三年级',
    note: '英语薄弱',
    avatar: null,
    submission_count: 3,
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 2,
    name: '小红',
    grade: '五年级',
    note: null,
    avatar: null,
    submission_count: 0,
    created_at: '2026-08-02T00:00:00Z',
  },
]

describe('Children > 小朋友管理页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockApiGet.mockResolvedValue(CHILDREN)
    mockApiPost.mockResolvedValue({ ...CHILDREN[0], id: 3 })
    mockApiPut.mockResolvedValue(CHILDREN[0])
    mockApiDelete.mockResolvedValue(undefined)
  })

  it('renders children with name, grade and graded count', async () => {
    render(<Children />)

    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument())
    expect(screen.getByText('三年级')).toBeInTheDocument()
    expect(screen.getByText('已批改 3 次')).toBeInTheDocument()
    expect(screen.getByText('英语薄弱')).toBeInTheDocument()
    expect(screen.getByText('小红')).toBeInTheDocument()
    expect(screen.getByText('五年级')).toBeInTheDocument()
  })

  it('shows skeleton while loading', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}))
    render(<Children />)

    expect(screen.getByTestId('children-skeleton')).toBeInTheDocument()
  })

  it('shows error state with retry on load failure', async () => {
    mockApiGet.mockRejectedValue(new Error('加载失败'))
    render(<Children />)

    await waitFor(() => expect(screen.getByText('加载失败')).toBeInTheDocument())
    expect(screen.getByText('再试一次')).toBeInTheDocument()
  })

  it('shows empty state when there are no children', async () => {
    mockApiGet.mockResolvedValue([])
    render(<Children />)

    await waitFor(() => expect(screen.getByText('还没有小朋友')).toBeInTheDocument())
  })

  it('creates a child via the add form', async () => {
    render(<Children />)
    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument())

    fireEvent.click(screen.getByText('+ 添加小朋友'))
    fireEvent.change(screen.getByPlaceholderText('请输入小朋友名字'), {
      target: { value: '小刚' },
    })
    fireEvent.change(screen.getByPlaceholderText('可记录孩子的特点、学习进度等'), {
      target: { value: '数学好' },
    })
    fireEvent.click(screen.getByText('添加'))

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/children', {
        name: '小刚',
        grade: '五年级',
        note: '数学好',
      })
    })
  })

  it('opens the edit form pre-filled and saves changes', async () => {
    render(<Children />)
    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('编辑')[0])

    expect(screen.getByText('编辑小朋友')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入小朋友名字')).toHaveValue('小明')

    fireEvent.change(screen.getByPlaceholderText('请输入小朋友名字'), {
      target: { value: '小明仔' },
    })
    fireEvent.click(screen.getByText('保存修改'))

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/api/children/1', {
        name: '小明仔',
        grade: '三年级',
        note: '英语薄弱',
      })
    })
  })

  it('deletes a child after confirmation', async () => {
    vi.mocked(Taro.showModal).mockResolvedValue({ confirm: true, cancel: false } as never)
    render(<Children />)
    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('移除')[0])

    await waitFor(() => {
      expect(Taro.showModal).toHaveBeenCalled()
      expect(mockApiDelete).toHaveBeenCalledWith('/api/children/1')
    })
  })

  it('does not delete when the modal is cancelled', async () => {
    vi.mocked(Taro.showModal).mockResolvedValue({ confirm: false, cancel: true } as never)
    render(<Children />)
    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('移除')[0])

    await waitFor(() => expect(Taro.showModal).toHaveBeenCalled())
    expect(mockApiDelete).not.toHaveBeenCalled()
  })

  it('blocks saving with an empty name', async () => {
    render(<Children />)
    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument())

    fireEvent.click(screen.getByText('+ 添加小朋友'))
    fireEvent.click(screen.getByText('添加'))

    await waitFor(() =>
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '请填写小朋友名字' }),
      ),
    )
    expect(mockApiPost).not.toHaveBeenCalled()
  })
})
