/**
 * 全局页面模板
 * 移除过渡动画以消除页面加载时的"突然出现"抖动
 * 之前使用 framer-motion 的 initial/animate 会导致：
 * 1. 首屏渲染时内容从透明+偏移位置动画到正常位置
 * 2. 与水合过程叠加造成明显的布局跳变
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
