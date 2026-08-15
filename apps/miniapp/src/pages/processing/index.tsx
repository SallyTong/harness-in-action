import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidHide, useDidShow, useRouter } from '@tarojs/taro'

import { apiGet } from '../../lib/api'
import type { Submission } from '@homework/api-types'

import './index.scss'

const POLL_INTERVAL = 2000
const TIMEOUT_MS = 30000

const CAROUSEL_TEXTS = [
  { text: '识别题目中…', icon: '🔍' },
  { text: '批改答案中…', icon: '✏️' },
  { text: '生成解题思路中…', icon: '📝' },
]

export default function Processing() {
  const router = useRouter()
  const id = router.params.id ?? ''
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [paused, setPaused] = useState(false)
  const startTimeRef = useRef(Date.now())
  const idRef = useRef(id)
  idRef.current = id

  // 轮播文案
  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % CAROUSEL_TEXTS.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  const poll = useCallback(async () => {
    try {
      const data = await apiGet<Submission>(`/api/submissions/${idRef.current}`)
      if (data.status === 'completed') {
        Taro.redirectTo({ url: `/pages/result/index?id=${idRef.current}` })
        return
      }
      if (data.status === 'failed') {
        setError('批改失败，请重试')
        return
      }
      if (Date.now() - startTimeRef.current > TIMEOUT_MS) {
        setTimedOut(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询批改状态失败')
    }
  }, [])

  // 后台切换：onHide 暂停，onShow 恢复并立即查询（由 effect 重新触发）。
  useDidShow(() => setPaused(false))
  useDidHide(() => setPaused(true))

  useEffect(() => {
    if (paused || error || timedOut) return
    void poll()
    const timer = setInterval(() => void poll(), POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [paused, error, timedOut, poll])

  const retry = () => {
    setError(null)
    setTimedOut(false)
    startTimeRef.current = Date.now()
  }

  const goHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  const { text, icon } = CAROUSEL_TEXTS[carouselIndex]

  if (error) {
    return (
      <View className='processing processing--center'>
        <Text className='processing__emoji'>😞</Text>
        <Text className='processing__status'>{error}</Text>
        <View className='processing__actions'>
          <Button className='processing__btn processing__btn--ghost' hoverClass='brand-hover' onClick={goHome}>
            返回首页
          </Button>
          <Button className='processing__btn processing__btn--primary' hoverClass='brand-hover' onClick={retry}>
            重新批改
          </Button>
        </View>
      </View>
    )
  }

  if (timedOut) {
    return (
      <View className='processing processing--center'>
        <Text className='processing__emoji'>⏳</Text>
        <Text className='processing__status processing__status--warn'>
          批改时间较长，请稍候或重试
        </Text>
        <View className='processing__actions'>
          <Button className='processing__btn processing__btn--ghost' hoverClass='brand-hover' onClick={goHome}>
            返回首页
          </Button>
          <Button className='processing__btn processing__btn--primary' hoverClass='brand-hover' onClick={retry}>
            继续等待
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className='processing processing--center'>
      <Text className='processing__pencil'>✏️</Text>
      <Text className='processing__text'>
        {icon} {text}
      </Text>
      <View className='processing__bar'>
        <View className='processing__bar-fill' />
      </View>
      <Text className='processing__hint'>通常需要 5-15 秒</Text>
      <Button className='processing__btn processing__btn--ghost' hoverClass='brand-hover' onClick={goHome}>
        取消
      </Button>
    </View>
  )
}
