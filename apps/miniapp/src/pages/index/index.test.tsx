import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'

import Home from './index'

const mockApiGet = vi.fn()
const mockApiUpload = vi.fn()
const mockCompressImage = vi.fn()

vi.mock('../../lib/api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiUpload: (...args: unknown[]) => mockApiUpload(...args),
}))
vi.mock('../../lib/image', () => ({
  compressImage: (...args: unknown[]) => mockCompressImage(...args),
}))

const CHILDREN = [
  { id: 1, name: '小朋友1', submission_count: 0, created_at: '2026-08-15T00:00:00Z' },
  { id: 2, name: '小朋友2', submission_count: 0, created_at: '2026-08-15T00:00:00Z' },
]

describe('Home > 拍照上传页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockApiGet.mockResolvedValue(CHILDREN)
    mockCompressImage.mockResolvedValue('/tmp/compressed.jpg')
    vi.mocked(Taro.chooseMedia).mockResolvedValue({
      tempFiles: [{ tempFilePath: '/tmp/raw.jpg' }],
    } as never)
    vi.mocked(Taro.showActionSheet).mockResolvedValue({ tapIndex: 0 } as never)
    mockApiUpload.mockResolvedValue({ submission_id: 1, status: 'pending' })
  })

  it('renders subject control, upload zone and disabled submit before image', async () => {
    render(<Home />)

    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())
    expect(screen.getByText('英语')).toBeInTheDocument()
    expect(screen.getByText('数学')).toBeInTheDocument()
    expect(screen.getByText('拍照上传试卷')).toBeInTheDocument()
    expect(screen.getByText('开始批改')).toBeDisabled()
  })

  it('selects an image and enables submit', async () => {
    render(<Home />)

    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('拍照上传试卷'))

    await waitFor(() => expect(mockCompressImage).toHaveBeenCalledWith('/tmp/raw.jpg'))
    expect(screen.getByText('已压缩，点击 ✕ 可移除')).toBeInTheDocument()
    expect(screen.getByText('开始批改')).toBeEnabled()
  })

  it('uploads and navigates to processing on submit', async () => {
    render(<Home />)

    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('拍照上传试卷'))
    await waitFor(() => expect(screen.getByText('开始批改')).toBeEnabled())

    fireEvent.click(screen.getByText('开始批改'))

    await waitFor(() => {
      expect(mockApiUpload).toHaveBeenCalledWith(
        '/api/submissions',
        '/tmp/compressed.jpg',
        { subject: 'english', child_id: '1' },
      )
      expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/processing/index?id=1' })
    })
  })

  it('shows guidance when no children are available', async () => {
    mockApiGet.mockResolvedValue([])
    render(<Home />)

    await waitFor(() =>
      expect(screen.getByText('请先在网页版添加小朋友')).toBeInTheDocument(),
    )
  })

  it('logs out: clears token and returns to login', async () => {
    render(<Home />)

    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('登出'))

    expect(Taro.removeStorageSync).toHaveBeenCalledWith('auth_token')
    expect(Taro.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' })
  })
})
