import { useEffect, useRef, useState } from 'react'
import { View, Text, Button, Image, Picker } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'

import { apiGet } from '../../lib/api'
import {
  ERROR_CATEGORY_LABELS,
  formatMonthDay,
  SUBJECT_LABELS,
  TYPE_LABELS,
} from '../../lib/display'
import type { Child, ErrorCollectionListResponse, ErrorQuestionItem } from '@homework/api-types'

import './index.scss'

const LIMIT = 20
const TYPE_KEYS = Object.keys(TYPE_LABELS)
const TIME_RANGES = [
  { label: '全部', value: '' },
  { label: '最近一周', value: '7d' },
  { label: '最近一月', value: '30d' },
]

type PickerDetail = { detail: { value: number | number[] | string | string[] } }

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export default function ErrorBook() {
  const [children, setChildren] = useState<Child[]>([])
  const [childId, setChildId] = useState<number | null>(null)
  const [subject, setSubject] = useState('')
  const [questionType, setQuestionType] = useState('')
  const [timeRange, setTimeRange] = useState('')

  const [errors, setErrors] = useState<ErrorQuestionItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const [showFilters, setShowFilters] = useState(false)
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())

  const loadedCount = useRef(0)

  const buildParams = (offset: number) => {
    const params: string[] = []
    if (childId !== null) params.push(`child_id=${childId}`)
    if (subject) params.push(`subject=${subject}`)
    if (questionType) params.push(`question_type=${questionType}`)
    if (timeRange === '7d') params.push(`from_date=${daysAgo(7)}`)
    else if (timeRange === '30d') params.push(`from_date=${daysAgo(30)}`)
    params.push(`limit=${LIMIT}`, `offset=${offset}`)
    return params.join('&')
  }

  useEffect(() => {
    let active = true
    apiGet<Child[]>('/api/children')
      .then((list) => {
        if (active) setChildren(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setLoadMoreError(null)

    apiGet<ErrorCollectionListResponse>(`/api/error-collections?${buildParams(0)}`)
      .then((data) => {
        if (!active) return
        setErrors(data.items)
        setTotal(data.total)
        loadedCount.current = data.items.length
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId, subject, questionType, timeRange, retryKey])

  const loadMore = async () => {
    if (loading || loadingMore || errors.length >= total) return
    const nextOffset = loadedCount.current
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const data = await apiGet<ErrorCollectionListResponse>(
        `/api/error-collections?${buildParams(nextOffset)}`,
      )
      setErrors((prev) => [...prev, ...data.items])
      setTotal(data.total)
      loadedCount.current = nextOffset + data.items.length
    } catch (err) {
      setLoadMoreError(err instanceof Error ? err.message : '加载更多失败')
    } finally {
      setLoadingMore(false)
    }
  }

  useReachBottom(loadMore)

  const applyFilterChange = (mutate: () => void) => {
    mutate()
    setErrors([])
    loadedCount.current = 0
  }

  const handleChildChange = (e: PickerDetail) => {
    const idx = Number(Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value)
    applyFilterChange(() => setChildId(idx === 0 ? null : children[idx - 1]?.id ?? null))
  }

  const handleSubjectChange = (e: PickerDetail) => {
    const idx = Number(Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value)
    applyFilterChange(() => setSubject(idx === 0 ? '' : idx === 1 ? 'english' : 'math'))
  }

  const handleTypeChange = (e: PickerDetail) => {
    const idx = Number(Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value)
    applyFilterChange(() => setQuestionType(idx === 0 ? '' : TYPE_KEYS[idx - 1] ?? ''))
  }

  const handleTimeChange = (e: PickerDetail) => {
    const idx = Number(Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value)
    applyFilterChange(() => setTimeRange(TIME_RANGES[idx]?.value ?? ''))
  }

  const clearFilters = () => {
    setChildId(null)
    setSubject('')
    setQuestionType('')
    setTimeRange('')
    setErrors([])
    loadedCount.current = 0
  }

  const toggleNote = (id: number) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasFilters = childId !== null || !!subject || !!questionType || !!timeRange
  const hasMore = errors.length < total

  const goGenerate = () => {
    const params: string[] = []
    if (childId !== null) params.push(`child_id=${childId}`)
    if (subject) params.push(`subject=${subject}`)
    if (questionType) params.push(`question_type=${questionType}`)
    const qs = params.length ? `?${params.join('&')}` : ''
    Taro.navigateTo({ url: `/pages/error-generate/index${qs}` })
  }

  const goGrade = () => Taro.switchTab({ url: '/pages/index/index' })

  const childPickerValue = childId === null ? 0 : children.findIndex((c) => c.id === childId) + 1
  const subjectPickerValue = subject === '' ? 0 : subject === 'english' ? 1 : 2
  const typePickerValue = questionType === '' ? 0 : TYPE_KEYS.indexOf(questionType) + 1
  const timePickerValue = timeRange === '' ? 0 : timeRange === '7d' ? 1 : 2

  return (
    <View className='errorbook'>
      <View className='errorbook__header'>
        <Text className='errorbook__title'>错题集</Text>
        <Button
          className={`errorbook__filter-toggle${
            showFilters || hasFilters ? ' errorbook__filter-toggle--active' : ''
          }`}
          onClick={() => setShowFilters((v) => !v)}
        >
          {showFilters ? '收起' : '筛选'}
        </Button>
      </View>

      {showFilters && (
        <View className='errorbook__filters'>
          <Picker
            mode='selector'
            range={['全部', ...children.map((c) => c.name)]}
            value={Math.max(0, childPickerValue)}
            onChange={handleChildChange}
          >
            <View className='errorbook__field'>
              <Text className='errorbook__field-label'>小朋友</Text>
              <Text className='errorbook__field-value'>
                {childId === null ? '全部' : children.find((c) => c.id === childId)?.name ?? '全部'} ▾
              </Text>
            </View>
          </Picker>
          <Picker
            mode='selector'
            range={['全部', '英语', '数学']}
            value={subjectPickerValue}
            onChange={handleSubjectChange}
          >
            <View className='errorbook__field'>
              <Text className='errorbook__field-label'>学科</Text>
              <Text className='errorbook__field-value'>
                {subject === '' ? '全部' : SUBJECT_LABELS[subject]} ▾
              </Text>
            </View>
          </Picker>
          <Picker
            mode='selector'
            range={['全部', ...TYPE_KEYS.map((k) => TYPE_LABELS[k])]}
            value={typePickerValue}
            onChange={handleTypeChange}
          >
            <View className='errorbook__field'>
              <Text className='errorbook__field-label'>题型</Text>
              <Text className='errorbook__field-value'>
                {questionType === '' ? '全部' : TYPE_LABELS[questionType]} ▾
              </Text>
            </View>
          </Picker>
          <Picker
            mode='selector'
            range={TIME_RANGES.map((t) => t.label)}
            value={timePickerValue}
            onChange={handleTimeChange}
          >
            <View className='errorbook__field'>
              <Text className='errorbook__field-label'>时间</Text>
              <Text className='errorbook__field-value'>
                {TIME_RANGES[timePickerValue]?.label ?? '全部'} ▾
              </Text>
            </View>
          </Picker>
          {hasFilters && (
            <Text className='errorbook__clear' onClick={clearFilters}>
              ↺ 清除筛选
            </Text>
          )}
        </View>
      )}

      {!loading && !error && (
        <Text className='errorbook__stats'>共 {total} 道错题</Text>
      )}

      {loading && (
        <View className='errorbook__list' data-testid='errorbook-skeleton'>
          {[1, 2, 3].map((i) => (
            <View key={i} className='errorbook__skeleton' />
          ))}
        </View>
      )}

      {error && !loading && (
        <View className='errorbook__state'>
          <Text className='errorbook__state-emoji'>😞</Text>
          <Text className='errorbook__state-text'>{error}</Text>
          <Button className='errorbook__primary' onClick={() => setRetryKey((k) => k + 1)}>
            再试一次
          </Button>
        </View>
      )}

      {!loading && !error && errors.length === 0 && (
        <View className='errorbook__state'>
          <Text className='errorbook__state-emoji'>{hasFilters ? '🔍' : '🎉'}</Text>
          <Text className='errorbook__state-title'>
            {hasFilters ? '没有符合条件的错题' : '还没有错题，继续保持！'}
          </Text>
          <Text className='errorbook__state-hint'>
            {hasFilters ? '试试调整筛选条件' : '去批改试卷，错题会自动收集到这里'}
          </Text>
          {hasFilters ? (
            <Button className='errorbook__secondary' onClick={clearFilters}>
              清除筛选
            </Button>
          ) : (
            <Button className='errorbook__primary' onClick={goGrade}>
              去批改
            </Button>
          )}
        </View>
      )}

      {!loading && !error && errors.length > 0 && (
        <View className='errorbook__list'>
          {errors.map((eq) => {
            const expanded = expandedNotes.has(eq.id)
            return (
              <View key={eq.id} className='errorbook__card'>
                {eq.question_image_path && (
                  <Image
                    className='errorbook__card-img'
                    src={eq.question_image_path}
                    mode='widthFix'
                    ariaLabel={`第${eq.question_number}题`}
                  />
                )}
                <View className='errorbook__card-info'>
                  <View className='errorbook__card-row'>
                    <View className='errorbook__card-meta'>
                      <Text className='errorbook__card-no'>第 {eq.question_number} 题</Text>
                      <Text className='errorbook__card-badge'>
                        {TYPE_LABELS[eq.question_type] ?? eq.question_type}
                      </Text>
                    </View>
                    <Text className='errorbook__card-date'>{formatMonthDay(eq.last_error_at)}</Text>
                  </View>
                  <Text className='errorbook__card-source'>
                    {eq.child_name} · {SUBJECT_LABELS[eq.subject] ?? eq.subject}
                  </Text>
                </View>
                {eq.solution_note && (
                  <View className='errorbook__note'>
                    <View className='errorbook__note-head' onClick={() => toggleNote(eq.id)}>
                      <Text className='errorbook__note-title'>💡 解题思路</Text>
                      <Text className='errorbook__note-arrow'>{expanded ? '▲' : '▼'}</Text>
                    </View>
                    {expanded && (
                      <View className='errorbook__note-body'>
                        <Text className='errorbook__note-text'>{eq.solution_note}</Text>
                        {eq.error_category && (
                          <Text className='errorbook__note-category'>
                            {ERROR_CATEGORY_LABELS[eq.error_category] ?? eq.error_category}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )
          })}

          {hasMore ? (
            <View className='errorbook__more'>
              <Button
                className='errorbook__more-btn'
                disabled={loadingMore}
                loading={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? '加载中…' : '加载更多'}
              </Button>
              {loadMoreError && (
                <Text className='errorbook__more-error' onClick={loadMore}>
                  加载失败，点击重试
                </Text>
              )}
            </View>
          ) : (
            <Text className='errorbook__end'>—— 已显示全部错题 ——</Text>
          )}
        </View>
      )}

      {errors.length > 0 && (
        <View className='errorbook__bar'>
          <Button className='errorbook__bar-btn' onClick={goGenerate}>
            ✨ 生成错题试卷
          </Button>
        </View>
      )}
    </View>
  )
}
