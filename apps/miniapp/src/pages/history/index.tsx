import { useEffect, useRef, useState } from 'react'
import { View, Text, Button, Image, Picker } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'

import { apiGet } from '../../lib/api'
import { formatRelativeTime, SUBJECT_LABELS } from '../../lib/display'
import { notifyTabBarSelected } from '../../lib/tabbar'
import type { Child, SubmissionListResponse, SubmissionSummary } from '@homework/api-types'

import './index.scss'

const LIMIT = 20

type ChildChangeDetail = { detail: { value: number | number[] | string | string[] } }

export default function History() {
  const [children, setChildren] = useState<Child[]>([])
  const [childFilter, setChildFilter] = useState<number | null>(null)
  const [subjectFilter, setSubjectFilter] = useState<string>('')

  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  // 已加载条数（load-more 的 offset），用 ref 避免 useReachBottom 回调闭包取到旧值。
  const loadedCount = useRef(0)
  const initialShown = useRef(false)

  const buildParams = (offset: number) => {
    const params: string[] = []
    if (childFilter !== null) params.push(`child_id=${childFilter}`)
    if (subjectFilter) params.push(`subject=${subjectFilter}`)
    params.push(`limit=${LIMIT}`, `offset=${offset}`)
    return params.join('&')
  }

  // 筛选栏的小朋友列表（只读，失败静默降级为「全部」）。
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

  // 首屏 + 筛选变化 + 重试：从 offset=0 拉第一页，替换列表。
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setLoadMoreError(null)

    apiGet<SubmissionListResponse>(`/api/submissions?${buildParams(0)}`)
      .then((data) => {
        if (!active) return
        setSubmissions(data.items)
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
  }, [childFilter, subjectFilter, retryKey])

  // 切回历史 tab 时刷新第一页（批改/修正后返回能见最新记录与分数）+ 同步 tabBar。
  useDidShow(() => {
    notifyTabBarSelected(1)
    if (!initialShown.current) {
      initialShown.current = true
      return
    }
    setSubmissions([])
    loadedCount.current = 0
    setRetryKey((k) => k + 1)
  })

  const loadMore = async () => {
    if (loading || loadingMore || submissions.length >= total) return
    const nextOffset = loadedCount.current
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const data = await apiGet<SubmissionListResponse>(`/api/submissions?${buildParams(nextOffset)}`)
      setSubmissions((prev) => [...prev, ...data.items])
      setTotal(data.total)
      loadedCount.current = nextOffset + data.items.length
    } catch (err) {
      // 失败不回退 offset，重试仍从同一位置拉取，避免跳页。
      setLoadMoreError(err instanceof Error ? err.message : '加载更多失败')
    } finally {
      setLoadingMore(false)
    }
  }

  useReachBottom(loadMore)

  const handleChildFilterChange = (e: ChildChangeDetail) => {
    const raw = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value
    const idx = Number(raw)
    const childId = idx === 0 ? null : children[idx - 1]?.id ?? null
    setChildFilter(childId)
    setSubmissions([])
    loadedCount.current = 0
  }

  const handleSubjectFilterChange = (e: ChildChangeDetail) => {
    const raw = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value
    const idx = Number(raw)
    const subject = idx === 0 ? '' : idx === 1 ? 'english' : 'math'
    setSubjectFilter(subject)
    setSubmissions([])
    loadedCount.current = 0
  }

  const goDetail = (id: number) => Taro.navigateTo({ url: `/pages/history-detail/index?id=${id}` })
  const goGrade = () => Taro.switchTab({ url: '/pages/index/index' })

  const hasMore = submissions.length < total
  const childPickerValue = childFilter === null ? 0 : children.findIndex((c) => c.id === childFilter) + 1
  const subjectPickerValue = subjectFilter === '' ? 0 : subjectFilter === 'english' ? 1 : 2

  return (
    <View className='history'>
      <View className='history__header'>
        <Text className='history__title'>批改历史</Text>
      </View>

      <View className='history__filters'>
        <Picker
          mode='selector'
          range={['全部', ...children.map((c) => c.name)]}
          value={Math.max(0, childPickerValue)}
          onChange={handleChildFilterChange}
        >
          <View className='history__filter'>
            <Text className='history__filter-label'>小朋友</Text>
            <Text className='history__filter-value'>
              {childFilter === null ? '全部' : children.find((c) => c.id === childFilter)?.name ?? '全部'} ▾
            </Text>
          </View>
        </Picker>
        <Picker
          mode='selector'
          range={['全部', '英语', '数学']}
          value={subjectPickerValue}
          onChange={handleSubjectFilterChange}
        >
          <View className='history__filter'>
            <Text className='history__filter-label'>学科</Text>
            <Text className='history__filter-value'>
              {subjectFilter === '' ? '全部' : SUBJECT_LABELS[subjectFilter]} ▾
            </Text>
          </View>
        </Picker>
      </View>

      {loading && (
        <View className='history__list' data-testid='history-skeleton'>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} className='history__skeleton'>
              <View className='history__skeleton-thumb' />
              <View className='history__skeleton-body'>
                <View className='history__skeleton-line history__skeleton-line--short' />
                <View className='history__skeleton-line' />
              </View>
            </View>
          ))}
        </View>
      )}

      {error && !loading && (
        <View className='history__state'>
          <Text className='history__state-emoji'>😞</Text>
          <Text className='history__state-text'>{error}</Text>
          <Button className='history__primary' hoverClass='brand-hover' onClick={() => setRetryKey((k) => k + 1)}>
            再试一次
          </Button>
        </View>
      )}

      {!loading && !error && submissions.length === 0 && (
        <View className='history__state'>
          <Text className='history__state-emoji'>📋</Text>
          <Text className='history__state-title'>还没有批改记录</Text>
          <Text className='history__state-hint'>去批改一张试卷，就能在这里回看</Text>
          <Button className='history__primary' hoverClass='brand-hover' onClick={goGrade}>
            去批改
          </Button>
        </View>
      )}

      {!loading && !error && submissions.length > 0 && (
        <View className='history__list'>
          {submissions.map((item) => (
            <View key={item.id} className='history__card' onClick={() => goDetail(item.id)}>
              <View className='history__thumb'>
                {item.thumbnail_url ? (
                  <Image
                    className='history__thumb-img'
                    src={item.thumbnail_url}
                    mode='aspectFill'
                    lazyLoad
                    ariaLabel='试卷缩略图'
                  />
                ) : (
                  <Text className='history__thumb-placeholder'>📄</Text>
                )}
              </View>
              <View className='history__body'>
                <View className='history__row'>
                  <Text className='history__child'>{item.child_name}</Text>
                  <Text className='history__badge'>{SUBJECT_LABELS[item.subject] ?? item.subject}</Text>
                </View>
                <View className='history__row'>
                  {item.score ? (
                    <Text className='history__score'>
                      {item.score.correct}/{item.score.total}
                    </Text>
                  ) : (
                    <Text className='history__pending'>批改中…</Text>
                  )}
                  <Text className='history__time'>{formatRelativeTime(item.created_at)}</Text>
                </View>
              </View>
            </View>
          ))}

          {hasMore ? (
            <View className='history__more'>
              <Button
                className='history__more-btn'
                hoverClass='brand-hover'
                disabled={loadingMore}
                loading={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? '加载中…' : '加载更多'}
              </Button>
              {loadMoreError && (
                <Text className='history__more-error' onClick={loadMore}>
                  加载失败，点击重试
                </Text>
              )}
            </View>
          ) : (
            <Text className='history__end'>—— 已显示全部记录 ——</Text>
          )}
        </View>
      )}
    </View>
  )
}
