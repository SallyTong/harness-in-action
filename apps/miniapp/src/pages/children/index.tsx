import { useCallback, useEffect, useState } from 'react'
import { View, Text, Input, Textarea, Picker, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api'
import type { Child } from '@homework/api-types'

import './index.scss'

const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级']
const DEFAULT_GRADE = '五年级'
const NAME_MAX = 50
const NOTE_MAX = 200

type FormState = { mode: 'add' } | { mode: 'edit'; child: Child }
type PickerDetail = { detail: { value: number | number[] | string | string[] } }
type InputDetail = { detail: { value: string } }

/** Picker onChange 的 value 类型随 mode 变化，取首个值转数字下标。 */
function pickIndex(value: number | number[] | string | string[]): number {
  const raw = Array.isArray(value) ? value[0] : value
  return Number(raw)
}

export default function Children() {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const [form, setForm] = useState<FormState | null>(null)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(DEFAULT_GRADE)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await apiGet<Child[]>('/api/children')
      setChildren(Array.isArray(list) ? list : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, retryKey])

  const openAdd = () => {
    setName('')
    setGrade(DEFAULT_GRADE)
    setNote('')
    setForm({ mode: 'add' })
  }

  const openEdit = (child: Child) => {
    setName(child.name)
    setGrade(GRADES.includes(child.grade) ? child.grade : DEFAULT_GRADE)
    setNote(child.note ?? '')
    setForm({ mode: 'edit', child })
  }

  const closeForm = () => {
    if (saving) return
    setForm(null)
  }

  const handleNameInput = (e: InputDetail) => setName(e.detail.value.slice(0, NAME_MAX))
  const handleNoteInput = (e: InputDetail) => setNote(e.detail.value.slice(0, NOTE_MAX))

  const handleGradeChange = (e: PickerDetail) => {
    const next = GRADES[pickIndex(e.detail.value)]
    if (next) setGrade(next)
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      Taro.showToast({ title: '请填写小朋友名字', icon: 'none' })
      return
    }
    if (!form) return
    setSaving(true)
    try {
      const body = { name: trimmed, grade, note: note.trim() || null }
      if (form.mode === 'add') {
        await apiPost<Child>('/api/children', body)
        Taro.showToast({ title: '已添加', icon: 'success' })
      } else {
        await apiPut<Child>(`/api/children/${form.child.id}`, body)
        Taro.showToast({ title: '已保存', icon: 'success' })
      }
      setForm(null)
      await load()
    } catch (err) {
      Taro.showToast({
        title: err instanceof Error ? err.message : '保存失败，请重试',
        icon: 'none',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (child: Child) => {
    let confirmed = false
    try {
      const res = await Taro.showModal({
        title: '移除小朋友',
        content: `确定移除「${child.name}」吗？历史批改记录会保留。`,
        confirmText: '移除',
        cancelText: '取消',
        confirmColor: '#EF4444',
      })
      confirmed = res.confirm
    } catch {
      return
    }
    if (!confirmed) return
    try {
      await apiDelete(`/api/children/${child.id}`)
      Taro.showToast({ title: '已移除', icon: 'success' })
      await load()
    } catch (err) {
      Taro.showToast({
        title: err instanceof Error ? err.message : '移除失败，请重试',
        icon: 'none',
      })
    }
  }

  const gradeIndex = Math.max(0, GRADES.indexOf(grade))

  return (
    <View className='children'>
      <View className='children__header'>
        <Text className='children__title'>小朋友</Text>
        <Text className='children__subtitle'>管理小朋友，跨设备同步批改记录</Text>
      </View>

      {loading && (
        <View className='children__list' data-testid='children-skeleton'>
          {[1, 2, 3].map((i) => (
            <View key={i} className='children__skeleton'>
              <View className='children__skeleton-avatar' />
              <View className='children__skeleton-body'>
                <View className='children__skeleton-line children__skeleton-line--short' />
                <View className='children__skeleton-line' />
              </View>
            </View>
          ))}
        </View>
      )}

      {error && !loading && (
        <View className='children__state'>
          <Text className='children__state-emoji'>😞</Text>
          <Text className='children__state-text'>{error}</Text>
          <Button
            className='children__primary'
            hoverClass='brand-hover'
            onClick={() => setRetryKey((k) => k + 1)}
          >
            再试一次
          </Button>
        </View>
      )}

      {!loading && !error && children.length === 0 && (
        <View className='children__state'>
          <Text className='children__state-emoji'>🧒</Text>
          <Text className='children__state-title'>还没有小朋友</Text>
          <Text className='children__state-hint'>添加后就能拍照批改作业</Text>
        </View>
      )}

      {!loading && !error && children.length > 0 && (
        <View className='children__list'>
          {children.map((c) => (
            <View key={c.id} className='children__card'>
              <View className='children__avatar'>{c.name.slice(0, 1)}</View>
              <View className='children__body'>
                <View className='children__row'>
                  <Text className='children__name'>{c.name}</Text>
                  <Text className='children__grade'>{c.grade}</Text>
                </View>
                <Text className='children__count'>已批改 {c.submission_count} 次</Text>
                {c.note ? <Text className='children__note'>{c.note}</Text> : null}
              </View>
              <View className='children__actions'>
                <Button
                  className='children__action'
                  hoverClass='brand-hover'
                  onClick={() => openEdit(c)}
                >
                  编辑
                </Button>
                <Button
                  className='children__action children__action--danger'
                  hoverClass='brand-hover'
                  onClick={() => handleDelete(c)}
                >
                  移除
                </Button>
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && !error && (
        <Button className='children__add' hoverClass='brand-hover' onClick={openAdd}>
          + 添加小朋友
        </Button>
      )}

      {form && <View className='children__mask' onClick={closeForm} />}
      {form && (
        <View className='children__sheet'>
          <View className='children__sheet-head'>
            <Text className='children__sheet-title'>
              {form.mode === 'add' ? '添加小朋友' : '编辑小朋友'}
            </Text>
            <Button
              className='children__sheet-close'
              hoverClass='brand-hover'
              onClick={closeForm}
              aria-label='关闭'
            >
              ✕
            </Button>
          </View>

          <View className='children__field'>
            <Text className='children__label'>名字</Text>
            <Input
              className='children__input'
              maxlength={NAME_MAX}
              placeholder='请输入小朋友名字'
              placeholderClass='children__placeholder'
              value={name}
              onInput={handleNameInput}
            />
          </View>

          <View className='children__field'>
            <Text className='children__label'>年级</Text>
            <Picker mode='selector' range={GRADES} value={gradeIndex} onChange={handleGradeChange}>
              <View className='children__picker'>
                <Text className='children__picker-value'>{grade}</Text>
                <Text className='children__picker-arrow'>▾</Text>
              </View>
            </Picker>
          </View>

          <View className='children__field'>
            <Text className='children__label'>备注（选填）</Text>
            <Textarea
              className='children__textarea'
              maxlength={NOTE_MAX}
              placeholder='可记录孩子的特点、学习进度等'
              placeholderClass='children__placeholder'
              value={note}
              onInput={handleNoteInput}
            />
            <Text className='children__counter'>
              {note.length}/{NOTE_MAX}
            </Text>
          </View>

          <Button
            className='children__save'
            hoverClass='brand-hover'
            disabled={saving}
            loading={saving}
            onClick={handleSave}
          >
            {form.mode === 'add' ? '添加' : '保存修改'}
          </Button>
        </View>
      )}
    </View>
  )
}
