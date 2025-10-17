/**
 * 聊天布局宽度配置
 * 统一管理聊天界面的响应式宽度断点
 *
 * 设计原则：
 * - 小屏幕（移动端）：充分利用宽度，保持紧凑
 * - 中等屏幕：适度扩展，平衡阅读体验和视觉舒适度
 * - 大屏幕：提供充足空间，但保持合理行宽避免视线左右移动过远
 */

/**
 * 聊天容器的最大宽度类名
 * 应用于 ChatMessages 和 ChatInput 容器，确保两者宽度一致
 */
export const CHAT_CONTAINER_MAX_WIDTH = 'w-full px-4 lg:max-w-[960px] xl:max-w-[1120px] 2xl:max-w-[1280px] mx-auto'

/**
 * 消息气泡的响应式最大宽度百分比（相对于父容器）
 * 应用于 MessageItem 组件的气泡
 */
export const MESSAGE_BUBBLE_MAX_WIDTH = 'max-w-[95%] sm:max-w-[90%] lg:max-w-[80%] xl:max-w-[75%] 2xl:max-w-[72%]'

/**
 * 聊天界面主区域的最大宽度类名
 * 应用于 workspace 页面的主聊天区域
 */
export const WORKSPACE_MAIN_MAX_WIDTH = 'w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl'

/**
 * 错误/加载状态组件的最大宽度
 * 应用于空状态、错误提示等元素
 */
export const CHAT_STATE_MAX_WIDTH = 'max-w-sm mx-auto'

/**
 * 工具函数：获取聊天容器宽度类名
 * @returns Tailwind CSS 类名字符串
 */
export function getChatContainerWidth(): string {
  return CHAT_CONTAINER_MAX_WIDTH
}

/**
 * 工具函数：获取消息气泡宽度类名
 * @returns Tailwind CSS 类名字符串
 */
export function getMessageBubbleWidth(): string {
  return MESSAGE_BUBBLE_MAX_WIDTH
}
