import { useEffect, useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { ApiError, wechatLogin } from '../../lib/api'
import { clearPhone, getPhone, setPhone } from '../../lib/storage'

import './index.scss'

export default function Login() {
  const [phone, setPhoneInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const phoneValid = phone.length === 11

  // 已绑定用户重进：静默登录，成功直接进首页；失败（未绑定/过期）清缓存停留本页。
  useEffect(() => {
    const cached = getPhone()
    if (!cached) return
    void (async () => {
      try {
        const { code } = await Taro.login()
        const res = await wechatLogin(code)
        setPhone(res.phone)
        Taro.reLaunch({ url: '/pages/index/index' })
      } catch {
        clearPhone()
      }
    })()
  }, [])

  const handlePhoneInput = (e: { detail: { value: string } }) => {
    setPhoneInput(e.detail.value.replace(/\D/g, '').slice(0, 11))
    setError('')
  }

  const bindOnce = async () => {
    const { code } = await Taro.login()
    return wechatLogin(code, phone)
  }

  const handleSubmit = async () => {
    if (!phoneValid || loading) return
    setError('')
    setLoading(true)
    try {
      let res
      try {
        res = await bindOnce()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // code 过期：重新 wx.login 后自动重试一次
          res = await bindOnce()
        } else {
          throw e
        }
      }
      setPhone(res.phone)
      Taro.reLaunch({ url: '/pages/index/index' })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('登录已过期，请重试')
        Taro.showToast({ title: '登录已过期，请重试', icon: 'none' })
      } else {
        Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='login'>
      <View className='login__brand'>
        <Text className='login__title'>AI 作业批改</Text>
        <Text className='login__subtitle'>拍照批改，几分钟检查完作业</Text>
      </View>

      <View className='login__form'>
        <Input
          className='login__input'
          type='number'
          maxlength={11}
          placeholder='请输入家长手机号'
          placeholderClass='login__placeholder'
          value={phone}
          onInput={handlePhoneInput}
        />
        {error ? <Text className='login__error'>{error}</Text> : null}
        <Button
          className={`login__button${phoneValid && !loading ? '' : ' login__button--disabled'}`}
          hoverClass='brand-hover'
          disabled={!phoneValid || loading}
          onClick={handleSubmit}
        >
          {loading ? '绑定中…' : '进入批改'}
        </Button>
        <Text className='login__hint'>与网页版同一手机号，数据自动同步</Text>
      </View>
    </View>
  )
}
