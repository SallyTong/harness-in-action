import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { TAB_BAR_EVENT, TAB_ITEMS } from '../lib/tabbar'

import './index.scss'

/** 首屏初始化：按当前页面路径反推 tab 索引；后续由各页面 useDidShow 事件同步。 */
function currentTabIndex(): number {
  const path = Taro.getCurrentInstance().router?.path ?? ''
  const idx = TAB_ITEMS.findIndex((t) => path.includes(t.path.replace(/^\//, '')))
  return idx >= 0 ? idx : 0
}

export default function CustomTabBar() {
  const [selected, setSelected] = useState(currentTabIndex)

  useEffect(() => {
    const handler = (index: number) => setSelected(index)
    Taro.eventCenter.on(TAB_BAR_EVENT, handler)
    return () => {
      Taro.eventCenter.off(TAB_BAR_EVENT, handler)
    }
  }, [])

  const handleTap = (index: number) => {
    setSelected(index)
    Taro.switchTab({ url: TAB_ITEMS[index].path })
  }

  return (
    <View className='tab-bar'>
      {TAB_ITEMS.map((tab, i) => (
        <View key={tab.path} className='tab-bar__item' onClick={() => handleTap(i)}>
          <Text className='tab-bar__icon'>{tab.icon}</Text>
          <Text
            className={`tab-bar__label${selected === i ? ' tab-bar__label--active' : ''}`}
          >
            {tab.label}
          </Text>
        </View>
      ))}
    </View>
  )
}
