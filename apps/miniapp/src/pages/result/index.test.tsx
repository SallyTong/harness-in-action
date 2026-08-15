import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'

import Result from './index'

const mockApiGet = vi.fn()
const mockApiPatch = vi.fn()
vi.mock('../../lib/api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPatch: (...args: unknown[]) => mockApiPatch(...args),
}))

function setRouter(id: string) {
  vi.mocked(Taro.useRouter).mockReturnValue({ params: { id } } as never)
}

const COMPLETED = {
  id: 1,
  child_id: 1,
  child_name: '小明',
  subject: 'english',
  status: 'completed',
  score: { correct: 3, total: 4 },
  thumbnail_url: null,
  created_at: '2026-08-09T10:00:00Z',
  original_image_url: 'http://test/api/images/originals/1.jpg',
  annotated_image_url: 'http://test/api/images/annotated/1.jpg',
  total_questions: 4,
  correct_count: 3,
  token_usage: null,
  questions: [
    {
      id: 1,
      question_number: '1',
      question_type: 'choice',
      is_correct: true,
      solution_note: null,
      error_category: null,
      is_manually_fixed: false,
    },
    {
      id: 2,
      question_number: '2',
      question_type: 'fill_blank',
      is_correct: false,
      solution_note: "正确答案应为 'have gone'。",
      error_category: 'grammar',
      is_manually_fixed: false,
    },
  ],
  updated_at: '2026-08-09T10:05:00Z',
}

describe('Result > 结果页', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setRouter('1')
  })

  it('renders score, image and questions when completed', async () => {
    mockApiGet.mockResolvedValue(COMPLETED)
    render(<Result />)

    await waitFor(() => expect(screen.getByText('小明')).toBeInTheDocument())
    expect(screen.getByText('3/4')).toBeInTheDocument()
    expect(screen.getByText('逐题明细')).toBeInTheDocument()
    expect(screen.getByAltText('批改后试卷')).toBeInTheDocument()
    expect(screen.getByText('第 1 题')).toBeInTheDocument()
  })

  it('shows a loading skeleton initially', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {}))
    render(<Result />)

    expect(screen.getByTestId('result-skeleton')).toBeInTheDocument()
  })

  it('shows an error state with home action', async () => {
    mockApiGet.mockRejectedValue(new Error('加载失败'))
    render(<Result />)

    await waitFor(() => expect(screen.getByText('加载失败')).toBeInTheDocument())
    expect(screen.getByText('返回首页')).toBeInTheDocument()
  })

  it('shows empty state when the submission has no questions', async () => {
    mockApiGet.mockResolvedValue({ ...COMPLETED, questions: [] })
    render(<Result />)

    await waitFor(() => expect(screen.getByText('暂无题目明细')).toBeInTheDocument())
    expect(screen.getByText('这张试卷没有识别出题目')).toBeInTheDocument()
  })

  it('toggles a question grade and persists via PATCH', async () => {
    mockApiGet.mockResolvedValue(COMPLETED)
    mockApiPatch.mockResolvedValue({
      question: { ...COMPLETED.questions[0], is_correct: false, is_manually_fixed: true },
      new_score: { correct: 2, total: 4 },
    })
    render(<Result />)

    await waitFor(() => expect(screen.getByText('逐题明细')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('标记为错'))

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/submissions/1/questions/1', {
        is_correct: false,
      })
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '已标记为错误' }),
      )
    })
  })
})
