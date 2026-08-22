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

const DOCX_URL = 'http://test/api/images/sheets/uuid.docx?token=test-signed&expires=1893456000'
const IMG_URL = 'http://test/api/images/sheets/uuid.jpg?token=test-signed&expires=1893456000'

const TEXT_SHEET = {
  format: 'text',
  question_count: 1,
  docx_url: DOCX_URL,
  image_url: null,
  questions: [
    {
      question_number: '1',
      question_type: 'choice',
      subject: 'english',
      question_text: 'Choose the correct word.',
      question_latex: null,
      question_image_path: null,
      source_submission_id: 1,
    },
  ],
}

const IMAGE_SHEET = {
  format: 'image',
  question_count: 10,
  image_url: IMG_URL,
  questions: null,
  docx_url: null,
}

describe('ErrorGenerate > 错题试卷生成页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(Taro.useRouter).mockReturnValue({ params: {} } as never)
    mockApiGet.mockResolvedValue(CHILDREN)
  })

  it('renders the form, defaults to text format, and disables submit until a child is chosen', async () => {
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    expect(screen.getByText('英语')).toBeInTheDocument()
    expect(screen.getByText('数学')).toBeInTheDocument()
    expect(screen.getByText('文字试卷')).toBeInTheDocument()
    expect(screen.getByText('图片试卷')).toBeInTheDocument()
    expect(screen.getByText('选择题')).toBeInTheDocument()
    expect(screen.getByText('生成错题试卷')).toBeDisabled()
  })

  it('generates a text sheet by default (format=text) and renders the English stem without LaTeX', async () => {
    mockApiPost.mockResolvedValue(TEXT_SHEET)
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/请选择小朋友/))
    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('生成错题试卷'))

    await waitFor(() => expect(screen.getByText('已生成 1 道错题试卷')).toBeInTheDocument())
    expect(screen.getByText('Choose the correct word.')).toBeInTheDocument()
    expect(screen.getByText('题干')).toBeInTheDocument()
    expect(screen.getByText('作答区域')).toBeInTheDocument()
    expect(screen.getByText('预览 Word')).toBeInTheDocument()
    expect(mockApiPost).toHaveBeenCalledWith('/api/error-collections/generate', {
      child_id: 1,
      subject: 'english',
      count: 10,
      format: 'text',
    })
  })

  it('falls back to the screenshot for math stems and does not render LaTeX', async () => {
    mockApiPost.mockResolvedValue({
      ...TEXT_SHEET,
      questions: [
        {
          question_number: '2',
          question_type: 'calculation',
          subject: 'math',
          question_text: null,
          question_latex: '\\frac{1}{2}',
          question_image_path: 'http://test/api/images/questions/1_2.jpg?token=s&expires=1',
          source_submission_id: 1,
        },
      ],
    })
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/请选择小朋友/))
    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('生成错题试卷'))

    await waitFor(() => expect(screen.getByAltText('第2题')).toBeInTheDocument())
    expect(screen.queryByText('\\frac{1}{2}')).not.toBeInTheDocument()
    expect(screen.queryByText('题干')).not.toBeInTheDocument()
  })

  it('switches to image format (format=image) and renders the sheet image', async () => {
    mockApiPost.mockResolvedValue(IMAGE_SHEET)
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('图片试卷'))
    fireEvent.click(screen.getByText(/请选择小朋友/))
    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('生成错题试卷'))

    await waitFor(() => expect(screen.getByText('已生成 10 道错题试卷')).toBeInTheDocument())
    expect(screen.getByAltText('错题试卷')).toHaveAttribute('src', IMG_URL)
    expect(mockApiPost).toHaveBeenCalledWith('/api/error-collections/generate', {
      child_id: 1,
      subject: 'english',
      count: 10,
      format: 'image',
    })
  })

  it('downloads the docx and opens it via openDocument', async () => {
    vi.mocked(Taro.downloadFile).mockResolvedValue({ statusCode: 200, tempFilePath: '/tmp/x.docx' })
    vi.mocked(Taro.openDocument).mockResolvedValue({ errMsg: 'openDocument:ok' })
    mockApiPost.mockResolvedValue(TEXT_SHEET)
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/请选择小朋友/))
    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('生成错题试卷'))

    await waitFor(() => expect(screen.getByText('预览 Word')).toBeInTheDocument())
    fireEvent.click(screen.getByText('预览 Word'))

    await waitFor(() => expect(Taro.downloadFile).toHaveBeenCalledWith({ url: DOCX_URL }))
    await waitFor(() =>
      expect(Taro.openDocument).toHaveBeenCalledWith({
        filePath: '/tmp/x.docx',
        fileType: 'docx',
        showMenu: true,
      }),
    )
  })

  it('shows a file-too-large toast when the docx download fails', async () => {
    vi.mocked(Taro.downloadFile).mockRejectedValue(new Error('downloadFile:fail exceed max size'))
    mockApiPost.mockResolvedValue(TEXT_SHEET)
    render(<ErrorGenerate />)

    await waitFor(() => expect(screen.getByText(/请选择小朋友/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/请选择小朋友/))
    await waitFor(() => expect(screen.getByText(/小朋友1/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('生成错题试卷'))

    await waitFor(() => expect(screen.getByText('预览 Word')).toBeInTheDocument())
    fireEvent.click(screen.getByText('预览 Word'))

    await waitFor(() =>
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '文件过大，请到网页端下载' }),
      ),
    )
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
