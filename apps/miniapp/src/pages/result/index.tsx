import { useEffect, useState } from 'react'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'

import { apiGet, apiPatch } from '../../lib/api'
import type {
  FixQuestionResponse,
  GradedQuestion,
  ScoreSummary,
  Submission,
} from '@homework/api-types'

import './index.scss'

const TYPE_LABELS: Record<string, string> = {
  choice: '选择题',
  fill_blank: '填空题',
  reading: '阅读理解',
  composition: '作文',
  calculation: '计算题',
  word_problem: '应用题',
}

const ERROR_CATEGORY_LABELS: Record<string, string> = {
  grammar: '语法',
  vocabulary: '词汇',
  spelling: '拼写',
  logic: '逻辑',
  calculation: '计算',
  careless: '粗心',
  comprehension: '理解',
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN')
}

export default function Result() {
  const router = useRouter()
  const id = router.params.id ?? ''
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())
  const [savingQid, setSavingQid] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    apiGet<Submission>(`/api/submissions/${id}`)
      .then((data) => {
        if (!active) return
        setSubmission(data)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : '加载失败')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  const toggleNote = (qid: number) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(qid)) next.delete(qid)
      else next.add(qid)
      return next
    })
  }

  const handleToggleCorrect = async (q: GradedQuestion) => {
    if (!submission || savingQid !== null) return
    const newValue = !q.is_correct
    setSavingQid(q.id)
    const oldQuestions = submission.questions
    const oldScore = submission.score

    // 乐观更新：先改本地，PATCH 失败再回弹。
    const updatedQuestions = (submission.questions ?? []).map((item) =>
      item.id === q.id ? { ...item, is_correct: newValue, is_manually_fixed: true } : item,
    )
    const newCorrect = updatedQuestions.filter((i) => i.is_correct).length
    const newScore: ScoreSummary = {
      correct: newCorrect,
      total: submission.total_questions ?? updatedQuestions.length,
    }
    setSubmission({
      ...submission,
      questions: updatedQuestions,
      score: newScore,
      correct_count: newCorrect,
    })

    try {
      await apiPatch<FixQuestionResponse>(
        `/api/submissions/${submission.id}/questions/${q.id}`,
        { is_correct: newValue },
      )
      Taro.showToast({ title: newValue ? '已标记为正确' : '已标记为错误', icon: 'none' })
    } catch (err) {
      setSubmission((prev) =>
        prev
          ? { ...prev, questions: oldQuestions, score: oldScore, correct_count: oldScore?.correct ?? null }
          : prev,
      )
      Taro.showToast({
        title: err instanceof Error ? err.message : '保存失败，请重试',
        icon: 'none',
      })
    } finally {
      setSavingQid(null)
    }
  }

  const goHome = () => Taro.switchTab({ url: '/pages/index/index' })

  const previewImage = () => {
    if (submission?.annotated_image_url) {
      Taro.previewImage({
        urls: [submission.annotated_image_url],
        current: submission.annotated_image_url,
      })
    }
  }

  if (loading) {
    return (
      <View className='result' data-testid='result-skeleton'>
        <View className='result__skeleton result__skeleton--score' />
        <View className='result__skeleton result__skeleton--image' />
        <View className='result__skeleton result__skeleton--row' />
        <View className='result__skeleton result__skeleton--row' />
      </View>
    )
  }

  if (error || !submission) {
    return (
      <View className='result result--center'>
        <Text className='result__emoji'>😞</Text>
        <Text className='result__error'>{error ?? '加载失败'}</Text>
        <Button className='result__primary' onClick={goHome}>
          返回首页
        </Button>
      </View>
    )
  }

  const score = submission.score
  const questions = submission.questions ?? []
  const isGoodScore = score ? score.correct / score.total >= 0.6 : true

  return (
    <View className='result'>
      {score && (
        <View className='result__score'>
          <View className='result__score-left'>
            <Text className='result__score-label'>得分</Text>
            <Text
              className={`result__score-value ${
                isGoodScore ? 'result__score-value--good' : 'result__score-value--bad'
              }`}
            >
              {score.correct}/{score.total}
            </Text>
          </View>
          <View className='result__score-right'>
            <Text className='result__score-child'>{submission.child_name}</Text>
            <Text className='result__score-time'>{formatRelativeTime(submission.created_at)}</Text>
          </View>
        </View>
      )}

      {submission.annotated_image_url && (
        <View className='result__image'>
          <Image
            className='result__image-img'
            src={submission.annotated_image_url}
            mode='widthFix'
            ariaLabel='批改后试卷'
            onClick={previewImage}
          />
          <Text className='result__image-hint'>点击图片可放大查看</Text>
        </View>
      )}

      {questions.length > 0 ? (
        <View className='result__questions'>
          <Text className='result__questions-title'>逐题明细</Text>
          {questions.map((q) => {
            const expanded = expandedNotes.has(q.id)
            return (
              <View
                key={q.id}
                className={`result__question ${
                  q.is_correct ? 'result__question--correct' : 'result__question--wrong'
                }`}
              >
                <View className='result__question-head'>
                  <View className='result__question-meta'>
                    <Text className='result__question-no'>第 {q.question_number} 题</Text>
                    <Text className='result__question-type'>
                      {TYPE_LABELS[q.question_type] ?? q.question_type}
                    </Text>
                    {q.is_manually_fixed && (
                      <Text className='result__question-fixed'>已修正</Text>
                    )}
                  </View>
                  <View className='result__question-actions'>
                    <Button
                      className={`result__toggle ${
                        q.is_correct ? 'result__toggle--good' : 'result__toggle--bad'
                      } ${savingQid === q.id ? 'result__toggle--saving' : ''}`}
                      disabled={savingQid === q.id}
                      onClick={() => handleToggleCorrect(q)}
                      aria-label={q.is_correct ? '标记为错' : '标记为对'}
                    >
                      {q.is_correct ? '✓' : '?'}
                    </Button>
                    {q.solution_note && (
                      <Button
                        className='result__expand'
                        onClick={() => toggleNote(q.id)}
                        aria-label={expanded ? '收起' : '展开'}
                      >
                        {expanded ? '▲' : '▼'}
                      </Button>
                    )}
                  </View>
                </View>
                {q.solution_note && expanded && (
                  <View className='result__note'>
                    <Text className='result__note-text'>{q.solution_note}</Text>
                    {q.error_category && (
                      <Text className='result__note-category'>
                        {ERROR_CATEGORY_LABELS[q.error_category] ?? q.error_category}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </View>
      ) : (
        <View className='result__empty'>
          <Text className='result__empty-title'>暂无题目明细</Text>
          <Text className='result__empty-hint'>这张试卷没有识别出题目</Text>
        </View>
      )}

      <Button className='result__primary' onClick={goHome}>
        返回首页
      </Button>
    </View>
  )
}
