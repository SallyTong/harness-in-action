import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'

import ErrorGenerate from './index'

const mockApiGet = vi.fn()
const mockApiPost = vi.fn()
vi.mock('../../lib/api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}))

const CHILDREN = [
  { id: 1, name: '小朋友1', submission_count: 2, created_at: '2026-08-01T00:00:00Z' },
]

describe('ErrorGenerate > 错题试卷生成页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(Taro.useRouter).mockReturnValue({ params: {} } as never)
    mockApiGet.mockResolvedValue(CHILDREN)
  })

  it('renders the form and disables submit until a child is chosen', async () => {
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    expect(screen.getByText('英语')).toBeInTheDocument()
    expect(screen.getByText('数学')).toBeInTheDocument()
    expect(screen.getByText('选择题')).toBeInTheDocument()
    expect(screen.getByText('生成错题试卷')).toBeDisabled()
  })

  it('generates a sheet and previews the result', async () => {
    mockApiPost.mockResolvedValue({
      image_url: 'http://test/api/images/sheets/uuid.jpg?phone=13800138000',
      question_count: 10,
    })
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/请选择小朋友/)) // 触发 Picker onChange(value=0)

    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('生成错题试卷'))

    await waitFor(() => expect(screen.getByText('已生成 10 道错题试卷')).toBeInTheDocument())
    expect(screen.getByAltText('错题试卷')).toHaveAttribute(
      'src',
      'http://test/api/images/sheets/uuid.jpg?phone=13800138000',
    )
    expect(mockApiPost).toHaveBeenCalledWith('/api/error-collections/generate', {
      child_id: 1,
      subject: 'english',
      count: 10,
    })
  })

  it('shows a toast when generation fails', async () => {
    mockApiPost.mockRejectedValue(new Error('生成失败，请重试'))
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/请选择小朋友/))
    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())

    fireEvent.click(screen.getByText('生成错题试卷'))

    await waitFor(() =>
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '生成失败，请重试' }),
      ),
    )
  })

  it('shows a generating state while pending', async () => {
    mockApiPost.mockImplementation(() => new Promise(() => {}))
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/请选择小朋友/))
    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())

    fireEvent.click(screen.getByText('生成错题试卷'))

    await waitFor(() => expect(screen.getByText('正在生成…')).toBeInTheDocument())
  })

  it('renders with no children available', async () => {
    mockApiGet.mockResolvedValue([])
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    expect(screen.getByText('生成错题试卷')).toBeDisabled()
  })
})
