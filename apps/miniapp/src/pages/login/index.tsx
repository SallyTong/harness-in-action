import { useEffect, useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { apiPostPublic } from '../../lib/api'
import { isAuthenticated, setToken } from '../../lib/storage'
import type { LoginResponse, SendCodeResponse } from '@homework/api-types'

import './index.scss'

const RESEND_SECONDS = 60

export default function Login() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState('')

  const phoneValid = /^\d{11}$/.test(phone)
  const codeValid = /^\d{6}$/.test(code)
  const canLogin = phoneValid && codeValid && !loggingIn

  // 已登录用户重进：JWT 本地缓存有效期内免重复登录，直接进首页。
  useEffect(() => {
    if (isAuthenticated()) {
      Taro.reLaunch({ url: '/pages/index/index' })
    }
  }, [])

  // 60 秒重发倒计时
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handlePhoneInput = (e: { detail: { value: string } }) => {
    setPhone(e.detail.value.replace(/\D/g, '').slice(0, 11))
    setError('')
  }

  const handleCodeInput = (e: { detail: { value: string } }) => {
    setCode(e.detail.value.replace(/\D/g, '').slice(0, 6))
    setError('')
  }

  const handleSendCode = async () => {
    if (!phoneValid || sending || countdown > 0) return
    setError('')
    setSending(true)
    try {
      await apiPostPublic<SendCodeResponse>('/api/auth/send-code', { phone })
      setCountdown(RESEND_SECONDS)
      Taro.showToast({ title: '验证码已发送', icon: 'none' })
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败，请重试')
    } finally {
      setSending(false)
    }
  }

  const handleLogin = async () => {
    if (!canLogin) return
    setError('')
    setLoggingIn(true)
    try {
      const res = await apiPostPublic<LoginResponse>('/api/auth/login', { phone, code })
      setToken(res.token)
      Taro.reLaunch({ url: '/pages/index/index' })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <View className='login'>
      <View className='login__brand'>
        <Text className='login__title'>欢迎使用</Text>
        <Text className='login__subtitle'>手机号验证码登录，跨设备同步批改记录</Text>
      </View>

      <View className='login__form'>
        <View className='login__field'>
          <Text className='login__label'>手机号</Text>
          <Input
            className='login__input'
            type='number'
            maxlength={11}
            placeholder='请输入 11 位手机号'
            placeholderClass='login__placeholder'
            value={phone}
            onInput={handlePhoneInput}
          />
        </View>

        <View className='login__field'>
          <Text className='login__label'>验证码</Text>
          <View className='login__code-row'>
            <Input
              className='login__input login__input--code'
              type='number'
              maxlength={6}
              placeholder='6 位验证码'
              placeholderClass='login__placeholder'
              value={code}
              onInput={handleCodeInput}
            />
            <Button
              className={`login__code-btn${countdown > 0 || sending || !phoneValid ? ' login__code-btn--disabled' : ''}`}
              hoverClass='brand-hover'
              disabled={countdown > 0 || sending || !phoneValid}
              onClick={handleSendCode}
            >
              {countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中…' : '获取验证码'}
            </Button>
          </View>
        </View>

        {error ? <Text className='login__error'>{error}</Text> : null}

        <Button
          className={`login__button${canLogin ? '' : ' login__button--disabled'}`}
          hoverClass='brand-hover'
          disabled={!canLogin}
          onClick={handleLogin}
        >
          {loggingIn ? '登录中…' : '登录'}
        </Button>

        <Text className='login__hint'>登录即代表同意数据仅用于作业批改</Text>
      </View>
    </View>
  )
}
