/** 展示层共用映射与格式化（历史/错题集/错题试卷多页复用）。
 *
 * 品牌约束：题型/错误分类/学科的英文 key 需映射为中文；时间戳用相对时间。
 * 分数展示沿用等宽字体（在页面 SCSS 里用 font-family: 'SF Mono', Menlo, monospace）。
 */

export const TYPE_LABELS: Record<string, string> = {
  choice: '选择题',
  fill_blank: '填空题',
  reading: '阅读理解',
  composition: '作文',
  calculation: '计算题',
  word_problem: '应用题',
}

export const ERROR_CATEGORY_LABELS: Record<string, string> = {
  grammar: '语法',
  vocabulary: '词汇',
  spelling: '拼写',
  logic: '逻辑',
  calculation: '计算',
  careless: '粗心',
  comprehension: '理解',
}

export const SUBJECT_LABELS: Record<string, string> = {
  english: '英语',
  math: '数学',
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / 年月日。 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} 天前`
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

/** 绝对日期（错题集用）：M月D日。 */
export function formatMonthDay(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日`
}
