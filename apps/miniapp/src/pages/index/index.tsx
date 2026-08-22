import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Button, Image, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import { apiGet, apiUpload } from '../../lib/api'
import { compressImage } from '../../lib/image'
import { clearToken } from '../../lib/storage'
import { notifyTabBarSelected } from '../../lib/tabbar'
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

  const loadChildren = useCallback(async (showLoading = true) => {
    if (showLoading) setChildrenLoading(true)
    setChildrenError(false)
    try {
      const list = await apiGet<Child[]>('/api/children')
      setChildren(list)
      setSelectedChildId((prev) => {
        if (list.length === 0) return null
        if (prev !== null && list.some((c) => c.id === prev)) return prev
        return list[0].id
      })
    } catch {
      if (showLoading) setChildrenError(true)
    } finally {
      if (showLoading) setChildrenLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadChildren()
  }, [loadChildren])

  const initialShown = useRef(false)

  // 切回批改 tab / 从管理页返回时：同步自定义 tabBar 选中态，并静默刷新小朋友列表
  // （管理页可能新增 / 改名 / 移除，回来需反映最新状态）。
  useDidShow(() => {
    notifyTabBarSelected(0)
    if (!initialShown.current) {
      initialShown.current = true
      return
    }
    void loadChildren(false)
  })

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

  // 跳转小朋友管理页（添加 / 编辑 / 移除小朋友）。
  const goManageChildren = () => {
    Taro.navigateTo({ url: '/pages/children/index' })
  }

  // 登出：清 token 回登录页（服务端无登出端点）。
  const handleLogout = () => {
    clearToken()
    Taro.reLaunch({ url: '/pages/login/index' })
  }

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
        <View className='home__header-top'>
          <Text className='home__title'>作业批改</Text>
          <Text className='home__logout' onClick={handleLogout}>
            登出
          </Text>
        </View>
        <Text className='home__subtitle'>拍照上传试卷，几分钟检查完作业</Text>
      </View>

      {childrenLoading ? (
        <View className='home__picker'>
          <Text className='home__picker-label'>小朋友</Text>
          <Text className='home__picker-value home__picker-value--muted'>加载中…</Text>
        </View>
      ) : childrenError || children.length === 0 ? (
        <View className='home__picker' hoverClass='brand-hover' onClick={goManageChildren}>
          <Text className='home__picker-label'>小朋友</Text>
          <Text className='home__picker-value home__picker-value--accent'>
            去添加小朋友 →
          </Text>
        </View>
      ) : (
        <View className='home__picker-wrap'>
          <Picker
            mode='selector'
            range={children.map((c) => c.name)}
            value={pickerValue}
            onChange={handleChildChange}
          >
            <View className='home__picker home__picker--flex'>
              <Text className='home__picker-label'>小朋友</Text>
              <Text className='home__picker-value'>
                {selectedChild ? selectedChild.name : children[0].name} ▾
              </Text>
            </View>
          </Picker>
          <Text className='home__manage' onClick={goManageChildren}>
            管理
          </Text>
        </View>
      )}

      <View className='home__subject'>
        <Button
          className={`home__subject-item${subject === 'english' ? ' home__subject-item--active' : ''}`}
          hoverClass='brand-hover'
          onClick={() => setSubject('english')}
        >
          英语
        </Button>
        <Button
          className={`home__subject-item${subject === 'math' ? ' home__subject-item--active' : ''}`}
          hoverClass='brand-hover'
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
              hoverClass='brand-hover'
              onClick={handleRemoveImage}
              aria-label='移除图片'
            >
              ✕
            </Button>
          </View>
          <Text className='home__preview-hint'>已压缩，点击 ✕ 可移除</Text>
        </View>
      ) : (
        <Button className='home__upload' hoverClass='brand-hover' onClick={handleUploadTap}>
          <Text className='home__upload-icon'>📸</Text>
          <Text className='home__upload-title'>拍照上传试卷</Text>
          <Text className='home__upload-hint'>支持英语 · 数学 · 打印体 + 手写</Text>
        </Button>
      )}

      <Button
        className={`home__submit${canSubmit ? '' : ' home__submit--disabled'}`}
        hoverClass='brand-hover'
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {uploading ? '上传中…' : compressing ? '压缩中…' : '开始批改'}
      </Button>
    </View>
  )
}
