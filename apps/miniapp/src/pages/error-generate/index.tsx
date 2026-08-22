import { useEffect, useState } from 'react'
import { View, Text, Button, Image, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'

import { apiGet, apiPost } from '../../lib/api'
import { SUBJECT_LABELS, TYPE_LABELS } from '../../lib/display'
import type { Child, GenerateSheetResponse } from '@homework/api-types'

import './index.scss'

const TYPE_KEYS = Object.keys(TYPE_LABELS)
const SUBJECT_TYPES: Record<string, string[]> = {
  english: ['choice', 'fill_blank', 'reading', 'composition'],
  math: ['choice', 'fill_blank', 'calculation', 'word_problem'],
}

type PickerDetail = { detail: { value: number | number[] | string | string[] } }

export default function ErrorGenerate() {
  const router = useRouter()
  const initialChildId = router.params.child_id ? Number(router.params.child_id) : null
  const initialSubject = router.params.subject === 'math' ? 'math' : 'english'
  const initialType = router.params.question_type ?? ''

  const [children, setChildren] = useState<Child[]>([])
  const [childId, setChildId] = useState<number | null>(initialChildId)
  const [subject, setSubject] = useState<'english' | 'math'>(initialSubject)
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    initialType && TYPE_KEYS.includes(initialType) ? new Set([initialType]) : new Set(),
  )
  const [count, setCount] = useState(10)
  const [format, setFormat] = useState<'text' | 'image'>('text')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GenerateSheetResponse | null>(null)

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

  const handleChildChange = (e: PickerDetail) => {
    const idx = Number(Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value)
    const child = children[idx]
    if (child) setChildId(child.id)
  }

  const toggleType = (t: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const handleSubjectChange = (next: 'english' | 'math') => {
    setSubject(next)
    setSelectedTypes(new Set())
  }

  const handleGenerate = async () => {
    if (childId === null) {
      Taro.showToast({ title: '请选择小朋友', icon: 'none' })
      return
    }
    setGenerating(true)
    setResult(null)
    try {
      const body: Record<string, unknown> = { child_id: childId, subject, count, format }
      if (selectedTypes.size > 0) body.question_types = Array.from(selectedTypes)
      const data = await apiPost<GenerateSheetResponse>('/api/error-collections/generate', body)
      setResult(data)
    } catch (err) {
      Taro.showToast({
        title: err instanceof Error ? err.message : '生成失败，请重试',
        icon: 'none',
      })
    } finally {
      setGenerating(false)
    }
  }

  const previewImage = () => {
    if (result?.image_url) {
      Taro.previewImage({ urls: [result.image_url], current: result.image_url })
    }
  }

  const previewQuestionImage = (url: string) => {
    Taro.previewImage({ current: url, urls: [url] })
  }

  /** docx 预览：下载到临时路径 → wx.openDocument 在小程序内打开（不落手机系统文件）。 */
  const previewDocx = async () => {
    const url = result?.docx_url
    if (!url) return
    Taro.showLoading({ title: '正在打开…', mask: true })
    try {
      const res = await Taro.downloadFile({ url })
      if (res.statusCode !== 200) {
        Taro.showToast({ title: '下载失败，请重试', icon: 'none' })
        return
      }
      await Taro.openDocument({ filePath: res.tempFilePath, fileType: 'docx', showMenu: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      const tooLarge = /exceed max size|文件过大|too large/i.test(msg)
      Taro.showToast({
        title: tooLarge ? '文件过大，请到网页端下载' : '预览失败，请重试',
        icon: 'none',
      })
    } finally {
      Taro.hideLoading()
    }
  }

  const availableTypes = SUBJECT_TYPES[subject] ?? TYPE_KEYS
  const childPickerValue = childId === null ? 0 : children.findIndex((c) => c.id === childId)

  return (
    <View className='generate'>
      <View className='generate__form'>
        <View className='generate__block'>
          <Text className='generate__label'>小朋友</Text>
          <Picker
            mode='selector'
            range={children.map((c) => c.name)}
            value={Math.max(0, childPickerValue)}
            onChange={handleChildChange}
          >
            <View className='generate__picker'>
              <Text className={childId === null ? 'generate__picker-value generate__picker-value--muted' : 'generate__picker-value'}>
                {childId === null ? '请选择小朋友' : children.find((c) => c.id === childId)?.name ?? '请选择小朋友'} ▾
              </Text>
            </View>
          </Picker>
        </View>

        <View className='generate__block'>
          <Text className='generate__label'>学科</Text>
          <View className='generate__seg'>
            <Button
              className={`generate__seg-item${subject === 'english' ? ' generate__seg-item--active' : ''}`}
              hoverClass='brand-hover'
              onClick={() => handleSubjectChange('english')}
            >
              英语
            </Button>
            <Button
              className={`generate__seg-item${subject === 'math' ? ' generate__seg-item--active' : ''}`}
              hoverClass='brand-hover'
              onClick={() => handleSubjectChange('math')}
            >
              数学
            </Button>
          </View>
        </View>

        <View className='generate__block'>
          <Text className='generate__label'>试卷格式</Text>
          <View className='generate__seg'>
            <Button
              className={`generate__seg-item${format === 'text' ? ' generate__seg-item--active' : ''}`}
              hoverClass='brand-hover'
              onClick={() => setFormat('text')}
            >
              文字试卷
            </Button>
            <Button
              className={`generate__seg-item${format === 'image' ? ' generate__seg-item--active' : ''}`}
              hoverClass='brand-hover'
              onClick={() => setFormat('image')}
            >
              图片试卷
            </Button>
          </View>
        </View>

        <View className='generate__block'>
          <Text className='generate__label'>题型（可多选，留空表示全部）</Text>
          <View className='generate__chips'>
            {availableTypes.map((t) => (
              <Button
                key={t}
                className={`generate__chip${
                  selectedTypes.has(t) ? ' generate__chip--active' : ''
                }`}
                hoverClass='brand-hover'
                onClick={() => toggleType(t)}
              >
                {TYPE_LABELS[t]}
              </Button>
            ))}
          </View>
        </View>

        <View className='generate__block'>
          <Text className='generate__label'>题目数量</Text>
          <View className='generate__count'>
            <Button
              className='generate__count-btn'
              hoverClass='brand-hover'
              disabled={count <= 1}
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              aria-label='减少题目'
            >
              −
            </Button>
            <Text className='generate__count-value'>{count} 题</Text>
            <Button
              className='generate__count-btn'
              hoverClass='brand-hover'
              disabled={count >= 50}
              onClick={() => setCount((c) => Math.min(50, c + 1))}
              aria-label='增加题目'
            >
              ＋
            </Button>
          </View>
          <Text className='generate__count-hint'>1 ~ 50 题</Text>
        </View>
      </View>

      <Button
        className={`generate__submit${generating || childId === null ? ' generate__submit--disabled' : ''}`}
        hoverClass='brand-hover'
        disabled={generating || childId === null}
        loading={generating}
        onClick={handleGenerate}
      >
        {generating ? '正在生成…' : '生成错题试卷'}
      </Button>

      {result && result.format === 'text' && result.questions && (
        <View className='generate__result'>
          <View className='generate__result-head'>
            <Text className='generate__result-title generate__result-title--inline'>
              已生成 {result.question_count} 道错题试卷
            </Text>
            <Button className='generate__docx-btn' hoverClass='brand-hover' onClick={previewDocx}>
              预览 Word
            </Button>
          </View>

          <View className='generate__sheet-list'>
            {result.questions.map((q) => {
              const text = q.question_text && q.question_text.trim()
              const imagePath = q.question_image_path
              const isMath = q.subject === 'math'
              // 数学题截图为主、不渲染 LaTeX；英语题文字为主，无文字回退截图。
              const showImage = !!imagePath && (isMath || !text)
              const showText = !!text && (!isMath || !imagePath)
              return (
                <View className='generate__qcard' key={`${q.source_submission_id}-${q.question_number}`}>
                  <View className='generate__qcard-head'>
                    <View className='generate__qcard-meta'>
                      <Text className='generate__qcard-no'>第 {q.question_number} 题</Text>
                      <Text className='generate__qcard-badge'>
                        {TYPE_LABELS[q.question_type] ?? q.question_type}
                      </Text>
                    </View>
                    <Text className='generate__qcard-subject'>{SUBJECT_LABELS[q.subject] ?? q.subject}</Text>
                  </View>

                  {showImage && (
                    <Image
                      className='generate__qcard-img'
                      src={imagePath as string}
                      mode='widthFix'
                      ariaLabel={`第${q.question_number}题`}
                      onClick={() => previewQuestionImage(imagePath as string)}
                    />
                  )}
                  {showText && (
                    <View className='generate__qcard-stem'>
                      <Text className='generate__qcard-stem-label'>题干</Text>
                      <Text className='generate__qcard-stem-text'>{text}</Text>
                    </View>
                  )}
                  {!showImage && !showText && (
                    <Text className='generate__qcard-missing'>题干文字缺失，可查看原图</Text>
                  )}

                  <View className='generate__qcard-answer'>
                    <Text className='generate__qcard-answer-text'>作答区域</Text>
                  </View>
                </View>
              )
            })}
          </View>

          <Button
            className='generate__regenerate'
            hoverClass='brand-hover'
            onClick={() => {
              setResult(null)
              void handleGenerate()
            }}
          >
            重新生成
          </Button>
        </View>
      )}

      {result && result.format === 'image' && result.image_url && (
        <View className='generate__result'>
          <Text className='generate__result-title'>已生成 {result.question_count} 道错题试卷</Text>
          <Image
            className='generate__result-img'
            src={result.image_url}
            mode='widthFix'
            ariaLabel='错题试卷'
            onClick={previewImage}
          />
          <Text className='generate__result-hint'>点击图片可放大查看</Text>
          <Button
            className='generate__regenerate'
            hoverClass='brand-hover'
            onClick={() => {
              setResult(null)
              void handleGenerate()
            }}
          >
            重新生成
          </Button>
        </View>
      )}
    </View>
  )
}
