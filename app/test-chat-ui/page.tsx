"use client"

import { useState } from "react"
import { ChevronDown, X } from "lucide-react"

export default function TestChatUIPage() {
  const [showThinking, setShowThinking] = useState(true)
  const [showBanner, setShowBanner] = useState(true)

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部提示横幅 */}
      {showBanner && (
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-gray-700">
            "管理员发号/任务"（如订单人同时要求分析商家）会拖慢响应，几乎不会出现这个问题。只有管理员可以使用这些功能，用户只能的话也直接看数据
          </p>
          <button
            onClick={() => setShowBanner(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* 对话内容区域 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 模型标识 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span className="text-sm font-medium text-gray-900">
            Claude Sonnet 4.5 - ZenMux
          </span>
        </div>

        {/* 思考过程指示器 */}
        <button
          onClick={() => setShowThinking(!showThinking)}
          className="flex items-center gap-2 mb-6 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span className="font-mono">深度思考中 12.8s</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showThinking ? 'rotate-180' : ''}`} />
        </button>

        {/* 思考过程内容 */}
        {showThinking && (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 font-mono">
              正在分析商家数据结构... 检查缓存状态... 优化查询路径... 准备响应内容
            </p>
          </div>
        )}

        {/* AI 回复内容 - 无气泡设计 */}
        <div className="space-y-6">
          {/* 第一部分 */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              评估当前约束条件
            </h3>
            <p className="text-gray-600 leading-relaxed">
              我当前专注于用户明确提出的约束条件，特别是高并发写入负载下的潜在系统崩溃问题。这些高负载场景的不频繁性，仅限于管理员操作，也是一个关键因素。我正在重新评估设计以避免瓶颈，为常规操作优先考虑可靠性。
            </p>
          </section>

          {/* 第二部分 */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              重新评估架构设计
            </h3>
            <p className="text-gray-600 leading-relaxed">
              我重新评估了架构约束，从广泛的系统崩溃问题转向更细致地关注聊天响应性和数据库读取性能。管理员主导的繁重操作，由于其较低的并发性，存在超时风险而非系统范围的崩溃。这简化了设计考虑，优先考虑高效的数据库读取和聊天系统可扩展性。
            </p>
          </section>

          {/* 第三部分 */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              确定关键路径
            </h3>
            <p className="text-gray-600 leading-relaxed">
              我现在专注于瓶颈问题。问题不在于后端崩溃，而是聊天系统的响应性和数据库读取性能正成为用户关注的焦点。管理操作存在超时风险，而用户交互则需要高效的数据检索和实时通信。我优先在这里进行优化。
            </p>
          </section>

          {/* 第四部分 */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              优先考虑用户响应性
            </h3>
            <p className="text-gray-600 leading-relaxed">
              这改变了一切。用户关于管理员主导任务的说明让我可以转移重点。我现在优先考虑面向用户的功能。我的注意力集中在优化聊天响应性和确保快速的数据库读取性能，以改善用户体验，同时考虑聊天连接并发性。
            </p>
          </section>

          {/* 第五部分 */}
          <section>
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              聚焦性能目标
            </h3>
            <p className="text-gray-600 leading-relaxed">
              我现在优先考虑用户体验，专注于优化聊天延迟和数据库读取速度。重点的转移意味着我正在集中精力优化聊天系统和数据库访问，确保流畅的用户交互。数据库读取性能和聊天系统可扩展性是我当前的首要任务。
            </p>
          </section>

          {/* 分析评论 */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-gray-900 leading-relaxed mb-3">
              <strong>始终，如果是这样的话，那你全做到了可以，但核心问题并了解！</strong>
            </p>
            <p className="text-gray-900 leading-relaxed mb-3">
              "管理员操作和用户" 这种应该分离的权限模型，是极其危险的权限模型。你对它远观察者来说，这是最完全的认是最差的一种方式。
            </p>
            <p className="text-gray-900 leading-relaxed mb-3">
              既然"系统崩溃"的风险已经被到你核心关心的用户体验（UX）**上。
            </p>
            <p className="text-gray-900 leading-relaxed">
              在这种模型下，你的 UX 核心就被从"管理员处理"转变为了"即时响应度"和"成本控制"。
            </p>
          </div>
        </div>

        {/* 用户输入区域（仅展示） */}
        <div className="mt-12 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="输入消息..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled
            />
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50" disabled>
              发送
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            这是一个测试页面，输入框已禁用
          </p>
        </div>
      </div>
    </div>
  )
}
