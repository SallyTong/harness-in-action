import Taro from '@tarojs/taro'

const PHONE_KEY = 'parent_phone'

export function getPhone(): string {
  return Taro.getStorageSync(PHONE_KEY) || ''
}

export function setPhone(phone: string): void {
  Taro.setStorageSync(PHONE_KEY, phone)
}

export function clearPhone(): void {
  Taro.removeStorageSync(PHONE_KEY)
}
