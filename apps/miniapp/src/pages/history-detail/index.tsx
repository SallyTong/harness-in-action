import { useEffect, useState } from 'react'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'

import { apiGet, apiPatch } from '../../lib/api'
import {
  ERROR_CATEGORY_LABELS,
  formatRelativeTime,
  TYPE_LABELS,
} from '../../lib/display'
import type {
  FixQuestionResponse,
  GradedQuestion,
  ScoreSummary,
  Submission,
} from '@homework/api-types'

import './index.scss'

type ViewMode = 'original' | 'annotated'

export default function HistoryDetail() {
  const router = useRouter()
  const id = router.params.id ?? ''
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [view, setView] = useState<ViewMode>('annotated')
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())
  const [savingQid, setSavingQid] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
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
  }, [id, retryKey])

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

  if (loading) {
    return (
      <View className='detail' data-testid='detail-skeleton'>
        <View className='detail__skeleton detail__skeleton--score' />
        <View className='detail__skeleton detail__skeleton--image' />
        <View className='detail__skeleton detail__skeleton--row' />
        <View className='detail__skeleton detail__skeleton--row' />
      </View>
    )
  }

  if (error || !submission) {
    return (
      <View className='detail detail--center'>
        <Text className='detail__emoji'>😞</Text>
        <Text className='detail__error'>{error ?? '加载失败'}</Text>
        <Button className='detail__primary' hoverClass='brand-hover' onClick={() => setRetryKey((k) => k + 1)}>
          再试一次
        </Button>
      </View>
    )
  }

  const score = submission.score
  const questions = submission.questions ?? []
  const originalUrl = submission.original_image_url
  const annotatedUrl = submission.annotated_image_url
  const activeUrl = view === 'original' ? originalUrl ?? annotatedUrl : annotatedUrl ?? originalUrl
  const isGoodScore = score ? score.correct / score.total >= 0.6 : true

  const previewImage = () => {
    if (activeUrl) {
      Taro.previewImage({ urls: [activeUrl], current: activeUrl })
    }
  }

  return (
    <View className='detail'>
      {score && (
        <View className='detail__score'>
          <View className='detail__score-left'>
            <Text className='detail__score-label'>得分</Text>
            <Text
              className={`detail__score-value ${
                isGoodScore ? 'detail__score-value--good' : 'detail__score-value--bad'
              }`}
            >
              {score.correct}/{score.total}
            </Text>
          </View>
          <View className='detail__score-right'>
            <Text className='detail__score-child'>{submission.child_name}</Text>
            <Text className='detail__score-time'>{formatRelativeTime(submission.created_at)}</Text>
          </View>
        </View>
      )}

      {(originalUrl || annotatedUrl) && (
        <View className='detail__image'>
          <View className='detail__seg'>
            <Button
              className={`detail__seg-item${view === 'annotated' ? ' detail__seg-item--active' : ''}`}
              hoverClass='brand-hover'
              onClick={() => setView('annotated')}
              disabled={!annotatedUrl}
            >
              批改后
            </Button>
            <Button
              className={`detail__seg-item${view === 'original' ? ' detail__seg-item--active' : ''}`}
              hoverClass='brand-hover'
              onClick={() => setView('original')}
              disabled={!originalUrl}
            >
              原图
            </Button>
          </View>
          {activeUrl && (
            <>
              <Image
                className='detail__image-img'
                src={activeUrl}
                mode='widthFix'
                ariaLabel={view === 'original' ? '原图' : '批改后试卷'}
                onClick={previewImage}
              />
              <Text className='detail__image-hint'>点击图片可放大查看</Text>
            </>
          )}
        </View>
      )}

      {questions.length > 0 ? (
        <View className='detail__questions'>
          <Text className='detail__questions-title'>逐题明细</Text>
          {questions.map((q) => {
            const expanded = expandedNotes.has(q.id)
            return (
              <View
                key={q.id}
                className={`detail__question ${
                  q.is_correct ? 'detail__question--correct' : 'detail__question--wrong'
                }`}
              >
                <View className='detail__question-head'>
                  <View className='detail__question-meta'>
                    <Text className='detail__question-no'>第 {q.question_number} 题</Text>
                    <Text className='detail__question-type'>
                      {TYPE_LABELS[q.question_type] ?? q.question_type}
                    </Text>
                    {q.is_manually_fixed && (
                      <Text className='detail__question-fixed'>已修正</Text>
                    )}
                  </View>
                  <View className='detail__question-actions'>
                    <Button
                      className={`detail__toggle ${
                        q.is_correct ? 'detail__toggle--good' : 'detail__toggle--bad'
                      } ${savingQid === q.id ? 'detail__toggle--saving' : ''}`}
                      hoverClass='brand-hover'
                      disabled={savingQid === q.id}
                      onClick={() => handleToggleCorrect(q)}
                      aria-label={q.is_correct ? '标记为错' : '标记为对'}
                    >
                      {q.is_correct ? '✓' : '?'}
                    </Button>
                    {q.solution_note && (
                      <Button
                        className='detail__expand'
                        hoverClass='brand-hover'
                        onClick={() => toggleNote(q.id)}
                        aria-label={expanded ? '收起' : '展开'}
                      >
                        {expanded ? '▲' : '▼'}
                      </Button>
                    )}
                  </View>
                </View>
                {q.solution_note && expanded && (
                  <View className='detail__note'>
                    <Text className='detail__note-text'>{q.solution_note}</Text>
                    {q.error_category && (
                      <Text className='detail__note-category'>
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
        <View className='detail__empty'>
          <Text className='detail__empty-title'>暂无题目明细</Text>
          <Text className='detail__empty-hint'>这张试卷没有识别出题目</Text>
        </View>
      )}
    </View>
  )
}
