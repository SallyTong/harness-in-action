import { View, Text } from '@tarojs/components'

import './index.scss'

export default function Home() {
  return (
    <View className='home'>
      <View className='home__header'>
        <Text className='home__title'>批改</Text>
        <Text className='home__subtitle'>拍照上传试卷，几分钟检查完作业</Text>
      </View>
      <View className='home__empty'>
        <Text className='home__empty-title'>功能建设中</Text>
        <Text className='home__empty-hint'>拍照上传入口将在下一步开放</Text>
      </View>
    </View>
  )
}
