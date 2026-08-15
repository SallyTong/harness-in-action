import { useEffect, useState } from 'react'
import { View, Text, Button, Image, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { apiGet, apiUpload } from '../../lib/api'
import { compressImage } from '../../lib/image'
import type { Child, SubmissionAccepted } from '@homework/api-types'

import './index.scss'

type Subject = 'english' | 'math'

/** 用户主动取消选图/拍照时 wx 会 reject 并带 cancel 标记，静默忽略而非报错。 */
function isUserCancel(err: unknown): boolean {
  const msg = (err as { errMsg?: string } | undefined)?.errMsg ?? ''
  return msg.includes('cancel')
}

export default function Home() {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null)
  const [subject, setSubject] = useState<Subject>('english')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [childrenLoading, setChildrenLoading] = useState(true)
  const [childrenError, setChildrenError] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let active = true
    apiGet<Child[]>('/api/children')
      .then((list) => {
        if (!active) return
        setChildren(list)
        if (list.length > 0) setSelectedChildId(list[0].id)
      })
      .catch(() => {
        if (active) setChildrenError(true)
      })
      .finally(() => {
        if (active) setChildrenLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const chooseImage = async (sourceType: 'camera' | 'album') => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: [sourceType],
        sizeType: ['compressed'],
      })
      const file = res.tempFiles?.[0]
      if (!file) return
      setCompressing(true)
      const compressed = await compressImage(file.tempFilePath)
      setSelectedImage(compressed)
    } catch (err) {
      if (!isUserCancel(err)) {
        Taro.showToast({ title: '图片处理失败，请重试', icon: 'none' })
      }
    } finally {
      setCompressing(false)
    }
  }

  const handleUploadTap = () => {
    Taro.showActionSheet({ itemList: ['📷 拍照', '🖼️ 从相册选择'] })
      .then(({ tapIndex }) => {
        void chooseImage(tapIndex === 0 ? 'camera' : 'album')
      })
      .catch(() => {
        // 用户取消 ActionSheet，忽略
      })
  }

  const handleRemoveImage = () => setSelectedImage(null)

  // Picker onChange 的 value 类型随 mode 变化（number | number[] | string | …），
  // Taro 的 CommonEventFunction 联合类型无法用窄类型签名匹配，这里取首个值转数字作下标。
  const handleChildChange = (e: { detail: { value: number | number[] | string | string[] } }) => {
    const raw = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value
    const child = children[Number(raw)]
    if (child) setSelectedChildId(child.id)
  }

  const canSubmit =
    selectedImage !== null && selectedChildId !== null && !uploading && !compressing

  const handleSubmit = async () => {
    if (!canSubmit) return
    setUploading(true)
    try {
      const res = await apiUpload<SubmissionAccepted>(
        '/api/submissions',
        selectedImage!,
        { subject, child_id: String(selectedChildId) },
      )
      Taro.navigateTo({ url: `/pages/processing/index?id=${res.submission_id}` })
    } catch (err) {
      Taro.showToast({
        title: err instanceof Error ? err.message : '上传失败，请重试',
        icon: 'none',
      })
    } finally {
      setUploading(false)
    }
  }

  const selectedChild = children.find((c) => c.id === selectedChildId)
  const pickerValue = Math.max(
    0,
    children.findIndex((c) => c.id === selectedChildId),
  )

  return (
    <View className='home'>
      <View className='home__header'>
        <Text className='home__title'>作业批改</Text>
        <Text className='home__subtitle'>拍照上传试卷，几分钟检查完作业</Text>
      </View>

      {childrenLoading ? (
        <View className='home__picker'>
          <Text className='home__picker-label'>小朋友</Text>
          <Text className='home__picker-value home__picker-value--muted'>加载中…</Text>
        </View>
      ) : childrenError || children.length === 0 ? (
        <View className='home__picker'>
          <Text className='home__picker-label'>小朋友</Text>
          <Text className='home__picker-value home__picker-value--muted'>
            请先在网页版添加小朋友
          </Text>
        </View>
      ) : (
        <Picker
          mode='selector'
          range={children.map((c) => c.name)}
          value={pickerValue}
          onChange={handleChildChange}
        >
          <View className='home__picker'>
            <Text className='home__picker-label'>小朋友</Text>
            <Text className='home__picker-value'>
              {selectedChild ? selectedChild.name : children[0].name} ▾
            </Text>
          </View>
        </Picker>
      )}

      <View className='home__subject'>
        <Button
          className={`home__subject-item${subject === 'english' ? ' home__subject-item--active' : ''}`}
          onClick={() => setSubject('english')}
        >
          英语
        </Button>
        <Button
          className={`home__subject-item${subject === 'math' ? ' home__subject-item--active' : ''}`}
          onClick={() => setSubject('math')}
        >
          数学
        </Button>
      </View>

      {selectedImage ? (
        <View className='home__preview'>
          <View className='home__preview-wrap'>
            <Image
              className='home__preview-img'
              src={selectedImage}
              mode='widthFix'
              ariaLabel='待上传试卷'
            />
            <Button
              className='home__preview-remove'
              onClick={handleRemoveImage}
              aria-label='移除图片'
            >
              ✕
            </Button>
          </View>
          <Text className='home__preview-hint'>已压缩，点击 ✕ 可移除</Text>
        </View>
      ) : (
        <Button className='home__upload' onClick={handleUploadTap}>
          <Text className='home__upload-icon'>📸</Text>
          <Text className='home__upload-title'>拍照上传试卷</Text>
          <Text className='home__upload-hint'>支持英语 · 数学 · 打印体 + 手写</Text>
        </Button>
      )}

      <Button
        className={`home__submit${canSubmit ? '' : ' home__submit--disabled'}`}
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {uploading ? '上传中…' : compressing ? '压缩中…' : '开始批改'}
      </Button>
    </View>
  )
}
