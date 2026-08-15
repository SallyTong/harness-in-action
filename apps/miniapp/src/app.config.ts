export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/index/index',
    'pages/history/index',
    'pages/processing/index',
    'pages/result/index',
    'pages/history-detail/index',
    'pages/error-book/index',
    'pages/error-generate/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'AI 作业批改',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#A39D97',
    selectedColor: '#6366F1',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '批改' },
      { pagePath: 'pages/history/index', text: '历史' },
    ],
  },
})
