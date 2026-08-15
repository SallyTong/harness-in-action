import { View, Text } from '@tarojs/components'

import './index.scss'

export default function History() {
  return (
    <View className='history'>
      <View className='history__header'>
        <Text className='history__title'>历史</Text>
      </View>
      <View className='history__empty'>
        <Text className='history__empty-title'>功能建设中</Text>
        <Text className='history__empty-hint'>批改记录将在后续开放</Text>
      </View>
    </View>
  )
}
